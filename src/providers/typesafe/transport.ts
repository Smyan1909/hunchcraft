import type { Fetch } from '@typesafe-ai/sdk';
import { ENDPOINT } from '../../core/checks.js';
import type { EvaluationMetadata, Failure, Usage, Validation } from '../../core/result.js';
import {
  ClassifiedFailure,
  classifiedFailure,
  failure,
  invalid,
  valid,
  validateProviderUsage,
} from '../../core/result.js';
import { parseStrictJson } from '../../core/strict-json.js';
import { record } from '../../core/value.js';
import type { Clock } from '../../ports/clock.js';
import type { EvaluationControl } from '../../ports/decision-provider.js';
import type { TypeSafeConfiguration } from './configuration.js';

const MAX_BYTES = 256 * 1024;

/** Observes both losers and elapsed time, including dependencies that ignore abort. */
export async function boundedWait<T>(
  start: () => Promise<T>,
  clock: Clock,
  remainingMs: () => number,
  signals: readonly AbortSignal[],
  late?: (value: T) => void,
): Promise<Validation<T>> {
  let previous = -1;
  const checkpoint = (): void => {
    const now = clock.monotonicMs();
    const remaining = remainingMs();
    if (!Number.isFinite(now) || now < 0 || now < previous || !Number.isFinite(remaining))
      throw new ClassifiedFailure(failure('internal_failure', 'internal'));
    previous = now;
    if (signals.some((s) => s.aborted) || remaining <= 0)
      throw new ClassifiedFailure(failure('provider_connection', 'provider'));
  };
  try {
    checkpoint();
  } catch (error) {
    const recognized = classifiedFailure(error);
    return recognized ? { ok: false, error: recognized } : invalid('internal_failure', 'internal');
  }
  return new Promise((resolve) => {
    let settled = false;
    let cancelTimer = (): void => {};
    const finish = (result: Validation<T>): void => {
      if (settled) return;
      settled = true;
      let cleanupFailed = false;
      try {
        try {
          cancelTimer();
        } catch {
          cleanupFailed = true;
        }
        for (const signal of signals) {
          try {
            signal.removeEventListener('abort', abort);
          } catch {
            // Attempt every removal even when one dependency's disposal fails.
            cleanupFailed = true;
          }
        }
      } finally {
        // Disposal cannot strand settlement or replace an already selected failure.
        resolve(cleanupFailed && result.ok ? invalid('internal_failure', 'internal') : result);
      }
    };
    const abort = (): void => {
      finish(invalid('provider_connection', 'provider'));
    };
    try {
      for (const signal of signals) signal.addEventListener('abort', abort, { once: true });
      cancelTimer = clock.schedule(remainingMs(), abort);
      checkpoint();
      const promise = start();
      promise
        .then(
          (value) => {
            if (settled) {
              try {
                late?.(value);
              } catch {
                /* Never inspect a late external error. */
              }
              return;
            }
            try {
              checkpoint();
              finish(valid(value));
            } catch (error) {
              try {
                late?.(value);
              } catch {
                /* Cleanup is best effort, not a new result. */
              }
              const recognized = classifiedFailure(error);
              finish(
                recognized
                  ? { ok: false, error: recognized }
                  : invalid('internal_failure', 'internal'),
              );
            }
          },
          (error) => {
            const recognized = classifiedFailure(error);
            finish(
              recognized
                ? { ok: false, error: recognized }
                : invalid('provider_connection', 'provider'),
            );
          },
        )
        .catch(() => {
          finish(invalid('internal_failure', 'internal'));
        });
    } catch (error) {
      const recognized = classifiedFailure(error);
      finish(
        recognized ? { ok: false, error: recognized } : invalid('provider_connection', 'provider'),
      );
    }
  });
}

