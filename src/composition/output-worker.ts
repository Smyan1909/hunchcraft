import { writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface WorkerHost {
  write(bytes: Uint8Array, offset: number): number;
  send(
    message: Readonly<{ type: 'written'; byteLength: number }>,
    callback: (error: unknown) => void,
  ): void;
  exit(code: 0 | 1): void;
}
export function createWorkerReceiver(host: WorkerHost): (message: unknown) => void {
  let received = false;
  let ended = false;
  const exit = (code: 0 | 1): void => {
    if (!ended) {
      ended = true;
      host.exit(code);
    }
  };
  return (message): void => {
    if (received) {
      exit(1);
      return;
    }
    received = true;
    try {
      if (typeof message !== 'object' || message === null || Array.isArray(message))
        throw new Error();
      const keys = Reflect.ownKeys(message);
      const text: unknown = Object.getOwnPropertyDescriptor(message, 'text')?.value;
      if (
        keys.length !== 2 ||
        !keys.includes('type') ||
        !keys.includes('text') ||
        Object.getOwnPropertyDescriptor(message, 'type')?.value !== 'output' ||
        typeof text !== 'string' ||
        text.length > 256 * 1024 ||
        !text.endsWith('\n') ||
        text.startsWith('\uFEFF')
      )
        throw new Error();
      const bytes = new TextEncoder().encode(text);
      if (
        bytes.byteLength > 256 * 1024 ||
        new TextDecoder('utf-8', { fatal: true }).decode(bytes) !== text
      )
        throw new Error();
      let offset = 0;
      while (offset < bytes.byteLength) {
        const written = host.write(bytes, offset);
        if (!Number.isSafeInteger(written) || written <= 0 || written > bytes.byteLength - offset)
          throw new Error();
        offset += written;
      }
      host.send({ type: 'written', byteLength: bytes.byteLength }, (error) =>
        exit(error === null || error === undefined ? 0 : 1),
      );
    } catch {
      exit(1);
    }
  };
}
// Private executable, not a package API or a provider composition.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const receive = createWorkerReceiver({
    write: (bytes, offset) => writeSync(1, bytes, offset, bytes.byteLength - offset),
    send(message, callback): void {
      if (!process.send) throw new Error();
      process.send(message, callback);
    },
    exit: (code) => process.exit(code),
  });
  process.on('message', receive);
  process.on('disconnect', () => process.exit(1));
  process.on('error', () => process.exit(1));
  if (!process.send) process.exit(1);
}
