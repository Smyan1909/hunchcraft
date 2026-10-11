import type { Brief } from '../core/brief.js';
import {
  compileChecks,
  CHECK_SET_ID,
  EXECUTION_POLICY_VERSION,
  REQUESTED_MODEL,
} from '../core/checks.js';
import { identityBytes } from '../core/identity.js';
import type {
  AdmissionInput,
  ConsentSnapshot,
  FinalizationInput,
  FinalizationReceipt,
  RepoObservation,
  Reservation,
  SessionRead,
  Terminal,
} from '../core/consent.js';
import {
  checkConsent,
  checkScope,
  completionTimes,
  invocationId,
  reconstructAdmissionInput,
  reconstructFinalizationInput,
  reconstructFinalizationReceipt,
  reconstructRepoObservation,
  reconstructReservation,
  reconstructSessionRead,
  repoBindingBytes,
} from '../core/consent.js';
import type {
  ErrorOutcome,
  ErrorStage,
  EvaluationMetadata,
  Failure,
  InternalJudgment,
  PreparedDelivery,
  Usage,
  Validation,
} from '../core/result.js';
import {
  ClassifiedFailure,
  classifiedFailure,
  createJudgment,
  failure,
  isPreparedDelivery,
  progressConsistent,
  reconstructEvaluationOutcome,
  reconstructFailure,
  reconstructProgress,
} from '../core/result.js';
import { hex, identifier, numeric, record } from '../core/value.js';
import type { Clock, OperationStart } from '../ports/clock.js';
import type { DecisionProvider } from '../ports/decision-provider.js';
import type { SessionConsent, StoreControl } from '../ports/session-consent.js';
import { createOperation } from './operation.js';
import type { Operation } from './operation.js';

export interface ConsultInput {
  readonly brief: Brief;
  readonly inputBytes: number;
  readonly sessionId: string;
  readonly repo: RepoObservation;
  readonly invocationId: string;
  readonly startedAt: OperationStart;
  readonly signal: AbortSignal;
}
export interface ConsultDependencies {
  readonly provider: DecisionProvider;
  readonly sessions: SessionConsent;
  readonly clock: Clock;
  readonly sha256: (bytes: Uint8Array) => Promise<string>;
  readonly prepareDelivery: (result: InternalJudgment) => Promise<Validation<PreparedDelivery>>;
}
export type Cleanup = Readonly<{
  status: 'not-required' | 'confirmed' | 'unconfirmed';
  error: Failure | null;
}>;
export type M1bConsultationOutcome =
  | Readonly<{
      status: 'ready';
      result: InternalJudgment;
      prepared: PreparedDelivery;
      completion: FinalizationReceipt;
      cleanup: Readonly<{ status: 'confirmed'; error: null }>;
    }>
  | Readonly<{ status: 'error'; outcome: ErrorOutcome; cleanup: Cleanup }>;

