import type { Clock, OperationStart } from '../ports/clock.js';
import type { ErrorStage, Failure, Validation } from '../core/result.js';
import { classifiedFailure, failure, valid } from '../core/result.js';
import { epoch, numeric } from '../core/value.js';

export interface Operation {
  readonly signal: AbortSignal;
  remainingMs(this: void): number;
  checkpoint(stage: ErrorStage): Validation<OperationStart>;
  wait<T>(stage: ErrorStage, start: (signal: AbortSignal) => Promise<T>): Promise<Validation<T>>;
  fail(error: Failure): void;
  dispose(): void;
}
/** One deadline callback; each wait owns and removes its abort observer. */
export function createOperation(
  clock: Clock,
  startedAt: OperationStart,
  caller: AbortSignal,
): Operation {
  numeric(startedAt.monotonicMs);
  epoch(startedAt.wallTimeMs);
  const controller = new AbortController();
  let last = startedAt;
  let cause: Failure | null = null;
  let disposed = false;
  let cancelTimer: () => void = () => {};
  const fail = (error: Failure): void => {
    if (cause || disposed) return;
    cause = error;
    controller.abort();
  };
  const checkpoint = (stage: ErrorStage): Validation<OperationStart> => {
    if (cause) return { ok: false, error: cause };
    if (disposed) return { ok: false, error: failure('internal_failure', 'internal') };
    if (caller.aborted) fail(failure('operation_cancelled', stage));
    if (cause) return { ok: false, error: cause };
    try {
      const current = Object.freeze({
        monotonicMs: numeric(clock.monotonicMs()),
        wallTimeMs: epoch(clock.wallTimeMs()),
      });
      if (current.monotonicMs < last.monotonicMs || current.wallTimeMs < last.wallTimeMs - 1000)
        fail(failure('clock_inconsistent', stage === 'freshness' ? 'freshness' : 'internal'));
      else {
        last = current;
        if (current.monotonicMs - startedAt.monotonicMs >= 15000)
          fail(failure('operation_deadline', stage));
      }
    } catch {
      fail(failure('clock_inconsistent', stage === 'freshness' ? 'freshness' : 'internal'));
    }
    return cause ? { ok: false, error: cause } : valid(last);
  };
  const abort = (): void => {
    fail(failure('operation_cancelled', 'internal'));
  };
  caller.addEventListener('abort', abort, { once: true });
  const initial = checkpoint('input');
  try {
    if (initial.ok)
      cancelTimer = clock.schedule(
        Math.max(0, 15000 - (initial.value.monotonicMs - startedAt.monotonicMs)),
        () => {
          checkpoint('internal');
        },
      );
  } catch {
    fail(failure('internal_failure', 'internal'));
  }
  const remainingMs = (): number => {
    const c = checkpoint('internal');
    return c.ok ? Math.max(0, 15000 - (c.value.monotonicMs - startedAt.monotonicMs)) : 0;
  };
  const wait = <T>(
    stage: ErrorStage,
    start: (signal: AbortSignal) => Promise<T>,
  ): Promise<Validation<T>> => {
    const before = checkpoint(stage);
    if (!before.ok) return Promise.resolve(before);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: Validation<T>): void => {
        if (settled) return;
        settled = true;
        controller.signal.removeEventListener('abort', interrupted);
        resolve(value);
      };
      const interrupted = (): void => {
        finish({ ok: false, error: cause ?? failure('internal_failure', 'internal') });
      };
      controller.signal.addEventListener('abort', interrupted, { once: true });
      const rejected = (error: unknown): void => {
        const after = checkpoint(stage);
        if (!after.ok) finish(after);
        else {
          fail(classifiedFailure(error) ?? failure('internal_failure', 'internal'));
          interrupted();
        }
      };
      try {
        const promise = start(controller.signal);
        promise
          .then((value) => {
            const after = checkpoint(stage);
            finish(after.ok ? valid(value) : after);
          }, rejected)
          .catch(() => {
            fail(failure('internal_failure', 'internal'));
            interrupted();
          });
      } catch (error) {
        rejected(error);
      }
    });
  };
  return Object.freeze({
    signal: controller.signal,
    remainingMs,
    checkpoint,
    wait,
    fail,
    dispose: (): void => {
      if (disposed) return;
      disposed = true;
      try {
        cancelTimer();
      } catch {
        /* A trusted clock's disposal fault cannot leak a throw. */
      }
      caller.removeEventListener('abort', abort);
      controller.abort();
    },
  });
}
