import { fork } from 'node:child_process';
import type { ForkOptions } from 'node:child_process';
import { win32 } from 'node:path';
import type { Operation } from '../application/operation.js';
import { ClassifiedFailure, classifiedFailure, failure, prepareBytes } from '../core/result.js';
import type { Failure } from '../core/result.js';
import type { OutputSink } from '../integrations/cli/output.js';

export interface OutputChildObserver {
  message(value: unknown): void;
  error(): void;
  exit(code: number | null, signal: string | null): void;
  disconnect(): void;
}
/** Narrow invocation-owned capabilities, not a general process abstraction. */
export interface OutputChild {
  observe(observer: OutputChildObserver): () => void;
  send(
    message: Readonly<{ type: 'output'; text: string }>,
    callback: (error: unknown) => void,
  ): void;
  kill(): boolean;
  disconnect(): void;
}
export function outputForkOptions(
  execPath: string,
  platform: string,
  systemRoot: string | undefined,
): ForkOptions {
  const env: Record<string, string> = {};
  if (
    platform === 'win32' &&
    systemRoot &&
    systemRoot.length <= 32768 &&
    win32.isAbsolute(systemRoot) &&
    !/[\0\r\n]/.test(systemRoot)
  )
    env.SystemRoot = systemRoot;
  return {
    execPath,
    execArgv: [],
    env,
    stdio: ['ignore', 1, 'ignore', 'ipc'],
    detached: false,
    serialization: 'json',
    windowsHide: true,
  };
}
export function spawnOutputChild(): OutputChild {
  const child = fork(
    new URL('./output-worker.js', import.meta.url),
    [],
    outputForkOptions(
      process.execPath,
      process.platform,
      process.platform === 'win32' ? process.env.SystemRoot : undefined,
    ),
  );
  // Keep late EventEmitter errors observed even after lifecycle observers detach.
  child.on('error', () => {});
  return {
    observe(observer) {
      const message = (value: unknown): void => observer.message(value);
      const error = (): void => observer.error();
      const exit = (code: number | null, signal: string | null): void =>
        observer.exit(code, signal);
      const disconnect = (): void => observer.disconnect();
      child.on('message', message).on('error', error).on('exit', exit).on('disconnect', disconnect);
      return () => {
        child
          .removeListener('message', message)
          .removeListener('error', error)
          .removeListener('exit', exit)
          .removeListener('disconnect', disconnect);
      };
    },
    send(message, callback): void {
      child.send(message, callback);
    },
    kill: () => child.kill('SIGKILL'),
    disconnect(): void {
      if (child.connected) child.disconnect();
    },
  };
}
function exactAck(value: unknown, byteLength: number): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === 2 &&
    keys.includes('type') &&
    keys.includes('byteLength') &&
    Object.getOwnPropertyDescriptor(value, 'type')?.value === 'written' &&
    Object.getOwnPropertyDescriptor(value, 'byteLength')?.value === byteLength
  );
}
export function createOutputChildSink(dependencies: {
  readonly operation: Operation;
  readonly spawn: () => OutputChild;
}): OutputSink & { dispose(): void } {
  const { operation } = dependencies;
  let claimed = false;
  let disposed = false;
  let stop: (() => void) | undefined;
  let cleanupFailed = false;
  const fence = (signal: AbortSignal): void => {
    const current = operation.checkpoint('output');
    if (!current.ok) throw new ClassifiedFailure(current.error);
    if (signal.aborted) throw new ClassifiedFailure(failure('operation_cancelled', 'output'));
  };
  return {
    deliver(text, signal): Promise<void> {
      if (claimed || disposed)
        return Promise.reject(new ClassifiedFailure(failure('internal_failure', 'internal')));
      claimed = true;
      return new Promise<void>((resolve, reject) => {
        let child: OutputChild | undefined;
        let exited = false;
        let exitOkay = false;
        let acknowledged = false;
        let sent = false;
        let settled = false;
        let killed = false;
        let detach = (): void => {};
        let observersCleaned = false;
        const cleanObservers = (): void => {
          if (observersCleaned) return;
          observersCleaned = true;
          signal.removeEventListener('abort', abort);
          try {
            detach();
          } catch {
            cleanupFailed = true;
          }
        };
        const terminate = (): void => {
          if (!child || exited || killed) return;
          killed = true;
          try {
            if (!child.kill()) cleanupFailed = true;
          } catch {
            cleanupFailed = true;
          }
          try {
            child.disconnect();
          } catch {
            cleanupFailed = true;
          }
        };
        const fail = (cause: Failure): void => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', abort);
          terminate();
          if (!child || exited) cleanObservers();
          reject(new ClassifiedFailure(cause));
        };
        const live = (): boolean => {
          if (settled) return false;
          try {
            fence(signal);
            return true;
          } catch {
            const current = operation.checkpoint('output');
            fail(current.ok ? failure('operation_cancelled', 'output') : current.error);
            return false;
          }
        };
        const succeed = (): void => {
          if (!acknowledged || !exitOkay || !sent || !live()) return;
          settled = true;
          cleanObservers();
          if (cleanupFailed) reject(new ClassifiedFailure(failure('internal_failure', 'internal')));
          else resolve();
        };
        const abort = (): void => {
          const current = operation.checkpoint('output');
          fail(current.ok ? failure('operation_cancelled', 'output') : current.error);
        };
        stop = () => fail(failure('local_io', 'output'));
        try {
          fence(signal);
          if (text.length > 256 * 1024)
            throw new ClassifiedFailure(failure('output_too_large', 'output'));
          const bytes = new TextEncoder().encode(text);
          const prepared = prepareBytes(bytes);
          if (!prepared.ok || new TextDecoder('utf-8', { fatal: true }).decode(bytes) !== text)
            throw new ClassifiedFailure(failure('internal_failure', 'internal'));
          fence(signal);
          child = dependencies.spawn();
          detach = child.observe({
            message(value): void {
              if (!live()) return;
              if (acknowledged || !exactAck(value, bytes.byteLength)) {
                fail(failure('internal_failure', 'internal'));
                return;
              }
              acknowledged = true;
              succeed();
            },
            error(): void {
              if (live()) fail(failure('local_io', 'output'));
            },
            exit(code, exitSignal): void {
              exited = true;
              if (settled) {
                cleanObservers();
                return;
              }
              if (!live()) {
                cleanObservers();
                return;
              }
              if (code !== 0 || exitSignal !== null || !acknowledged) {
                fail(failure('local_io', 'output'));
                return;
              }
              exitOkay = true;
              succeed();
            },
            disconnect(): void {
              if (live() && !acknowledged) fail(failure('local_io', 'output'));
            },
          });
          signal.addEventListener('abort', abort, { once: true });
          fence(signal);
          if (!live()) return;
          child.send({ type: 'output', text }, (error) => {
            if (!live()) return;
            if (error !== null && error !== undefined) {
              fail(failure('local_io', 'output'));
              return;
            }
            sent = true;
            succeed();
          });
        } catch (error) {
          const current = operation.checkpoint('output');
          fail(
            current.ok
              ? (classifiedFailure(error) ?? failure('local_io', 'output'))
              : current.error,
          );
        }
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stop?.();
      if (cleanupFailed) throw new ClassifiedFailure(failure('internal_failure', 'internal'));
    },
  };
}