function requireValue<T>(value: Validation<T>): T {
  if (!value.ok) throw new ClassifiedFailure(value.error);
  return value.value;
}
/** A typed port union is still unknown at consumption. Only closed fields are read. */
function portValue<T>(value: unknown, rebuild: (value: unknown) => Validation<T>): T {
  try {
    const discriminant = Object.getOwnPropertyDescriptor(value, 'ok');
    if (discriminant?.value === true)
      return requireValue(rebuild(record(value, ['ok', 'value']).value));
    const v = record(value, ['ok', 'error']);
    if (v.ok !== false) throw new Error();
    const f = requireValue(reconstructFailure(v.error));
    throw new ClassifiedFailure(f);
  } catch (error) {
    const classified = classifiedFailure(error);
    if (classified) throw new ClassifiedFailure(classified);
    throw new ClassifiedFailure(failure('local_io', 'consent'));
  }
}
function acknowledgment(
  receipt: FinalizationReceipt,
  intent: FinalizationInput,
  requirePersisted: boolean,
): void {
  const { disposition, ...owner } = receipt;
  if (
    JSON.stringify(owner) !== JSON.stringify(intent) ||
    (requirePersisted && disposition !== 'persisted')
  )
    throw new ClassifiedFailure(failure('local_io', 'consent'));
}
async function cleanupIntent(
  intent: FinalizationInput,
  dependencies: ConsultDependencies,
  admissionConfirmed: boolean,
): Promise<Cleanup> {
  const controller = new AbortController();
  let cancel: () => void = () => {};
  let start: number;
  try {
    start = numeric(dependencies.clock.monotonicMs());
  } catch {
    return { status: 'unconfirmed', error: failure('clock_inconsistent', 'internal') };
  }
  let last = start;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (cleanup: Cleanup): void => {
      if (settled) return;
      settled = true;
      try {
        cancel();
      } catch {
        cleanup = { status: 'unconfirmed', error: failure('local_io', 'consent') };
      }
      controller.abort();
      resolve(Object.freeze(cleanup));
    };
    const remainingMs = (): number => {
      try {
        const now = numeric(dependencies.clock.monotonicMs());
        if (now < last) throw new Error();
        last = now;
        return Math.max(0, 1000 - (now - start));
      } catch {
        finish({ status: 'unconfirmed', error: failure('clock_inconsistent', 'internal') });
        return 0;
      }
    };
    try {
      cancel = dependencies.clock.schedule(1000, () =>
        finish({ status: 'unconfirmed', error: failure('operation_deadline', 'consent') }),
      );
      const owned = requireValue(reconstructFinalizationInput(intent));
      const promise = dependencies.sessions.finalize(owned, {
        signal: controller.signal,
        remainingMs,
      });
      promise
        .then(
          (value) => {
            if (settled) return;
            try {
              if (remainingMs() === 0) {
                finish({ status: 'unconfirmed', error: failure('operation_deadline', 'consent') });
                return;
              }
              const receipt = portValue(value, reconstructFinalizationReceipt);
              acknowledgment(receipt, intent, admissionConfirmed);
              finish({ status: 'confirmed', error: null });
            } catch (error) {
              finish({
                status: 'unconfirmed',
                error: classifiedFailure(error) ?? failure('local_io', 'consent'),
              });
            }
          },
          () => finish({ status: 'unconfirmed', error: failure('local_io', 'consent') }),
        )
        .catch(() => finish({ status: 'unconfirmed', error: failure('local_io', 'consent') }));
    } catch {
      finish({ status: 'unconfirmed', error: failure('local_io', 'consent') });
    }
  });
}

