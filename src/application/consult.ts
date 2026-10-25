import { parseBrief } from '../core/brief.js';
import { compileChecks } from '../core/checks.js';
import type {
  ErrorOutcome,
  EvaluationMetadata,
  Failure,
  InternalJudgment,
  Usage,
  Validation,
} from '../core/result.js';
import {
  ClassifiedFailure,
  classifiedFailure,
  createJudgment,
  failure,
  failureEnvelope,
  progressConsistent,
  reconstructEvaluationOutcome,
  reconstructProgress,
  validateJudgmentBinding,
} from '../core/result.js';
import type { DecisionProvider } from '../ports/decision-provider.js';
import type { Operation } from './operation.js';

export interface ConsultInput {
  readonly bytes: string | Uint8Array;
  /** Borrowed from before input reading. Caller checkpoints output and disposes finally. */
  readonly operation: Operation;
}
export interface ConsultDependencies {
  readonly provider: DecisionProvider;
}
export type ConsultationOutcome =
  | Readonly<{ status: 'ready'; result: InternalJudgment }>
  | Readonly<{ status: 'error'; failure: Failure; outcome: ErrorOutcome }>;
function requireValue<T>(value: Validation<T>): T {
  if (!value.ok) throw new ClassifiedFailure(value.error);
  return value.value;
}
/** One supplied document, one dispatch. No persistence, retry or per-consult deadline reset. */
export async function consult(
  input: ConsultInput,
  dependencies: ConsultDependencies,
): Promise<ConsultationOutcome> {
  const op = input.operation;
  let intake = true;
  let guardEntered = false;
  let guardSucceeded = false;
  let progress: Readonly<{ metadata: EvaluationMetadata; usage: Usage | null }> | null = null;
  try {
    requireValue(op.checkpoint('input'));
    const parsed = parseBrief(input.bytes);
    if (!parsed.ok)
      throw new ClassifiedFailure(
        failure(
          parsed.error.code,
          parsed.error.code === 'check_budget_exceeded' ? 'compile' : 'input',
        ),
      );
    const compilation = compileChecks(parsed.value);
    if (!compilation.ok) throw new ClassifiedFailure(failure(compilation.error.code, 'compile'));
    const plan = compilation.value;
    requireValue(op.checkpoint('compile'));
    const origin = dependencies.provider.origin;
    if (origin !== 'test-fixture' && origin !== 'provider-http') throw new Error();
    progress = Object.freeze({
      metadata: Object.freeze({ origin, attempts: 0, requestId: null, httpStatus: null }),
      usage: null,
    });
    const beforeDispatch = (): Promise<void> => {
      try {
        requireValue(op.checkpoint('provider'));
        if (!intake || guardEntered)
          throw new ClassifiedFailure(failure('internal_failure', 'internal'));
        guardEntered = true;
        requireValue(op.claimDispatch());
        guardSucceeded = true;
        return Promise.resolve();
      } catch (error) {
        const cause = classifiedFailure(error) ?? failure('internal_failure', 'internal');
        op.fail(cause);
        return Promise.reject(new ClassifiedFailure(cause));
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
    const raw = requireValue(
      await op.wait('provider', (signal) =>
        dependencies.provider.evaluate(
          plan,
          plan.state,
          Object.freeze({ signal, remainingMs: op.remainingMs, beforeDispatch, onProgress }),
        ),
      ),
    );
    requireValue(op.checkpoint('response'));
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
    requireValue(op.checkpoint('response'));
    if (!rebuilt.ok) throw new ClassifiedFailure(rebuilt.error);
    const result = requireValue(createJudgment({ plan, evaluation: rebuilt.value }));
    requireValue(validateJudgmentBinding(result, plan));
    requireValue(op.checkpoint('output'));
    return Object.freeze({ status: 'ready', result });
  } catch (error) {
    let cause = classifiedFailure(error) ?? failure('internal_failure', 'internal');
    const current = op.checkpoint('internal');
    if (!current.ok) cause = current.error;
    // Do not fail the borrowed operation on an ordinary error: caller still owns
    // bounded emission of the sanitized failure. Deadline/cancellation remain live.
    const projected = failureEnvelope(
      cause,
      progress?.metadata.origin === 'test-fixture' ? null : progress,
    );
    const outcome = projected.ok
      ? projected.value
      : requireValue(failureEnvelope(failure('internal_failure', 'internal')));
    if (!projected.ok) cause = failure('internal_failure', 'internal');
    return Object.freeze({ status: 'error', failure: cause, outcome });
  } finally {
    intake = false;
  }
}
