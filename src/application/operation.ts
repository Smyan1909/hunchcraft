import type { Clock, OperationStart } from '../ports/clock.js';
import type { ErrorStage, Failure, Validation } from '../core/result.js';
import { classifiedFailure, failure, valid } from '../core/result.js';
import { epoch, numeric } from '../core/value.js';

export interface Operation {
  readonly signal: AbortSignal;
  remainingMs(this: void): number;
  checkpoint(stage: ErrorStage): Validation<OperationStart>;
  /** Invocation-local exactly-once dispatch claim; never resets on another consult. */
  claimDispatch(): Validation<OperationStart>;
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
  const start = Object.freeze({
    monotonicMs: numeric(startedAt.monotonicMs),
    wallTimeMs: epoch(startedAt.wallTimeMs),
  });
  const controller = new AbortController();
  let last = start;
  let cause: Failure | null = null;
  let disposed = false;
  let dispatchClaimed = false;
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
        fail(failure('clock_inconsistent', 'internal'));
      else {
        last = current;
        if (current.monotonicMs - start.monotonicMs >= 15000)
          fail(failure('operation_deadline', stage));
      }
    } catch {
      fail(failure('clock_inconsistent', 'internal'));
    }
    return cause ? { ok: false, error: cause } : valid(last);
  };
  const abort = (): void => {
    fail(failure('operation_cancelled', 'internal'));
  };
  try {
    caller.addEventListener('abort', abort, { once: true });
  } catch {
    fail(failure('internal_failure', 'internal'));
  }
  const initial = checkpoint('input');
  try {
    if (initial.ok)
      cancelTimer = clock.schedule(
        Math.max(0, 15000 - (initial.value.monotonicMs - start.monotonicMs)),
        () => {
          checkpoint('internal');
        },
      );
  } catch {
    fail(failure('internal_failure', 'internal'));
  }
  const remainingMs = (): number => {
    const c = checkpoint('internal');
    return c.ok ? Math.max(0, 15000 - (c.value.monotonicMs - start.monotonicMs)) : 0;
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
        try {
          controller.signal.removeEventListener('abort', interrupted);
        } catch {
          if (value.ok) value = { ok: false, error: failure('internal_failure', 'internal') };
          fail(failure('internal_failure', 'internal'));
        }
        resolve(value);
      };
      const interrupted = (): void => {
        finish({ ok: false, error: cause ?? failure('internal_failure', 'internal') });
      };
      const rejected = (error: unknown): void => {
        const after = checkpoint(stage);
        if (!after.ok) finish(after);
        else {
          // A dependency rejection is an outcome, not the operation's lifetime.
          // Keep the original deadline live for emitting a sanitized error.
          finish({
            ok: false,
            error: classifiedFailure(error) ?? failure('internal_failure', 'internal'),
          });
        }
      };
      try {
        controller.signal.addEventListener('abort', interrupted, { once: true });
        const promise = start(controller.signal);
        promise
          .then((value) => {
            const after = checkpoint(stage);
            finish(after.ok ? valid(value) : after);
          }, rejected)
          .catch(() => {
            finish({ ok: false, error: failure('internal_failure', 'internal') });
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
    claimDispatch: (): Validation<OperationStart> => {
      const current = checkpoint('provider');
      if (!current.ok) return current;
      if (dispatchClaimed) {
        fail(failure('internal_failure', 'internal'));
        return { ok: false, error: cause ?? failure('internal_failure', 'internal') };
      }
      dispatchClaimed = true;
      return current;
    },
    wait,
    fail,
    dispose: (): void => {
      if (disposed) return;
      disposed = true;
      try {
        cancelTimer();
      } catch {
        cause ??= failure('internal_failure', 'internal');
      }
      try {
        caller.removeEventListener('abort', abort);
      } catch {
        cause ??= failure('internal_failure', 'internal');
      }
      controller.abort();
    },
  });
}
