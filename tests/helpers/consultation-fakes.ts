import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseBrief } from '../../src/core/brief.js';
import type { Brief } from '../../src/core/brief.js';
import type { CompiledPlan } from '../../src/core/checks.js';
import type {
  AdmissionInput,
  ConsentSnapshot,
  FinalizationInput,
  FinalizationReceipt,
  RecordedAttempt,
  Reservation,
  SessionRead,
} from '../../src/core/consent.js';
import { checkConsent, parseScope } from '../../src/core/consent.js';
import type { EvaluationOutcome, InternalJudgment, Validation } from '../../src/core/result.js';
import { invalid, prepareBytes, valid, validateProviderResponse } from '../../src/core/result.js';
import type { Clock } from '../../src/ports/clock.js';
import type { DecisionProvider, EvaluationControl } from '../../src/ports/decision-provider.js';
import type { SessionConsent, StoreControl } from '../../src/ports/session-consent.js';
import type { ConsultDependencies, ConsultInput } from '../../src/application/consult.js';

export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: T) => void = () => {
    throw new Error('not initialized');
  };
  let reject: (reason?: unknown) => void = () => {
    throw new Error('not initialized');
  };
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export async function flush(): Promise<void> {
  for (let i = 0; i < 100; i++) await Promise.resolve();
}
export class FakeClock implements Clock {
  monotonic = 0;
  wall = Date.parse('2026-10-11T12:00:00.000Z');
  readonly timers = new Map<number, { at: number; callback: () => void }>();
  private next = 0;
  monotonicMs(): number {
    return this.monotonic;
  }
  wallTimeMs(): number {
    return this.wall;
  }
  schedule(delay: number, callback: () => void): () => void {
    const key = ++this.next;
    this.timers.set(key, { at: this.monotonic + delay, callback });
    return () => {
      this.timers.delete(key);
    };
  }
  advance(ms: number, notify = true): void {
    this.monotonic += ms;
    this.wall += ms;
    if (notify)
      for (const [key, timer] of [...this.timers])
        if (timer.at <= this.monotonic) {
          this.timers.delete(key);
          timer.callback();
        }
  }
}
export function fixture(name: 'minimal6' | 'csv13' = 'minimal6'): {
  brief: Brief;
  inputBytes: number;
} {
  const parsed = parseBrief(
    readFileSync(new URL(`../fixtures/briefs/${name}.json`, import.meta.url)),
  );
  if (!parsed.ok) throw new Error('fixture invalid');
  return { brief: parsed.value, inputBytes: parsed.inputBytes };
}
export function session(clock: FakeClock, id = 'a'.repeat(32)): ConsentSnapshot {
  const scope = parseScope(
    JSON.stringify({
      schemaVersion: 'hunchcraft.scope.v0',
      scopeId: 'csv-export',
      allowedContent: [
        'original-request',
        'clarifications',
        'requirements',
        'standards',
        'proposal',
        'excerpts',
        'local-questions',
      ],
      excerptRoots: ['src', 'docs', 'tests'],
      allowSyntheticEvidence: true,
    }),
  );
  if (!scope.ok) throw new Error('scope invalid');
  return Object.freeze({
    sessionId: id,
    scope: scope.value,
    repo: Object.freeze({
      rootPath: 'C:\\fixture',
      rootFileIdentity: Object.freeze({ platform: 'win32', device: '1', inode: '2' }),
    }),
    salt: 'b'.repeat(32),
    createdAtMs: clock.wall,
    expiresAtMs: clock.wall + 1800000,
    generation: 0,
    maxCalls: 10,
    attemptsUsed: 0,
    revoked: false,
    activeInvocationId: null,
  });
}
export const uuid = '12345678-1234-4234-8234-123456789012';
export const uuid2 = '22345678-1234-4234-8234-123456789012';
type Pending = {
  admission: AdmissionInput;
  gate: ReturnType<typeof deferred<void>>;
  settled: ReturnType<typeof deferred<void>>;
  intent: FinalizationInput | null;
};
/** Test-only atomic state/fences. Nothing here is a production fallback. */
export class FakeSessions implements SessionConsent {
  readonly snapshots = new Map<string, ConsentSnapshot>();
  readonly attempts = new Map<string, RecordedAttempt>();
  readonly pending = new Map<string, Pending>();
  readonly commits = new Map<
    string,
    {
      gate: ReturnType<typeof deferred<void>>;
      settled: ReturnType<typeof deferred<void>>;
      intent: FinalizationInput;
      downgrade: FinalizationInput | null;
      fail: boolean;
    }
  >();
  readCalls = 0;
  admitCalls = 0;
  checkCalls = 0;
  finalizeCalls = 0;
  deferAdmission = false;
  deferCommit = false;
  hangFinalize = false;
  constructor(
    readonly clock: FakeClock,
    ...snapshots: ConsentSnapshot[]
  ) {
    for (const s of snapshots) this.snapshots.set(s.sessionId, s);
  }
  key(sessionId: string, requestId: string): string {
    return `${sessionId}/${requestId}`;
  }
  revoke(id: string): void {
    const s = this.snapshots.get(id);
    if (s) this.snapshots.set(id, Object.freeze({ ...s, revoked: true }));
  }
  read(id: string, _control: StoreControl, requestId?: string): Promise<Validation<SessionRead>> {
    this.readCalls++;
    const s = this.snapshots.get(id);
    return Promise.resolve(
      s
        ? valid(
            Object.freeze({
              consent: s,
              attempt: requestId ? (this.attempts.get(this.key(id, requestId)) ?? null) : null,
            }),
          )
        : invalid('consent_missing', 'consent'),
    );
  }
  admit(input: AdmissionInput, _control: StoreControl): Promise<Validation<Reservation>> {
    void _control;
    this.admitCalls++;
    // Register before awaiting: cleanup can install a terminal intent while pending.
    const pending: Pending = {
      admission: input,
      gate: deferred<void>(),
      settled: deferred<void>(),
      intent: null,
    };
    this.pending.set(input.invocationId, pending);
    if (!this.deferAdmission) pending.gate.resolve();
    return pending.gate.promise.then(
      () => {
        const s = this.snapshots.get(input.sessionId);
        let result: Validation<Reservation>;
        if (!s) result = invalid('consent_missing', 'consent');
        else {
          const checked = checkConsent(
            s,
            {
              sessionId: input.sessionId,
              scopeId: input.scopeId,
              repo: input.repo,
              expectedGeneration: input.expectedGeneration,
            },
            this.clock.wall,
          );
          if (!checked.ok) result = checked;
          else if (this.attempts.has(this.key(input.sessionId, input.requestId)))
            result = invalid('request_already_admitted', 'consent');
          else if (s.activeInvocationId !== null) result = invalid('session_busy', 'consent');
          else if (s.attemptsUsed >= s.maxCalls) result = invalid('session_call_limit', 'consent');
          else {
            const terminal = pending.intent?.terminal;
            const consent = Object.freeze({
              ...s,
              attemptsUsed: s.attemptsUsed + 1,
              activeInvocationId: terminal ? null : input.invocationId,
            });
            this.snapshots.set(input.sessionId, consent);
            this.attempts.set(
              this.key(input.sessionId, input.requestId),
              Object.freeze({
                requestId: input.requestId,
                invocationId: input.invocationId,
                sourceDigest: input.sourceDigest,
                state: terminal?.state ?? 'active',
                completedAtMs: terminal?.completedAtMs ?? null,
                resultExpiresAtMs: terminal?.resultExpiresAtMs ?? null,
              }),
            );
            result = valid(Object.freeze({ admission: input, consent }));
          }
        }
        this.pending.delete(input.invocationId);
        pending.settled.resolve();
        return result;
      },
      () => {
        this.pending.delete(input.invocationId);
        pending.settled.resolve();
        return invalid('local_io', 'consent');
      },
    );
  }
  check(input: Reservation, _control: StoreControl): Promise<Validation<SessionRead>> {
    void _control;
    this.checkCalls++;
    const a = input.admission;
    const consent = this.snapshots.get(a.sessionId);
    const attempt = this.attempts.get(this.key(a.sessionId, a.requestId));
    if (
      !consent ||
      !attempt ||
      attempt.invocationId !== a.invocationId ||
      attempt.sourceDigest !== a.sourceDigest
    )
      return Promise.resolve(invalid('local_io', 'consent'));
    return Promise.resolve(valid(Object.freeze({ consent, attempt })));
  }
  private persist(input: FinalizationInput): Validation<FinalizationReceipt> {
    const key = this.key(input.sessionId, input.requestId);
    const attempt = this.attempts.get(key);
    const s = this.snapshots.get(input.sessionId);
    if (!attempt) return valid(Object.freeze({ ...input, disposition: 'not-admitted' }));
    if (
      !s ||
      attempt.invocationId !== input.invocationId ||
      attempt.sourceDigest !== input.sourceDigest
    )
      return invalid('local_io', 'consent');
    const t = input.terminal;
    if (
      t.state === 'delivery-unknown' &&
      attempt.state !== 'completed' &&
      attempt.state !== 'delivery-unknown'
    )
      return invalid('local_io', 'consent');
    if (t.state === 'completed') {
      if (s.revoked || this.clock.wall >= s.expiresAtMs)
        return invalid(s.revoked ? 'consent_revoked' : 'consent_expired', 'consent');
      if (t.resultExpiresAtMs !== Math.min(s.expiresAtMs, t.completedAtMs + 60000))
        return invalid('local_io', 'consent');
    }
    this.attempts.set(
      key,
      Object.freeze({
        ...attempt,
        state: t.state,
        completedAtMs: t.completedAtMs,
        resultExpiresAtMs: t.resultExpiresAtMs,
      }),
    );
    if (s.activeInvocationId === input.invocationId)
      this.snapshots.set(input.sessionId, Object.freeze({ ...s, activeInvocationId: null }));
    return valid(Object.freeze({ ...input, disposition: 'persisted' }));
  }
  finalize(
    input: FinalizationInput,
    _control: StoreControl,
  ): Promise<Validation<FinalizationReceipt>> {
    void _control;
    this.finalizeCalls++;
    if (this.hangFinalize) return deferred<Validation<FinalizationReceipt>>().promise;
    const pending = this.pending.get(input.invocationId);
    if (pending) {
      pending.intent = input;
      return pending.settled.promise.then(() => this.persist(input));
    }
    const commit = this.commits.get(input.invocationId);
    if (commit && input.terminal.state === 'delivery-unknown') {
      commit.downgrade = input;
      return commit.settled.promise.then(() =>
        commit.fail ? invalid('local_io', 'consent') : this.persist(input),
      );
    }
    if (this.deferCommit && input.terminal.state === 'completed') {
      const c = {
        gate: deferred<void>(),
        settled: deferred<void>(),
        intent: input,
        downgrade: null as FinalizationInput | null,
        fail: false,
      };
      this.commits.set(input.invocationId, c);
      return c.gate.promise.then(
        () => {
          const receipt = c.fail
            ? invalid<FinalizationReceipt>('local_io', 'consent')
            : this.persist(input);
          if (c.downgrade && !c.fail) this.persist(c.downgrade);
          this.commits.delete(input.invocationId);
          c.settled.resolve();
          return receipt;
        },
        () => {
          c.fail = true;
          this.commits.delete(input.invocationId);
          c.settled.resolve();
          return invalid('local_io', 'consent');
        },
      );
    }
    return Promise.resolve(this.persist(input));
  }
}
export function response(plan: CompiledPlan): unknown {
  return {
    model: 'jev-1.13.0',
    answers: Object.fromEntries(
      plan.checks.map((c, i) => [
        c.wireId,
        c.question.type === 'noul'
          ? { type: 'noul', noul: 0.1 * (i % 5) }
          : {
              type: 'score',
              score: 1.5,
              legend: {
                '0': c.question.criteria[0],
                '1': c.question.criteria[1],
                '2': c.question.criteria[2],
              },
              probabilities: { '0': 0.1, '1': 0.3, '2': 0.6 },
              confidence: 0.4,
            },
      ]),
    ),
    usage: { input_tokens: 120, output_tokens: 24 },
  };
}
export function evaluation(plan: CompiledPlan): EvaluationOutcome {
  const result = validateProviderResponse(response(plan), plan, {
    origin: 'test-fixture',
    attempts: 0,
    requestId: null,
    httpStatus: null,
  });
  if (!result.ok) throw new Error('response invalid');
  return { ok: true, value: result.value };
}
export class FakeProvider implements DecisionProvider {
  readonly origin = 'test-fixture';
  calls = 0;
  dispatches = 0;
  controls: EvaluationControl[] = [];
  handler:
    ((plan: CompiledPlan, control: EvaluationControl) => Promise<EvaluationOutcome>) | undefined;
  async evaluate(
    plan: CompiledPlan,
    _state: Brief['brief'],
    control: EvaluationControl,
  ): Promise<EvaluationOutcome> {
    this.calls++;
    this.controls.push(control);
    if (this.handler) return this.handler(plan, control);
    await control.beforeDispatch();
    this.dispatches++;
    return evaluation(plan);
  }
}
export const sha256 = (bytes: Uint8Array): Promise<string> =>
  Promise.resolve(createHash('sha256').update(bytes).digest('hex'));
export function prepare(result: InternalJudgment): Promise<ReturnType<typeof prepareBytes>> {
  return Promise.resolve(prepareBytes(new TextEncoder().encode(JSON.stringify(result) + '\n')));
}
export function setup(name: 'minimal6' | 'csv13' = 'minimal6'): {
  clock: FakeClock;
  store: FakeSessions;
  provider: FakeProvider;
  input: ConsultInput;
  dependencies: ConsultDependencies;
  controller: AbortController;
} {
  const clock = new FakeClock();
  const consent = session(clock);
  const store = new FakeSessions(clock, consent);
  const provider = new FakeProvider();
  const controller = new AbortController();
  const input: ConsultInput = {
    ...fixture(name),
    sessionId: consent.sessionId,
    repo: { ...consent.repo, cwdWithinRoot: true },
    invocationId: uuid,
    startedAt: { monotonicMs: clock.monotonic, wallTimeMs: clock.wall },
    signal: controller.signal,
  };
  return {
    clock,
    store,
    provider,
    input,
    controller,
    dependencies: { provider, sessions: store, clock, sha256, prepareDelivery: prepare },
  };
}