export async function consult(
  input: ConsultInput,
  dependencies: ConsultDependencies,
): Promise<M1bConsultationOutcome> {
  let operation: Operation | undefined;
  let admission: AdmissionInput | undefined;
  let admissionInvoked = false;
  let admissionConfirmed = false;
  let definiteDenial = false;
  let completionIntent: FinalizationInput | undefined;
  let intake = true;
  let guardEntered = false;
  let guardSucceeded = false;
  let progress: Readonly<{ metadata: EvaluationMetadata; usage: Usage | null }> | null = null;
  let sessionId: string | null = null;
  let requestId: string | null = null;
  try {
    sessionId = hex(input.sessionId, 32);
    invocationId(input.invocationId);
    numeric(input.inputBytes, 48 * 1024, true, 1);
    requestId = identifier(input.brief.requestId);
    identifier(input.brief.scopeId);
    const repo = requireValue(reconstructRepoObservation(input.repo));
    const origin = dependencies.provider.origin;
    if (origin !== 'test-fixture' && origin !== 'provider-http') throw new Error();
    progress = Object.freeze({
      metadata: Object.freeze({ origin, attempts: 0, requestId: null, httpStatus: null }),
      usage: null,
    });
    operation = createOperation(dependencies.clock, input.startedAt, input.signal);
    const op = operation;
    const checkpoint = (stage: ErrorStage): OperationStart => requireValue(op.checkpoint(stage));
    const wait = async <T>(
      stage: ErrorStage,
      start: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> => requireValue(await op.wait(stage, start));
    const control = (signal: AbortSignal): StoreControl =>
      Object.freeze({ signal, remainingMs: op.remainingMs });
    const entry = checkpoint('input');
    const compilation = compileChecks(input.brief);
    if (!compilation.ok) throw new ClassifiedFailure(failure(compilation.error.code, 'compile'));
    const plan = compilation.value;
    checkpoint('compile');
    const sourceDigest = hex(
      await wait('compile', () => dependencies.sha256(identityBytes(input.brief, plan))),
      64,
    );
    const compiledAt = checkpoint('compile');
    const read = portValue(
      await wait('consent', (signal) =>
        dependencies.sessions.read(sessionId ?? '', control(signal)),
      ),
      reconstructSessionRead,
    );
    if (read.attempt !== null) throw new ClassifiedFailure(failure('local_io', 'consent'));
    const expectation = (generation: number | null) =>
      Object.freeze({
        sessionId: sessionId ?? '',
        scopeId: input.brief.scopeId,
        repo,
        expectedGeneration: generation,
      });
    const initialConsent = requireValue(
      checkConsent(read.consent, expectation(null), checkpoint('consent').wallTimeMs),
    );
    requireValue(checkScope(input.brief, initialConsent.scope));
    const repoBinding = hex(
      await wait('consent', () => dependencies.sha256(repoBindingBytes(initialConsent))),
      64,
    );
    admission = requireValue(
      reconstructAdmissionInput({
        sessionId,
        requestId,
        invocationId: input.invocationId,
        scopeId: input.brief.scopeId,
        sourceDigest,
        repoBinding,
        repo,
        expectedGeneration: initialConsent.generation,
        checkSetId: CHECK_SET_ID,
        policyVersion: EXECUTION_POLICY_VERSION,
        requestedModel: REQUESTED_MODEL,
      }),
    );
    const ownedAdmission = admission;
    const admitted = await wait('consent', (signal) => {
      admissionInvoked = true;
      return dependencies.sessions.admit(ownedAdmission, control(signal));
    });
    // Only a valid, settled negative union is a definite admission denial.
    try {
      const d = Object.getOwnPropertyDescriptor(admitted, 'ok');
      if (d?.value === false) {
        const v = record(admitted, ['ok', 'error']);
        const f = reconstructFailure(v.error);
        if (f.ok) {
          definiteDenial = true;
          throw new ClassifiedFailure(f.value);
        }
      }
    } catch (error) {
      const classified = classifiedFailure(error);
      if (classified) throw new ClassifiedFailure(classified);
    }
    const reservation: Reservation = portValue(admitted, reconstructReservation);
    if (JSON.stringify(reservation.admission) !== JSON.stringify(ownedAdmission))
      throw new ClassifiedFailure(failure('local_io', 'consent'));
    // A closed matching reservation confirms ownership even if subsequent live
    // consent/snapshot checks fail. Cleanup can no longer acknowledge no admission.
    admissionConfirmed = true;
    const admittedAt = checkpoint('consent');
    requireValue(
      checkConsent(
        reservation.consent,
        expectation(ownedAdmission.expectedGeneration),
        admittedAt.wallTimeMs,
      ),
    );
    requireValue(checkScope(input.brief, reservation.consent.scope));
    if (
      reservation.consent.activeInvocationId !== input.invocationId ||
      reservation.consent.attemptsUsed !== initialConsent.attemptsUsed + 1 ||
      reservation.consent.salt !== initialConsent.salt ||
      reservation.consent.createdAtMs !== initialConsent.createdAtMs ||
      reservation.consent.expiresAtMs !== initialConsent.expiresAtMs ||
      JSON.stringify(reservation.consent.scope) !== JSON.stringify(initialConsent.scope)
    )
      throw new ClassifiedFailure(failure('local_io', 'consent'));
    const checkReservation = async (active: boolean): Promise<ConsentSnapshot> => {
      const current: SessionRead = portValue(
        await wait('consent', (signal) =>
          dependencies.sessions.check(reservation, control(signal)),
        ),
        reconstructSessionRead,
      );
      const now = checkpoint('consent');
      const consent = requireValue(
        checkConsent(
          current.consent,
          expectation(ownedAdmission.expectedGeneration),
          now.wallTimeMs,
        ),
      );
      requireValue(checkScope(input.brief, consent.scope));
      if (
        consent.salt !== initialConsent.salt ||
        consent.createdAtMs !== initialConsent.createdAtMs ||
        consent.expiresAtMs !== initialConsent.expiresAtMs ||
        JSON.stringify(consent.scope) !== JSON.stringify(initialConsent.scope)
      )
        throw new ClassifiedFailure(failure('scope_mismatch', 'consent'));
      const attempt = current.attempt;
      if (
        !attempt ||
        attempt.requestId !== requestId ||
        attempt.invocationId !== input.invocationId ||
        attempt.sourceDigest !== sourceDigest ||
        (active
          ? attempt.state !== 'active' || consent.activeInvocationId !== input.invocationId
          : attempt.state !== 'completed')
      )
        throw new ClassifiedFailure(failure('local_io', 'consent'));
      if (
        !active &&
        completionIntent &&
        (attempt.completedAtMs !== completionIntent.terminal.completedAtMs ||
          attempt.resultExpiresAtMs !== completionIntent.terminal.resultExpiresAtMs)
      )
        throw new ClassifiedFailure(failure('local_io', 'consent'));
      return consent;
    };
    const beforeDispatch = async (): Promise<void> => {
      if (!intake || guardEntered) {
        const f = failure('internal_failure', 'internal');
        op.fail(f);
        throw new ClassifiedFailure(f);
      }
      guardEntered = true;
      try {
        checkpoint('provider');
        await checkReservation(true);
        checkpoint('provider');
        guardSucceeded = true;
      } catch (error) {
        const f = classifiedFailure(error) ?? failure('internal_failure', 'internal');
        op.fail(f);
        throw new ClassifiedFailure(f);
      }
    };
    const onProgress = (value: unknown): void => {
      if (!intake || !op.checkpoint('provider').ok) return;
      const next = reconstructProgress(value);
      if (
        !next.ok ||
        !progress ||
        !progressConsistent(progress, next.value) ||
        (next.value.metadata.attempts === 1 && !guardSucceeded)
      ) {
        op.fail(failure('internal_failure', 'internal'));
        return;
      }
      progress = next.value;
    };
    const providerStart = checkpoint('provider');
    const raw = await wait('provider', (signal) =>
      dependencies.provider.evaluate(
        plan,
        plan.state,
        Object.freeze({ signal, remainingMs: op.remainingMs, beforeDispatch, onProgress }),
      ),
    );
    const providerEnd = checkpoint('response');
    const rebuilt = requireValue(reconstructEvaluationOutcome(raw, plan, origin));
    const finalProgress = rebuilt.ok
      ? { metadata: rebuilt.value.metadata, usage: rebuilt.value.usage }
      : { metadata: rebuilt.metadata, usage: rebuilt.usage };
    if (
      !progress ||
      !progressConsistent(progress, finalProgress) ||
      ((rebuilt.ok || finalProgress.metadata.attempts === 1) && !guardSucceeded)
    )
      throw new ClassifiedFailure(failure('internal_failure', 'internal'));
    progress = Object.freeze(finalProgress);
    checkpoint('response');
    if (!rebuilt.ok) throw new ClassifiedFailure(rebuilt.error);
    const validatedAt = checkpoint('response');
    const finalConsent = await checkReservation(true);
    const constructedAt = checkpoint('consent');
    const freshness = requireValue(completionTimes(finalConsent, constructedAt.wallTimeMs));
    const result = requireValue(
      createJudgment({
        input: input.brief,
        plan,
        evaluation: rebuilt.value,
        sessionId: sessionId ?? '',
        sourceIdentity: { version: 'hunchcraft.identity.v0', digest: sourceDigest, repoBinding },
        freshness,
        timing: {
          inputMs: entry.monotonicMs - input.startedAt.monotonicMs,
          compileMs: compiledAt.monotonicMs - entry.monotonicMs,
          admissionMs: admittedAt.monotonicMs - compiledAt.monotonicMs,
          providerMs: providerEnd.monotonicMs - providerStart.monotonicMs,
          validationMs: validatedAt.monotonicMs - providerEnd.monotonicMs,
          totalMs: constructedAt.monotonicMs - input.startedAt.monotonicMs,
        },
      }),
    );
    checkpoint('output');
    const preparedUnion = await wait('output', () => dependencies.prepareDelivery(result));
    const prepared = portValue(preparedUnion, (value) =>
      isPreparedDelivery(value)
        ? { ok: true, value }
        : { ok: false, error: failure('internal_failure', 'internal') },
    );
    const afterPreparation = await checkReservation(true);
    const ensureTime = (): void => {
      const now = checkpoint('output').wallTimeMs;
      const completedMs = Date.parse(freshness.completedAt);
      const expiryMs = Date.parse(freshness.expiresAt);
      if (now < completedMs - 1000)
        throw new ClassifiedFailure(failure('clock_inconsistent', 'internal'));
      if (now >= expiryMs) throw new ClassifiedFailure(failure('result_expired', 'freshness'));
    };
    if (
      Math.min(afterPreparation.expiresAtMs, Date.parse(freshness.completedAt) + 60000) !==
      Date.parse(freshness.expiresAt)
    )
      throw new ClassifiedFailure(failure('scope_mismatch', 'consent'));
    ensureTime();
    const intent = requireValue(
      reconstructFinalizationInput({
        sessionId,
        requestId,
        invocationId: input.invocationId,
        sourceDigest,
        terminal: {
          state: 'completed',
          completedAtMs: Date.parse(freshness.completedAt),
          resultExpiresAtMs: Date.parse(freshness.expiresAt),
        },
      }),
    );
    const receiptRaw = await wait('consent', (signal) => {
      completionIntent = intent;
      return dependencies.sessions.finalize(intent, control(signal));
    });
    const completion = portValue(receiptRaw, reconstructFinalizationReceipt);
    acknowledgment(completion, intent, true);
    await checkReservation(false);
    ensureTime();
    checkpoint('output');
    intake = false;
    return Object.freeze({
      status: 'ready',
      result,
      prepared,
      completion,
      cleanup: Object.freeze({ status: 'confirmed', error: null }),
    });
  } catch (error) {
    intake = false;
    let cause = classifiedFailure(error) ?? failure('internal_failure', 'internal');
    if (operation) {
      const c = operation.checkpoint('internal');
      if (!c.ok) cause = c.error;
      else operation.fail(cause);
    }
    operation?.dispose();
    let cleanup: Cleanup = Object.freeze({ status: 'not-required', error: null });
    if (admissionInvoked && !definiteDenial && admission) {
      const terminal: Terminal =
        completionIntent && completionIntent.terminal.state === 'completed'
          ? { ...completionIntent.terminal, state: 'delivery-unknown' }
          : {
              state:
                cause.status === 'timeout'
                  ? 'timeout'
                  : cause.status === 'cancelled'
                    ? 'cancelled'
                    : cause.status === 'unavailable'
                      ? 'unavailable'
                      : 'failed',
              completedAtMs: null,
              resultExpiresAtMs: null,
            };
      const intent = requireValue(
        reconstructFinalizationInput({
          sessionId: admission.sessionId,
          requestId: admission.requestId,
          invocationId: admission.invocationId,
          sourceDigest: admission.sourceDigest,
          terminal,
        }),
      );
      cleanup = await cleanupIntent(intent, dependencies, admissionConfirmed);
    }
    const outcome: ErrorOutcome = Object.freeze({
      schemaVersion: 'hunchcraft.v0',
      kind: 'error',
      status: cause.status,
      requestId,
      sessionId,
      error: cause,
      provider: progress,
    });
    return Object.freeze({ status: 'error', outcome, cleanup });
  } finally {
    intake = false;
    operation?.dispose();
  }
}
