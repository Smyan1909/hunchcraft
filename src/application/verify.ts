import type { Brief } from '../core/brief.js';
import { compileChecks } from '../core/checks.js';
import { identityBytes } from '../core/identity.js';
import type { RepoObservation, SessionRead } from '../core/consent.js';
import {
  checkConsent,
  checkScope,
  reconstructRepoObservation,
  reconstructSessionRead,
  repoBindingBytes,
} from '../core/consent.js';
import type { ErrorOutcome, SourceIdentity, Validation } from '../core/result.js';
import {
  ClassifiedFailure,
  classifiedFailure,
  failure,
  parseCompletedJudgment,
  reconstructFailure,
  reconstructInternalJudgment,
  validateJudgmentBinding,
} from '../core/result.js';
import { hex, identifier, numeric, record } from '../core/value.js';
import type { Clock, OperationStart } from '../ports/clock.js';
import type { SessionConsent } from '../ports/session-consent.js';
import { createOperation } from './operation.js';
import type { Operation } from './operation.js';

export interface VerifyInput {
  readonly brief: Brief;
  readonly inputBytes: number;
  readonly sessionId: string;
  readonly repo: RepoObservation;
  readonly startedAt: OperationStart;
  readonly signal: AbortSignal;
  readonly result:
    | Readonly<{ format: 'internal'; value: unknown }>
    | Readonly<{ format: 'completed-json'; bytes: string | Uint8Array }>;
}
export interface VerifyDependencies {
  readonly sessions: SessionConsent;
  readonly clock: Clock;
  readonly sha256: (bytes: Uint8Array) => Promise<string>;
}
export type VerificationOutcome =
  | ErrorOutcome
  | Readonly<{
      schemaVersion: 'hunchcraft.v0';
      kind: 'verification';
      status: 'applicable-to-supplied-snapshot';
      requestId: string;
      sessionId: string;
      sourceIdentity: SourceIdentity;
      limitations: readonly [
        'caller-supplied-evidence',
        'host-state-not-observed',
        'not-an-action-authorization',
      ];
    }>;
