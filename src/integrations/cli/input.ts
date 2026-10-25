import type { Operation } from '../../application/operation.js';
import { ClassifiedFailure, failure } from '../../core/result.js';
import type { Validation } from '../../core/result.js';

export interface InputObserver {
  chunk(bytes: Uint8Array): void;
  end(): void;
  error(): void;
}
export interface InputSource {
  subscribe(observer: InputObserver): () => void;
}
export async function readInput(
  source: InputSource,
  operation: Operation,
): Promise<Validation<Uint8Array>> {
  let unsubscribe = (): void => {};
  let active = true;
  let detach = (): void => {};
  try {
    return await operation.wait(
      'input',
      (signal) =>
        new Promise<Uint8Array>((resolve, reject) => {
          const chunks: Uint8Array[] = [];
          let size = 0;
          const stop = (): void => {
            active = false;
          };
          signal.addEventListener('abort', stop, { once: true });
          detach = () => signal.removeEventListener('abort', stop);
          const finish = (error?: 'invalid_input' | 'local_io'): void => {
            if (!active) return;
            active = false;
            signal.removeEventListener('abort', stop);
            if (error) reject(new ClassifiedFailure(failure(error, 'input')));
            else {
              const bytes = new Uint8Array(size);
              let offset = 0;
              for (const chunk of chunks) {
                bytes.set(chunk, offset);
                offset += chunk.byteLength;
              }
              resolve(bytes);
            }
          };
          unsubscribe = source.subscribe({
            chunk(bytes): void {
              if (!active) return;
              if (!(bytes instanceof Uint8Array)) {
                finish('local_io');
                return;
              }
              if (size + bytes.byteLength > 48 * 1024) {
                finish('invalid_input');
                return;
              }
              chunks.push(new Uint8Array(bytes));
              size += bytes.byteLength;
            },
            end: () => finish(),
            error: () => finish('local_io'),
          });
        }),
    );
  } finally {
    active = false;
    detach();
    try {
      unsubscribe();
    } catch {
      operation.fail(failure('internal_failure', 'internal'));
    }
  }
}