export interface GuardedFetchInput {
  readonly fetch: Fetch;
  readonly clock: Clock;
  readonly configuration: TypeSafeConfiguration;
  readonly body: string;
  readonly control: EvaluationControl;
}
export interface GuardedFetch {
  readonly fetch: Fetch;
  snapshot(): Readonly<{ metadata: EvaluationMetadata; usage: Usage | null }>;
  error(): Failure | null;
  dispose(): Promise<void>;
}

/** One evaluation owns this wrapper and all its observations; it is not a shared client. */
export function createGuardedFetch(input: GuardedFetchInput): GuardedFetch {
  let entered = false;
  let closed = false;
  let marker: Failure | null = null;
  let metadata: EvaluationMetadata = Object.freeze({
    origin: 'provider-http',
    attempts: 0,
    requestId: null,
    httpStatus: null,
  });
  let usage: Usage | null = null;
  const cleanupController = new AbortController();
  const cancellations: Promise<unknown>[] = [];
  let cleanupStart: number | null = null;
  const snapshot = (): Readonly<{ metadata: EvaluationMetadata; usage: Usage | null }> =>
    Object.freeze({ metadata, usage });
  const report = (): void => {
    if (!closed) input.control.onProgress(snapshot());
  };
  const refuse = (error: Failure): never => {
    marker ??= error;
    throw new ClassifiedFailure(marker);
  };
  const cancel = (
    body: ReadableStream<Uint8Array> | null,
    reader?: ReadableStreamDefaultReader<Uint8Array>,
  ): void => {
    try {
      const pending = reader ? reader.cancel() : body?.cancel();
      if (pending) {
        // Observe acknowledgment immediately; disposal waits at most one shared grace.
        const observed = pending.then(
          () => undefined,
          () => undefined,
        );
        if (!closed) {
          cleanupStart ??= input.clock.monotonicMs();
          cancellations.push(observed);
        }
      }
      try {
        reader?.releaseLock();
      } catch {
        /* A pending read retains ownership until settlement. */
      }
    } catch {
      /* A hostile cancel must not replace the primary failure. */
    }
  };
  const fetch: Fetch = async (url, init) => {
    if (entered || closed) return refuse(failure('internal_failure', 'internal'));
    entered = true;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let response: Response | undefined;
    try {
      // The pinned SDK's actual shape is string + these four own RequestInit fields.
      record(init, ['method', 'headers', 'body', 'signal']);
      if (
        url !== `${ENDPOINT}/v1/systemone` ||
        !init ||
        Object.keys(init).length !== 4 ||
        Object.keys(init).some((k) => !['method', 'headers', 'body', 'signal'].includes(k)) ||
        init.method !== 'POST' ||
        init.body !== input.body ||
        !(init.signal instanceof AbortSignal)
      )
        return refuse(failure('configuration_conflict', 'configuration'));
      const headers = new Headers(init.headers);
      const fixed: Readonly<Record<string, string>> = {
        authorization: `Bearer ${input.configuration.apiKey}`,
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'typesafe-sdk/0.6.0',
        'x-typesafe-sdk': 'typesafe-sdk/0.6.0',
        'x-typesafe-runtime': `node/${process.versions.node} (${process.platform}; ${process.arch})`,
      };
      const names = [...headers.keys()];
      if (
        names.length !== 6 ||
        names.some((name) => !Object.hasOwn(fixed, name)) ||
        Object.entries(fixed).some(([name, value]) => headers.get(name) !== value)
      )
        return refuse(failure('configuration_conflict', 'configuration'));
      const attemptSignal = init.signal;
      const signals = [input.control.signal, attemptSignal];
      const wait = <T>(
        start: () => Promise<T>,
        late?: (value: T) => void,
      ): Promise<Validation<T>> =>
        boundedWait(start, input.clock, () => input.control.remainingMs(), signals, late);
      const guard = await wait(() => input.control.beforeDispatch());
      if (!guard.ok) return refuse(guard.error);
      if (marker || closed) return refuse(marker ?? failure('internal_failure', 'internal'));
      // wait checkpoints again before invoking start: a late guard cannot dispatch.
      const receipt = await wait(
        () => {
          metadata = Object.freeze({ ...metadata, attempts: 1 });
          report();
          return input.fetch(url, {
            method: 'POST',
            headers,
            body: input.body,
            signal: attemptSignal,
            redirect: 'error',
          });
        },
        (late) => {
          cancel(late.body);
        },
      );
      if (!receipt.ok) return refuse(receipt.error);
      response = receipt.value;
      const status = response.status;
      if (!Number.isInteger(status) || status < 100 || status > 599)
        return refuse(failure('provider_response_contract', 'response'));
      metadata = Object.freeze({ ...metadata, httpStatus: status });
      const id = response.headers.get('x-typesafe-request-id');
      metadata = Object.freeze({
        ...metadata,
        httpStatus: status,
        requestId: id !== null && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null,
      });
      report();
      if (status >= 300 && status <= 399) return refuse(failure('redirect_refused', 'provider'));
      reader = response.body?.getReader();
      // Allocate one fixed budget, never accumulate a whole overflowing chunk.
      const bytes = new Uint8Array(MAX_BYTES);
      let length = 0;
      if (reader) {
        const ownedReader = reader;
        while (true) {
          const chunk = await wait(() => ownedReader.read());
          if (!chunk.ok) return refuse(chunk.error);
          if (chunk.value.done) break;
          if (chunk.value.value.byteLength > MAX_BYTES - length)
            return refuse(failure('response_too_large', 'response'));
          bytes.set(chunk.value.value, length);
          length += chunk.value.value.byteLength;
        }
        reader.releaseLock();
        reader = undefined;
      }
      const parsed = parseStrictJson(bytes.subarray(0, length), {
        maxBytes: MAX_BYTES,
        maxDepth: 16,
        allowNumericKeys: true,
        numbers: 'finite',
        integerKeys: ['input_tokens', 'output_tokens'],
      });
      // Check elapsed time after bounded synchronous parsing too.
      const checked = await wait(() => Promise.resolve());
      if (!checked.ok) return refuse(checked.error);
      if (marker || closed) return refuse(marker ?? failure('internal_failure', 'internal'));
      if (
        parsed.ok &&
        parsed.value !== null &&
        typeof parsed.value === 'object' &&
        !Array.isArray(parsed.value)
      ) {
        const tokens = validateProviderUsage(
          Object.getOwnPropertyDescriptor(parsed.value, 'usage')?.value as unknown,
        );
        if (tokens.ok) {
          usage = tokens.value;
          report();
        }
      }
      if (status < 200 || status > 299) return refuse(failure('provider_http', 'provider'));
      if (!parsed.ok) return refuse(failure('provider_response_contract', 'response'));
      const safeHeaders = new Headers({ 'content-type': 'application/json' });
      if (metadata.requestId !== null) safeHeaders.set('x-typesafe-request-id', metadata.requestId);
      // SDK clone/tee is now bounded, and cannot see original response prose/headers.
      return new Response(status === 204 || status === 205 ? null : bytes.subarray(0, length), {
        status,
        headers: safeHeaders,
      });
    } catch (error) {
      return refuse(classifiedFailure(error) ?? failure('provider_connection', 'provider'));
    } finally {
      if (marker && response) cancel(response.body, reader);
    }
  };
  return Object.freeze({
    fetch,
    snapshot,
    error: () => marker,
    async dispose(): Promise<void> {
      if (closed) return;
      closed = true;
      if (cancellations.length && cleanupStart !== null) {
        const start = cleanupStart;
        await boundedWait(
          () => Promise.all(cancellations),
          input.clock,
          () => Math.max(0, 1000 - (input.clock.monotonicMs() - start)),
          [cleanupController.signal],
        );
      }
      cleanupController.abort();
      cancellations.length = 0;
    },
  });
}