function requireValue<T>(v: Validation<T>): T {
  if (!v.ok) throw new ClassifiedFailure(v.error);
  return v.value;
}
function readValue(value: unknown): SessionRead {
  try {
    const d = Object.getOwnPropertyDescriptor(value, 'ok');
    if (d?.value === true)
      return requireValue(reconstructSessionRead(record(value, ['ok', 'value']).value));
    const v = record(value, ['ok', 'error']);
    if (v.ok !== false) throw new Error();
    throw new ClassifiedFailure(requireValue(reconstructFailure(v.error)));
  } catch (error) {
    const classified = classifiedFailure(error);
    if (classified) throw new ClassifiedFailure(classified);
    throw new ClassifiedFailure(failure('local_io', 'consent'));
  }
}
export async function verify(
  input: VerifyInput,
  dependencies: VerifyDependencies,
): Promise<VerificationOutcome> {
  let operation: Operation | undefined;
  let sessionId: string | null = null;
  let requestId: string | null = null;
  try {
    sessionId = hex(input.sessionId, 32);
    requestId = identifier(input.brief.requestId);
    identifier(input.brief.scopeId);
    numeric(input.inputBytes, 48 * 1024, true, 1);
    const repo = requireValue(reconstructRepoObservation(input.repo));
    operation = createOperation(dependencies.clock, input.startedAt, input.signal);
    const op = operation;
    const checkpoint = (): OperationStart => requireValue(op.checkpoint('freshness'));
    checkpoint();
    const result = requireValue(
      input.result.format === 'internal'
        ? reconstructInternalJudgment(input.result.value)
        : input.result.format === 'completed-json'
          ? parseCompletedJudgment(input.result.bytes)
          : { ok: false, error: failure('invalid_input', 'input') },
    );
    checkpoint();
    const compilation = compileChecks(input.brief);
    if (!compilation.ok) throw new ClassifiedFailure(failure(compilation.error.code, 'compile'));
    const plan = compilation.value;
    checkpoint();
    requireValue(validateJudgmentBinding(result, input.brief, plan));
    if (result.sessionId !== sessionId)
      throw new ClassifiedFailure(failure('source_mismatch', 'freshness'));
    const digest = hex(
      requireValue(
        await op.wait('freshness', () => dependencies.sha256(identityBytes(input.brief, plan))),
      ),
      64,
    );
    const read = async (): Promise<SessionRead> =>
      readValue(
        requireValue(
          await op.wait('freshness', (signal) =>
            dependencies.sessions.read(
              sessionId ?? '',
              { signal, remainingMs: op.remainingMs },
              requestId ?? '',
            ),
          ),
        ),
      );
    let generation: number | null = null;
    const check = (current: SessionRead): void => {
      const now = checkpoint().wallTimeMs;
      const consent = checkConsent(
        current.consent,
        {
          sessionId: sessionId ?? '',
          scopeId: input.brief.scopeId,
          repo,
          expectedGeneration: generation,
        },
        now,
      );
      if (!consent.ok)
        throw new ClassifiedFailure(
          consent.error.code === 'clock_inconsistent'
            ? failure('clock_inconsistent', 'freshness')
            : consent.error,
        );
      requireValue(checkScope(input.brief, consent.value.scope));
      generation = consent.value.generation;
      const attempt = current.attempt;
      const completed = Date.parse(result.freshness.completedAt);
      const expiry = Date.parse(result.freshness.expiresAt);
      if (now < completed - 1000 || completed < consent.value.createdAtMs - 1000)
        throw new ClassifiedFailure(failure('clock_inconsistent', 'freshness'));
      if (now >= expiry) throw new ClassifiedFailure(failure('result_expired', 'freshness'));
      if (
        completed > consent.value.expiresAtMs ||
        expiry !== Math.min(consent.value.expiresAtMs, completed + 60000) ||
        !attempt ||
        attempt.requestId !== requestId ||
        attempt.sourceDigest !== digest ||
        attempt.state !== 'completed' ||
        attempt.completedAtMs !== completed ||
        attempt.resultExpiresAtMs !== expiry
      )
        throw new ClassifiedFailure(failure('source_mismatch', 'freshness'));
    };
    const first = await read();
    check(first);
    const binding = hex(
      requireValue(
        await op.wait('freshness', () => dependencies.sha256(repoBindingBytes(first.consent))),
      ),
      64,
    );
    if (digest !== result.sourceIdentity.digest || binding !== result.sourceIdentity.repoBinding)
      throw new ClassifiedFailure(failure('source_mismatch', 'freshness'));
    const final = await read();
    check(final);
    if (
      final.consent.salt !== first.consent.salt ||
      final.consent.createdAtMs !== first.consent.createdAtMs ||
      final.consent.expiresAtMs !== first.consent.expiresAtMs ||
      JSON.stringify(final.consent.scope) !== JSON.stringify(first.consent.scope)
    )
      throw new ClassifiedFailure(failure('scope_mismatch', 'consent'));
    checkpoint();
    return Object.freeze({
      schemaVersion: 'hunchcraft.v0',
      kind: 'verification',
      status: 'applicable-to-supplied-snapshot',
      requestId: requestId ?? '',
      sessionId: sessionId ?? '',
      sourceIdentity: result.sourceIdentity,
      limitations: Object.freeze([
        'caller-supplied-evidence',
        'host-state-not-observed',
        'not-an-action-authorization',
      ] as const),
    });
  } catch (error) {
    let cause = classifiedFailure(error) ?? failure('internal_failure', 'internal');
    const current = operation?.checkpoint('freshness');
    if (current && !current.ok) cause = current.error;
    if (cause.code === 'clock_inconsistent') cause = failure('clock_inconsistent', 'freshness');
    return Object.freeze({
      schemaVersion: 'hunchcraft.v0',
      kind: 'error',
      status: cause.status,
      requestId,
      sessionId,
      error: cause,
      provider: null,
    });
  } finally {
    operation?.dispose();
  }
}
