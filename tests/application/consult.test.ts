import { describe, expect, it } from 'vitest';
import { consult } from '../../src/application/consult.js';
import type {
  EvaluationOutcome,
  InternalJudgment,
  PreparedDelivery,
  Validation,
} from '../../src/core/result.js';
import { ClassifiedFailure, failure, invalid, prepareBytes } from '../../src/core/result.js';
import { verify } from '../../src/application/verify.js';
import {
  deferred,
  evaluation,
  FakeSessions,
  flush,
  session,
  setup,
  uuid,
  uuid2,
} from '../helpers/consultation-fakes.js';

describe('offline consultation', () => {
  it('provider cannot replace a genuine classified payload before rejecting', async () => {
    const s = setup();
    const exception = new ClassifiedFailure(failure('provider_connection', 'provider'));
    s.provider.handler = () => {
      expect(
        Reflect.set(exception, 'failure', { ...exception.failure, message: 'private payload' }),
      ).toBe(false);
      expect(() =>
        Object.defineProperty(exception, 'failure', {
          get: () => {
            throw new Error('must not execute');
          },
        }),
      ).toThrow();
      return Promise.reject(exception);
    };
    expect(await consult(s.input, s.dependencies)).toMatchObject({
      status: 'error',
      outcome: { error: failure('provider_connection', 'provider') },
      cleanup: { status: 'confirmed' },
    });
  });
  it('confirmed admission requires persisted cleanup acknowledgment on provider failure', async () => {
    const s = setup();
    s.provider.handler = () =>
      Promise.resolve({
        ok: false,
        error: failure('provider_connection', 'provider'),
        usage: null,
        metadata: { origin: 'test-fixture', attempts: 0, requestId: null, httpStatus: null },
      });
    s.store.finalize = (intent) =>
      Promise.resolve({ ok: true, value: { ...intent, disposition: 'not-admitted' } });
    const outcome = await consult(s.input, s.dependencies);
    expect(outcome).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'provider_connection' } },
      cleanup: { status: 'unconfirmed', error: { code: 'local_io' } },
    });
    expect(s.store.snapshots.get(s.input.sessionId)?.activeInvocationId).toBe(uuid);
    expect(
      s.store.attempts.get(s.store.key(s.input.sessionId, s.input.brief.requestId))?.state,
    ).toBe('active');
  });
  it('matching reservation confirms admission before later inconsistent snapshot validation', async () => {
    const s = setup();
    const original = s.store.admit.bind(s.store);
    s.store.admit = async (intent, control) => {
      const admitted = await original(intent, control);
      return admitted.ok
        ? {
            ok: true,
            value: { ...admitted.value, consent: { ...admitted.value.consent, revoked: true } },
          }
        : admitted;
    };
    s.store.finalize = (intent) =>
      Promise.resolve({ ok: true, value: { ...intent, disposition: 'not-admitted' } });
    expect(await consult(s.input, s.dependencies)).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'consent_revoked' } },
      cleanup: { status: 'unconfirmed', error: { code: 'local_io' } },
    });
    expect(s.store.snapshots.get(s.input.sessionId)?.activeInvocationId).toBe(uuid);
    expect(s.provider.calls).toBe(0);
  });
  it('postcommit cancellation cannot falsely confirm not-admitted downgrade; leftover completion stays explicit', async () => {
    const s = setup();
    const original = s.store.finalize.bind(s.store);
    let result: InternalJudgment | undefined;
    s.store.finalize = async (intent, control) => {
      if (intent.terminal.state === 'delivery-unknown')
        return { ok: true, value: { ...intent, disposition: 'not-admitted' } };
      const receipt = await original(intent, control);
      s.controller.abort();
      return receipt;
    };
    const outcome = await consult(s.input, {
      ...s.dependencies,
      prepareDelivery: (judgment) => {
        result = judgment;
        return s.dependencies.prepareDelivery(judgment);
      },
    });
    expect(outcome).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'operation_cancelled' } },
      cleanup: { status: 'unconfirmed', error: { code: 'local_io' } },
    });
    expect(
      s.store.attempts.get(s.store.key(s.input.sessionId, s.input.brief.requestId))?.state,
    ).toBe('completed');
    expect(Object.keys(outcome)).not.toContain('result');
    if (!result) throw new Error();
    // Verify cannot infer failed delivery: cleanup must not claim the leftover
    // completed record was durably downgraded.
    expect(
      await verify(
        {
          ...s.input,
          signal: new AbortController().signal,
          result: { format: 'internal', value: result },
        },
        s.dependencies,
      ),
    ).toMatchObject({ kind: 'verification' });
  });
  it('fenced ambiguous admission that never committed may acknowledge not-admitted', async () => {
    const s = setup();
    const pending = deferred<never>();
    s.store.admit = () => pending.promise;
    s.store.finalize = (intent) =>
      Promise.resolve({ ok: true, value: { ...intent, disposition: 'not-admitted' } });
    const work = consult(s.input, s.dependencies);
    await flush();
    s.controller.abort();
    await flush();
    expect(await work).toMatchObject({
      status: 'error',
      cleanup: { status: 'confirmed', error: null },
    });
    pending.reject(new Error('definitely not committed'));
    await flush();
    expect(s.store.snapshots.get(s.input.sessionId)?.attemptsUsed).toBe(0);
  });
  it.each(['hash', 'provider', 'preparation'] as const)(
    'forged classified %s exception is sanitized without reading payload getter',
    async (stage) => {
      const s = setup();
      let calls = 0;
      const forged = new Error('untrusted exception');
      Object.setPrototypeOf(forged, ClassifiedFailure.prototype);
      Object.defineProperty(forged, 'failure', {
        get: () => {
          calls++;
          return { message: 'private exception payload' };
        },
      });
      const dependencies = { ...s.dependencies };
      if (stage === 'hash') dependencies.sha256 = () => Promise.reject(forged);
      if (stage === 'provider') s.provider.handler = () => Promise.reject(forged);
      if (stage === 'preparation') dependencies.prepareDelivery = () => Promise.reject(forged);
      const outcome = await consult(s.input, dependencies);
      expect(outcome).toMatchObject({
        status: 'error',
        outcome: { error: failure('internal_failure', 'internal') },
      });
      expect(calls).toBe(0);
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('HTTP-origin progress retains known status/usage on a hung fake transport', async () => {
    const s = setup();
    const pending = deferred<EvaluationOutcome>();
    const provider = {
      origin: 'provider-http' as const,
      evaluate: async (
        _plan: Parameters<typeof s.provider.evaluate>[0],
        _state: Parameters<typeof s.provider.evaluate>[1],
        control: Parameters<typeof s.provider.evaluate>[2],
      ): Promise<EvaluationOutcome> => {
        await control.beforeDispatch();
        control.onProgress({
          metadata: {
            origin: 'provider-http',
            attempts: 1,
            requestId: 'fake_HTTP',
            httpStatus: 529,
          },
          usage: { inputTokens: 11, outputTokens: 2 },
        });
        return pending.promise;
      },
    };
    const work = consult(s.input, { ...s.dependencies, provider });
    await flush();
    s.controller.abort();
    await flush();
    expect(await work).toMatchObject({
      status: 'error',
      outcome: {
        error: { code: 'operation_cancelled' },
        provider: {
          metadata: {
            origin: 'provider-http',
            attempts: 1,
            requestId: 'fake_HTTP',
            httpStatus: 529,
          },
          usage: { inputTokens: 11, outputTokens: 2 },
        },
      },
    });
    pending.reject(new Error('late fake transport'));
    await flush();
  });
  it('HTTP failure cannot forge dispatch proof without the guard', async () => {
    const s = setup();
    const provider = {
      origin: 'provider-http' as const,
      evaluate: (): Promise<EvaluationOutcome> =>
        Promise.resolve({
          ok: false,
          error: failure('provider_http', 'provider'),
          usage: null,
          metadata: { origin: 'provider-http', attempts: 1, requestId: null, httpStatus: 401 },
        }),
    };
    expect(await consult(s.input, { ...s.dependencies, provider })).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'internal_failure' } },
    });
  });
  it.each(['minimal6', 'csv13'] as const)(
    'carries %s through guard, owned preparation and exact completion',
    async (name) => {
      const s = setup(name);
      let preparedResult: InternalJudgment | undefined;
      const outcome = await consult(s.input, {
        ...s.dependencies,
        prepareDelivery: (result) => {
          preparedResult = result;
          return Promise.resolve(
            prepareBytes(new TextEncoder().encode(JSON.stringify(result) + '\n')),
          );
        },
      });
      expect(outcome.status).toBe('ready');
      if (outcome.status !== 'ready') return;
      expect(s.provider.calls).toBe(1);
      expect(s.provider.dispatches).toBe(1);
      expect(s.store.admitCalls).toBe(1);
      expect(outcome.result).toBe(preparedResult);
      expect(outcome.result.checks).toHaveLength(name === 'minimal6' ? 6 : 13);
      expect(outcome.result.checks.every((c) => c.feedback.reviewPrompt && c.answer)).toBe(true);
      expect(outcome.result.provider.metadata).toEqual({
        origin: 'test-fixture',
        attempts: 0,
        requestId: null,
        httpStatus: null,
      });
      expect(new TextDecoder().decode(outcome.prepared.copyBytes())).toBe(
        JSON.stringify(outcome.result) + '\n',
      );
      expect(outcome.completion.terminal.completedAtMs).toBe(
        Date.parse(outcome.result.freshness.completedAt),
      );
      expect(s.store.snapshots.get(s.input.sessionId)?.attemptsUsed).toBe(1);
      expect(s.store.snapshots.get(s.input.sessionId)?.activeInvocationId).toBeNull();
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('scope rejection occurs before admission/provider', async () => {
    const s = setup();
    const consent = s.store.snapshots.get(s.input.sessionId);
    if (!consent) throw new Error();
    s.store.snapshots.set(s.input.sessionId, {
      ...consent,
      scope: { ...consent.scope, allowSyntheticEvidence: false },
    });
    const o = await consult(s.input, s.dependencies);
    expect(o).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'scope_mismatch' } },
      cleanup: { status: 'not-required' },
    });
    expect(s.store.admitCalls).toBe(0);
    expect(s.provider.calls).toBe(0);
  });
  it.each(['cancelled', 'spent'] as const)('no dependency begins with %s input', async (mode) => {
    const s = setup();
    if (mode === 'cancelled') s.controller.abort();
    else s.clock.advance(15000, false);
    const o = await consult(s.input, s.dependencies);
    expect(o).toMatchObject({
      status: 'error',
      outcome: { status: mode === 'cancelled' ? 'cancelled' : 'timeout' },
    });
    expect(s.store.readCalls).toBe(0);
    expect(s.store.admitCalls).toBe(0);
    expect(s.provider.calls).toBe(0);
    expect(s.clock.timers.size).toBe(0);
  });
  it.each(['missing', 'repeated', 'concurrent'] as const)(
    'fails closed for %s guard even when errors are swallowed',
    async (mode) => {
      const s = setup();
      s.provider.handler = async (plan, c) => {
        if (mode === 'repeated') {
          await c.beforeDispatch();
          try {
            await c.beforeDispatch();
          } catch {
            /* deliberately broken provider */
          }
        }
        if (mode === 'concurrent')
          await Promise.allSettled([c.beforeDispatch(), c.beforeDispatch()]);
        return evaluation(plan);
      };
      const o = await consult(s.input, s.dependencies);
      expect(o).toMatchObject({
        status: 'error',
        outcome: { error: { code: 'internal_failure' } },
        cleanup: { status: 'confirmed' },
      });
      expect(s.store.snapshots.get(s.input.sessionId)?.attemptsUsed).toBe(1);
      expect(s.clock.timers.size).toBe(0);
      if (o.status === 'error') expect(Object.keys(o.outcome)).not.toContain('checks');
    },
  );
  it('pre-dispatch provider failure consumes admission with attempts zero and no guard', async () => {
    const s = setup();
    s.provider.handler = () =>
      Promise.resolve({
        ok: false,
        error: failure('missing_key', 'configuration'),
        usage: null,
        metadata: { origin: 'test-fixture', attempts: 0, requestId: null, httpStatus: null },
      });
    const o = await consult(s.input, s.dependencies);
    expect(o).toMatchObject({
      status: 'error',
      outcome: {
        error: { code: 'missing_key' },
        provider: { usage: null, metadata: { attempts: 0 } },
      },
      cleanup: { status: 'confirmed' },
    });
    expect(s.store.checkCalls).toBe(0);
    expect(s.provider.dispatches).toBe(0);
    expect(s.store.snapshots.get(s.input.sessionId)?.attemptsUsed).toBe(1);
  });
  it('revocation inside guard prevents dispatch and wins over provider success', async () => {
    const s = setup();
    s.provider.handler = async (plan, c) => {
      s.store.revoke(s.input.sessionId);
      try {
        await c.beforeDispatch();
      } catch {
        /* swallowed by broken provider */
      }
      return evaluation(plan);
    };
    expect(await consult(s.input, s.dependencies)).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'consent_revoked' } },
      cleanup: { status: 'confirmed' },
    });
    expect(s.provider.dispatches).toBe(0);
  });
  it.each(['disappearing', 'forged'] as const)('rejects %s progress metadata', async (mode) => {
    const s = setup();
    s.provider.handler = async (plan, c) => {
      await c.beforeDispatch();
      c.onProgress({
        metadata: { origin: 'test-fixture', attempts: 0, requestId: null, httpStatus: null },
        usage: { inputTokens: 120, outputTokens: 24 },
      });
      c.onProgress(
        mode === 'disappearing'
          ? {
              metadata: { origin: 'test-fixture', attempts: 0, requestId: null, httpStatus: null },
              usage: null,
            }
          : {
              metadata: {
                origin: 'provider-http',
                attempts: 1,
                requestId: 'forged',
                httpStatus: 200,
              },
              usage: { inputTokens: 120, outputTokens: 24 },
            },
      );
      return evaluation(plan);
    };
    expect(await consult(s.input, s.dependencies)).toMatchObject({
      status: 'error',
      outcome: {
        error: { code: 'internal_failure' },
        provider: { usage: { inputTokens: 120, outputTokens: 24 } },
      },
    });
  });
  it('retains known progress on hung provider and observes late rejection', async () => {
    const s = setup();
    const pending = deferred<EvaluationOutcome>();
    s.provider.handler = async (_plan, c) => {
      await c.beforeDispatch();
      c.onProgress({
        metadata: { origin: 'test-fixture', attempts: 0, requestId: null, httpStatus: null },
        usage: { inputTokens: 10, outputTokens: 2 },
      });
      return pending.promise;
    };
    const work = consult(s.input, s.dependencies);
    await flush();
    s.clock.advance(15000);
    await flush();
    const o = await work;
    expect(o).toMatchObject({
      status: 'error',
      outcome: {
        error: { code: 'operation_deadline' },
        provider: { usage: { inputTokens: 10, outputTokens: 2 } },
      },
      cleanup: { status: 'confirmed' },
    });
    pending.reject(new Error('secret'));
    await flush();
    s.provider.controls[0]?.onProgress({ approved: true });
    expect(s.clock.timers.size).toBe(0);
  });
  it('elapsed checkpoint catches late settlement before timer notification', async () => {
    const s = setup();
    const pending = deferred<string>();
    const work = consult(s.input, { ...s.dependencies, sha256: () => pending.promise });
    await flush();
    s.clock.advance(15000, false);
    pending.resolve('a'.repeat(64));
    await flush();
    expect(await work).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'operation_deadline' } },
      cleanup: { status: 'not-required' },
    });
    expect(s.store.admitCalls).toBe(0);
  });
  it.each(['hash', 'read', 'admit', 'check', 'provider', 'preparation', 'commit'] as const)(
    'bounds a hung %s dependency without sleeps',
    async (stage) => {
      const s = setup();
      const never = deferred<never>();
      const dependencies = { ...s.dependencies };
      if (stage === 'hash') dependencies.sha256 = () => never.promise;
      if (stage === 'read') s.store.read = () => never.promise;
      if (stage === 'admit') s.store.admit = () => never.promise;
      if (stage === 'check') s.store.check = () => never.promise;
      if (stage === 'provider') s.provider.handler = () => never.promise;
      if (stage === 'preparation') dependencies.prepareDelivery = () => never.promise;
      if (stage === 'commit') s.store.finalize = () => never.promise;
      const work = consult(s.input, dependencies);
      await flush();
      s.clock.advance(15000);
      await flush();
      s.clock.advance(1000);
      await flush();
      const o = await work;
      expect(o).toMatchObject({
        status: 'error',
        outcome: { error: { code: 'operation_deadline' } },
      });
      never.reject(new Error('late private dependency error'));
      await flush();
      expect(s.clock.timers.size).toBe(0);
      if (o.status === 'error') expect(Object.keys(o.outcome)).not.toContain('checks');
    },
  );
  it('malformed typed store/preparation data cannot smuggle arbitrary methods', async () => {
    const s = setup();
    let calls = 0;
    const o = await consult(s.input, {
      ...s.dependencies,
      prepareDelivery: () =>
        Promise.resolve({
          ok: true,
          value: {
            byteLength: 1,
            copyBytes: () => {
              calls++;
              return new Uint8Array([10]);
            },
          },
        }),
    });
    expect(o).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'internal_failure' } },
      cleanup: { status: 'confirmed' },
    });
    expect(calls).toBe(0);
  });
  it('wall rollback and decreasing monotonic readings fail closed', async () => {
    const s = setup();
    const o = await consult(s.input, {
      ...s.dependencies,
      sha256: (bytes) => {
        s.clock.wall -= 1001;
        return s.dependencies.sha256(bytes);
      },
    });
    expect(o).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'clock_inconsistent', exitCode: 1 } },
    });
    expect(s.provider.calls).toBe(0);
    const t = setup();
    t.clock.monotonic = 5;
    const bad = await consult(t.input, {
      ...t.dependencies,
      sha256: (bytes) => {
        t.clock.monotonic = 4;
        return t.dependencies.sha256(bytes);
      },
    });
    expect(bad).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'clock_inconsistent' } },
    });
  });
  it('caller cancellation is retained over later provider rejection', async () => {
    const s = setup();
    const pending = deferred<EvaluationOutcome>();
    s.provider.handler = async (_p, c) => {
      await c.beforeDispatch();
      return pending.promise;
    };
    const work = consult(s.input, s.dependencies);
    await flush();
    s.controller.abort();
    pending.reject(new Error('private source'));
    await flush();
    expect(await work).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'operation_cancelled' } },
      cleanup: { status: 'confirmed' },
    });
    expect(s.clock.timers.size).toBe(0);
  });
  it('pending admission gets its terminal intent before a controlled late commit', async () => {
    const s = setup();
    s.store.deferAdmission = true;
    const work = consult(s.input, s.dependencies);
    await flush();
    s.controller.abort();
    await flush();
    const pending = s.store.pending.get(uuid);
    expect(pending?.intent?.terminal.state).toBe('cancelled');
    pending?.gate.resolve();
    await flush();
    expect(await work).toMatchObject({ status: 'error', cleanup: { status: 'confirmed' } });
    expect(s.store.snapshots.get(s.input.sessionId)?.attemptsUsed).toBe(1);
    expect(s.store.snapshots.get(s.input.sessionId)?.activeInvocationId).toBeNull();
    expect(s.provider.calls).toBe(0);
  });
  it('never-settling admission returns unconfirmed in one grace; late admission cannot revive slot', async () => {
    const s = setup();
    s.store.deferAdmission = true;
    const work = consult(s.input, s.dependencies);
    await flush();
    s.controller.abort();
    await flush();
    expect(s.clock.timers.size).toBe(1);
    s.clock.advance(1000);
    await flush();
    expect(await work).toMatchObject({ status: 'error', cleanup: { status: 'unconfirmed' } });
    s.store.pending.get(uuid)?.gate.resolve();
    await flush();
    expect(s.store.snapshots.get(s.input.sessionId)?.activeInvocationId).toBeNull();
    expect(s.store.snapshots.get(s.input.sessionId)?.attemptsUsed).toBe(1);
    expect(s.provider.calls).toBe(0);
    expect(s.clock.timers.size).toBe(0);
  });
  it.each(['reject', 'hung', 'malformed', 'expiry'] as const)(
    'preparation %s never commits completed',
    async (mode) => {
      const s = setup();
      const pending = deferred<Validation<PreparedDelivery>>();
      const work = consult(s.input, {
        ...s.dependencies,
        prepareDelivery: async () => {
          if (mode === 'reject') throw new Error('secret');
          if (mode === 'malformed') return invalid('output_too_large', 'output');
          if (mode === 'expiry') {
            s.clock.wall += 60000;
            return prepareBytes(new Uint8Array([10]));
          }
          return pending.promise;
        },
      });
      await flush();
      if (mode === 'hung') {
        s.clock.advance(15000);
        await flush();
      }
      const o = await work;
      expect(o.status).toBe('error');
      expect(
        s.store.attempts.get(s.store.key(s.input.sessionId, s.input.brief.requestId))?.state,
      ).not.toBe('completed');
      if (mode === 'hung') pending.reject(new Error('late'));
      await flush();
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('pending completion is fenced to delivery-unknown preserving exact prepared timestamps', async () => {
    const s = setup();
    s.store.deferCommit = true;
    const work = consult(s.input, s.dependencies);
    await flush();
    const c = s.store.commits.get(uuid);
    expect(c).toBeDefined();
    s.controller.abort();
    await flush();
    expect(c?.downgrade?.terminal.state).toBe('delivery-unknown');
    c?.gate.resolve();
    await flush();
    expect(await work).toMatchObject({ status: 'error', cleanup: { status: 'confirmed' } });
    const attempt = s.store.attempts.get(s.store.key(s.input.sessionId, s.input.brief.requestId));
    expect(attempt?.state).toBe('delivery-unknown');
    expect(attempt?.completedAtMs).toBe(c?.intent.terminal.completedAtMs);
  });
  it('definitive no-commit cannot claim delivery-unknown acknowledgment', async () => {
    const s = setup();
    s.store.deferCommit = true;
    const work = consult(s.input, s.dependencies);
    await flush();
    const c = s.store.commits.get(uuid);
    if (!c) throw new Error();
    s.controller.abort();
    await flush();
    c.fail = true;
    c.gate.resolve();
    await flush();
    expect(await work).toMatchObject({
      status: 'error',
      cleanup: { status: 'unconfirmed', error: { code: 'local_io' } },
    });
    expect(
      s.store.attempts.get(s.store.key(s.input.sessionId, s.input.brief.requestId))?.state,
    ).toBe('active');
  });
  it('hang cleanup cannot pretend durable release or expose computed judgment', async () => {
    const s = setup();
    s.store.hangFinalize = true;
    s.provider.handler = () => Promise.reject(new Error('private'));
    const work = consult(s.input, s.dependencies);
    await flush();
    s.clock.advance(1000);
    await flush();
    const o = await work;
    expect(o).toMatchObject({ status: 'error', cleanup: { status: 'unconfirmed' } });
    if (o.status === 'error') expect(Object.keys(o)).toEqual(['status', 'outcome', 'cleanup']);
    expect(s.store.snapshots.get(s.input.sessionId)?.activeInvocationId).toBe(uuid);
  });
  it('postcommit revocation downgrades only its owner, never a newer active UUID', async () => {
    const s = setup();
    const original = s.store.finalize.bind(s.store);
    s.store.finalize = async (intent, control) => {
      const receipt = await original(intent, control);
      if (intent.terminal.state === 'completed') {
        const consent = s.store.snapshots.get(s.input.sessionId);
        if (!consent) throw new Error();
        // Another invocation may be active once completion atomically released ours.
        s.store.snapshots.set(s.input.sessionId, {
          ...consent,
          activeInvocationId: uuid2,
          revoked: true,
        });
      }
      return receipt;
    };
    const o = await consult(s.input, s.dependencies);
    expect(o).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'consent_revoked' } },
      cleanup: { status: 'confirmed' },
    });
    expect(s.store.snapshots.get(s.input.sessionId)?.activeInvocationId).toBe(uuid2);
    expect(
      s.store.attempts.get(s.store.key(s.input.sessionId, s.input.brief.requestId))?.state,
    ).toBe('delivery-unknown');
    expect(s.store.finalizeCalls).toBe(2);
  });
  it('postcommit checks accept own completed record while another owner is busy', async () => {
    const s = setup();
    const original = s.store.finalize.bind(s.store);
    s.store.finalize = async (intent, control) => {
      const receipt = await original(intent, control);
      if (intent.terminal.state === 'completed') {
        const consent = s.store.snapshots.get(s.input.sessionId);
        if (!consent) throw new Error();
        s.store.snapshots.set(s.input.sessionId, { ...consent, activeInvocationId: uuid2 });
      }
      return receipt;
    };
    expect(await consult(s.input, s.dependencies)).toMatchObject({ status: 'ready' });
    expect(s.store.snapshots.get(s.input.sessionId)?.activeInvocationId).toBe(uuid2);
  });
  it('zero queue same-session busy and duplicate/cap remain permanently enforced', async () => {
    const s = setup();
    const p = deferred<EvaluationOutcome>();
    s.provider.handler = async (plan, c) => {
      await c.beforeDispatch();
      return p.promise.then(() => evaluation(plan));
    };
    const first = consult(s.input, s.dependencies);
    await flush();
    const secondInput = {
      ...s.input,
      brief: { ...s.input.brief, requestId: 'second' },
      invocationId: uuid2,
    };
    const second = await consult(secondInput, s.dependencies);
    expect(second).toMatchObject({
      status: 'error',
      outcome: { error: { code: 'session_busy' } },
      cleanup: { status: 'not-required' },
    });
    expect(s.provider.calls).toBe(1);
    s.controller.abort();
    await flush();
    await first;
    expect(
      await consult({ ...s.input, signal: new AbortController().signal }, s.dependencies),
    ).toMatchObject({ status: 'error', outcome: { error: { code: 'request_already_admitted' } } });
    const consent = s.store.snapshots.get(s.input.sessionId);
    if (!consent) throw new Error();
    s.store.snapshots.set(s.input.sessionId, { ...consent, maxCalls: 1 });
    expect(
      await consult({ ...secondInput, signal: new AbortController().signal }, s.dependencies),
    ).toMatchObject({ status: 'error', outcome: { error: { code: 'session_call_limit' } } });
    p.reject(new Error('late'));
    await flush();
  });
  it('independent sessions finish reversed with isolated preparation and ownership', async () => {
    const s = setup();
    const otherConsent = session(s.clock, 'c'.repeat(32));
    const store = new FakeSessions(s.clock, session(s.clock), otherConsent);
    const one = deferred<EvaluationOutcome>();
    const two = deferred<EvaluationOutcome>();
    let calls = 0;
    s.provider.handler = async (plan, c) => {
      const slot = calls++ === 0 ? one : two;
      await c.beforeDispatch();
      return slot.promise.then(() => evaluation(plan));
    };
    const first = consult(s.input, { ...s.dependencies, sessions: store });
    const secondInput = { ...s.input, sessionId: otherConsent.sessionId, invocationId: uuid2 };
    const second = consult(secondInput, { ...s.dependencies, sessions: store });
    await flush();
    two.resolve({
      ok: false,
      error: failure('missing_key', 'configuration'),
      usage: null,
      metadata: { origin: 'test-fixture', attempts: 0, requestId: null, httpStatus: null },
    });
    await flush();
    const b = await second;
    expect(b.status).toBe('ready');
    one.resolve({
      ok: false,
      error: failure('missing_key', 'configuration'),
      usage: null,
      metadata: { origin: 'test-fixture', attempts: 0, requestId: null, httpStatus: null },
    });
    const a = await first;
    expect(a.status).toBe('ready');
    if (a.status === 'ready' && b.status === 'ready') {
      expect(a.result.sessionId).not.toBe(b.result.sessionId);
      expect(a.completion.invocationId).toBe(uuid);
      expect(b.completion.invocationId).toBe(uuid2);
      expect(a.prepared.copyBytes()).not.toEqual(b.prepared.copyBytes());
    }
    expect(s.clock.timers.size).toBe(0);
  });
});
