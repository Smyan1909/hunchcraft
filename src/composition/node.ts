import type { ReadStream } from 'node:tty';
import { createOperation } from '../application/operation.js';
import type { Clock } from '../ports/clock.js';
import type { InputSource } from '../integrations/cli/input.js';
import type { OutputSink } from '../integrations/cli/output.js';
import type { CliDependencies } from '../integrations/cli/run.js';
import { createTypeSafeProvider } from '../providers/typesafe/provider.js';
import { validateTypeSafeConfiguration } from '../providers/typesafe/configuration.js';
import { ClassifiedFailure, failure } from '../core/result.js';
import { createOutputChildSink, spawnOutputChild } from './output-child.js';

export function createNodeClock(): Clock {
  return {
    monotonicMs: () => performance.now(),
    wallTimeMs: () => Date.now(),
    schedule(delay, callback) {
      const due = performance.now() + delay;
      let cancelled = false;
      const notify = (): void => {
        if (cancelled) return;
        const remaining = due - performance.now();
        // Node truncates fractional timer delays and can notify early. Preserve
        // the original due time rather than losing a one-shot Operation deadline.
        if (remaining > 0) timer = setTimeout(notify, Math.ceil(remaining));
        else callback();
      };
      let timer = setTimeout(notify, Math.ceil(delay));
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    },
  };
}
export function nodeInput(stream: NodeJS.ReadStream | ReadStream): InputSource {
  return {
    subscribe(observer) {
      const data = (chunk: unknown): void => {
        if (chunk instanceof Uint8Array) observer.chunk(chunk);
        else observer.error();
      };
      const end = (): void => observer.end();
      const error = (): void => observer.error();
      const close = (): void => {
        if (!stream.readableEnded) observer.error();
      };
      stream.on('data', data).on('end', end).on('error', error).on('close', close);
      return () => {
        stream.pause();
        stream
          .removeListener('data', data)
          .removeListener('end', end)
          .removeListener('error', error)
          .removeListener('close', close);
      };
    },
  };
}
export interface NodeCliOptions {
  readonly clock: Clock;
  readonly input: InputSource;
  readonly output?: OutputSink;
  readonly signal: AbortSignal;
  readonly environment: () => Readonly<Record<string, string | undefined>>;
  readonly fetch: (input: string, init?: RequestInit) => Promise<Response>;
  readonly dispose: () => void;
}
/** Inert until explicitly called. Environment snapshot is taken only during validated consult. */
export function createNodeCli(options: NodeCliOptions): CliDependencies {
  // Operation.dispose records cancellation faults internally but has no return
  // outcome. Observe our own injected timer cleanup without changing its contract.
  let timerDisposalFailed = false;
  const operationClock: Clock = {
    monotonicMs: () => options.clock.monotonicMs(),
    wallTimeMs: () => options.clock.wallTimeMs(),
    schedule(delay, callback) {
      const cancel = options.clock.schedule(delay, callback);
      return () => {
        try {
          cancel();
        } catch {
          timerDisposalFailed = true;
          throw new ClassifiedFailure(failure('internal_failure', 'internal'));
        }
      };
    },
  };
  const operation = createOperation(
    operationClock,
    { monotonicMs: options.clock.monotonicMs(), wallTimeMs: options.clock.wallTimeMs() },
    options.signal,
  );
  const provider = createTypeSafeProvider({
    clock: options.clock,
    fetch: options.fetch,
    configuration: () => {
      const env = options.environment();
      return Promise.resolve(
        validateTypeSafeConfiguration({
          apiKey: env.TYPESAFE_API_KEY,
          baseURL: env.TYPESAFE_BASE_URL,
          defaultModel: env.TYPESAFE_DEFAULT_MODEL,
          logLevel: env.TYPESAFE_LOG_LEVEL,
        }),
      );
    },
  });
  const outputChild = options.output
    ? null
    : createOutputChildSink({ operation, spawn: spawnOutputChild });
  const output = options.output ?? outputChild;
  if (!output) throw new ClassifiedFailure(failure('internal_failure', 'internal'));
  return {
    operation: {
      ...operation,
      dispose(): void {
        operation.dispose();
        if (timerDisposalFailed)
          throw new ClassifiedFailure(failure('internal_failure', 'internal'));
      },
    },
    provider,
    input: options.input,
    output,
    dispose(): void {
      try {
        outputChild?.dispose();
      } finally {
        options.dispose();
      }
    },
  };
}
