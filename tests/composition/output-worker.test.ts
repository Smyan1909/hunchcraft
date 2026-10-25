import { describe, expect, it } from 'vitest';
import { createWorkerReceiver } from '../../src/composition/output-worker.js';

describe('private output worker protocol', () => {
  it('accepts the complete 256 KiB UTF-8 output boundary', () => {
    let acknowledged = 0;
    const exits: number[] = [];
    createWorkerReceiver({
      write: (bytes) => bytes.byteLength,
      send(message, callback): void {
        acknowledged = message.byteLength;
        callback(null);
      },
      exit: (code) => {
        exits.push(code);
      },
    })({ type: 'output', text: 'x'.repeat(262143) + '\n' });
    expect(acknowledged).toBe(262144);
    expect(exits).toEqual([0]);
  });
  it('loops over short UTF-8 writes and exits only after ack send callback', () => {
    const offsets: number[] = [];
    const exits: number[] = [];
    const acks: unknown[] = [];
    let callback: ((error: unknown) => void) | undefined;
    const text = 'a日本語\n';
    const size = new TextEncoder().encode(text).byteLength;
    const receive = createWorkerReceiver({
      write(bytes, offset) {
        offsets.push(offset);
        return Math.min(2, bytes.byteLength - offset);
      },
      send(message, done): void {
        acks.push(message);
        callback = done;
      },
      exit: (code) => {
        exits.push(code);
      },
    });
    receive({ type: 'output', text });
    expect(offsets).toEqual([0, 2, 4, 6, 8, 10]);
    expect(acks).toEqual([{ type: 'written', byteLength: size }]);
    expect(exits).toEqual([]);
    callback?.(null);
    expect(exits).toEqual([0]);
  });
  it.each([
    null,
    [],
    {},
    { type: 'output', text: 'missing newline' },
    { type: 'output', text: '\uD800\n' },
    { type: 'output', text: '\uFEFFx\n' },
    { type: 'output', text: 'x\n', extra: true },
    { type: 'output', text: 'x'.repeat(262144) + '\n' },
    { type: 'output', text: '日'.repeat(90000) + '\n' },
  ])('rejects malformed/bounded packet %# before writes', (packet) => {
    let writes = 0;
    const exits: number[] = [];
    const receive = createWorkerReceiver({
      write: () => {
        writes++;
        return 1;
      },
      send(): void {
        throw new Error('unexpected ack');
      },
      exit: (code) => {
        exits.push(code);
      },
    });
    receive(packet);
    expect(writes).toBe(0);
    expect(exits).toEqual([1]);
  });
  it.each([0, -1, NaN, 4])('rejects invalid write count %s without ack', (count) => {
    const exits: number[] = [];
    let acks = 0;
    createWorkerReceiver({
      write: () => count,
      send: () => {
        acks++;
      },
      exit: (code) => {
        exits.push(code);
      },
    })({ type: 'output', text: 'a\n' });
    expect(exits).toEqual([1]);
    expect(acks).toBe(0);
  });
  it('does not append replacement output after a partial write failure', () => {
    const visible: number[] = [];
    const exits: number[] = [];
    let acks = 0;
    createWorkerReceiver({
      write(bytes, offset) {
        if (offset !== 0) throw new Error('private EPIPE after partial output');
        visible.push(bytes[0] ?? 0);
        return 1;
      },
      send: () => {
        acks++;
      },
      exit: (code) => {
        exits.push(code);
      },
    })({ type: 'output', text: 'answer\n' });
    expect(visible).toEqual([97]);
    expect(acks).toBe(0);
    expect(exits).toEqual([1]);
  });
  it.each(['write', 'send', 'callback', 'duplicate'] as const)('fails closed on %s', (kind) => {
    const exits: number[] = [];
    let callback: ((error: unknown) => void) | undefined;
    const receive = createWorkerReceiver({
      write(bytes) {
        if (kind === 'write') throw new Error('private EPIPE');
        return bytes.byteLength;
      },
      send(_message, done): void {
        if (kind === 'send') throw new Error('private');
        callback = done;
      },
      exit: (code) => {
        exits.push(code);
      },
    });
    receive({ type: 'output', text: 'a\n' });
    if (kind === 'callback') callback?.(new Error('private'));
    if (kind === 'duplicate') {
      receive({ type: 'output', text: 'replacement\n' });
      callback?.(null);
    }
    expect(exits).toEqual([1]);
  });
});
