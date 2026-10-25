import { afterEach, describe, expect, it } from 'vitest';
import { createOutputChildSink, outputForkOptions } from '../../src/composition/output-child.js';
import type { OutputChild, OutputChildObserver } from '../../src/composition/output-child.js';
import { writeOutput } from '../../src/integrations/cli/output.js';
import { runCli } from '../../src/integrations/cli/run.js';
import { cliSetup } from '../helpers/cli-fakes.js';
import { flush } from '../helpers/consultation-fakes.js';
import type { Operation } from '../../src/application/operation.js';

class FakeChild implements OutputChild {
  observer: OutputChildObserver | undefined;
  callback: ((error: unknown) => void) | undefined;
  messages: unknown[] = [];
  kills = 0;
  disconnects = 0;
  detached = 0;
  killResult = true;
  killThrows = false;
  disconnectThrows = false;
  sendThrows = false;
  detachThrows = false;
  observe(observer: OutputChildObserver): () => void {
    this.observer = observer;
    return () => {
      this.detached++;
      if (this.detachThrows) throw new Error('private observer disposal failure');
    };
  }
  send(message: unknown, callback: (error: unknown) => void): void {
    this.messages.push(message);
    this.callback = callback;
    if (this.sendThrows) throw new Error('private send error');
  }
  kill(): boolean {
    this.kills++;
    if (this.killThrows) throw new Error('private kill error');
    return this.killResult;
  }
  disconnect(): void {
    this.disconnects++;
    if (this.disconnectThrows) throw new Error('private disconnect error');
    this.observer?.disconnect();
  }
}
const operations: Operation[] = [];
afterEach(() => {
  for (const op of operations.splice(0)) op.dispose();
});
function setup(): ReturnType<typeof cliSetup> & {
  child: FakeChild;
  sink: ReturnType<typeof createOutputChildSink>;
  counts: { spawns: number };
} {
  const s = cliSetup();
  operations.push(s.dependencies.operation);
  const child = new FakeChild();
  const counts = { spawns: 0 };
  const sink = createOutputChildSink({
    operation: s.dependencies.operation,
    spawn: () => {
      counts.spawns++;
      return child;
    },
  });
  return { ...s, child, sink, counts };
}
const text = '日本語\n';
const bytes = new TextEncoder().encode(text);
const ack = { type: 'written', byteLength: bytes.byteLength };

describe('invocation-owned output child', () => {
  it('requires exact ack, successful send and observed exit zero; accepts normal disconnect', async () => {
    const s = setup();
    let settled = false;
    const pending = writeOutput(s.sink, bytes, s.dependencies.operation).then((result) => {
      settled = true;
      return result;
    });
    expect(s.child.messages).toEqual([{ type: 'output', text }]);
    s.child.observer?.message(ack);
    s.child.observer?.disconnect();
    await flush();
    expect(settled).toBe(false);
    s.child.observer?.exit(0, null);
    await flush();
    expect(settled).toBe(false);
    s.child.callback?.(null);
    expect((await pending).ok).toBe(true);
    s.sink.dispose();
    expect(s.child.kills).toBe(0);
    expect(s.child.detached).toBe(1);
  });
  it.each([
    null,
    {},
    { ...ack, byteLength: 1 },
    { ...ack, extra: true },
    { type: 'written', byteLength: String(bytes.byteLength) },
    ['written'],
    { type: 'error', text: 'private' },
  ])('rejects invalid acknowledgement %j', async (value) => {
    const s = setup();
    const pending = writeOutput(s.sink, bytes, s.dependencies.operation);
    s.child.callback?.(null);
    s.child.observer?.message(value);
    expect(await pending).toMatchObject({ ok: false, error: { code: 'internal_failure' } });
    expect(s.child.kills).toBe(1);
    s.child.observer?.exit(null, 'SIGKILL');
    expect(s.child.detached).toBe(1);
  });
  it('rejects duplicate acknowledgement before exit and never restarts', async () => {
    const s = setup();
    const pending = writeOutput(s.sink, bytes, s.dependencies.operation);
    s.child.observer?.message(ack);
    s.child.observer?.message(ack);
    expect((await pending).ok).toBe(false);
    s.child.callback?.(null);
    s.child.observer?.exit(0, null);
    s.sink.dispose();
    expect(s.counts.spawns).toBe(1);
    expect(s.child.messages).toHaveLength(1);
  });
  it('does not accept a send failure even after ack and exit zero', async () => {
    const s = setup();
    const pending = writeOutput(s.sink, bytes, s.dependencies.operation);
    s.child.observer?.message(ack);
    s.child.observer?.exit(0, null);
    s.child.callback?.(new Error('late private send failure'));
    expect(await pending).toMatchObject({ ok: false, error: { code: 'local_io' } });
    expect(s.child.kills).toBe(0);
    s.sink.dispose();
  });
  it.each([
    'disconnect',
    'error',
    'send-error',
    'send-throw',
    'exit-nonzero',
    'exit-no-ack',
  ] as const)('fails closed on %s', async (kind) => {
    const s = setup();
    if (kind === 'send-throw') s.child.sendThrows = true;
    const pending = writeOutput(s.sink, bytes, s.dependencies.operation);
    if (kind === 'disconnect') s.child.observer?.disconnect();
    if (kind === 'error') s.child.observer?.error();
    if (kind === 'send-error') s.child.callback?.(new Error('private'));
    if (kind === 'exit-nonzero') {
      s.child.observer?.message(ack);
      s.child.observer?.exit(1, null);
    }
    if (kind === 'exit-no-ack') s.child.observer?.exit(0, null);
    expect(await pending).toMatchObject({
      ok: false,
      error: { code: 'local_io', stage: 'output' },
    });
    expect(s.child.kills).toBe(kind.startsWith('exit') ? 0 : 1);
    s.child.callback?.(null);
    s.child.observer?.message(ack);
    s.child.observer?.exit(0, null);
  });
  it('classifies spawn failure without delivery or raw error text', async () => {
    const s = setup();
    const sink = createOutputChildSink({
      operation: s.dependencies.operation,
      spawn: () => {
        throw new Error('credential');
      },
    });
    expect(await writeOutput(sink, bytes, s.dependencies.operation)).toMatchObject({
      ok: false,
      error: { code: 'local_io' },
    });
    sink.dispose();
    expect(s.child.messages).toHaveLength(0);
  });
  it('does not report success when observer disposal fails after exit', async () => {
    const s = setup();
    s.child.detachThrows = true;
    const pending = writeOutput(s.sink, bytes, s.dependencies.operation);
    s.child.callback?.(null);
    s.child.observer?.message(ack);
    s.child.observer?.exit(0, null);
    expect(await pending).toMatchObject({ ok: false, error: { code: 'internal_failure' } });
    expect(s.child.kills).toBe(0);
    expect(() => s.sink.dispose()).toThrow();
  });
  it('does not allow reuse after successful or failed delivery', async () => {
    const s = setup();
    const pending = writeOutput(s.sink, bytes, s.dependencies.operation);
    s.child.callback?.(null);
    s.child.observer?.message(ack);
    s.child.observer?.exit(0, null);
    expect((await pending).ok).toBe(true);
    expect(await writeOutput(s.sink, bytes, s.dependencies.operation)).toMatchObject({
      ok: false,
      error: { code: 'internal_failure' },
    });
    expect(s.counts.spawns).toBe(1);
  });
  it.each(['deadline', 'cancel', 'invariant'] as const)(
    'kills once during %s and suppresses late callbacks',
    async (kind) => {
      const s = setup();
      const pending = writeOutput(s.sink, bytes, s.dependencies.operation);
      if (kind === 'deadline') s.clock.advance(15000);
      if (kind === 'cancel') s.controller.abort();
      if (kind === 'invariant') {
        s.clock.monotonic = -1;
        s.dependencies.operation.checkpoint('output');
      }
      expect(await pending).toMatchObject({
        ok: false,
        error: { exitCode: kind === 'deadline' ? 5 : kind === 'cancel' ? 130 : 1 },
      });
      s.sink.dispose();
      s.sink.dispose();
      s.child.callback?.(new Error('late'));
      s.child.observer?.message(ack);
      s.child.observer?.error();
      s.child.observer?.exit(null, 'SIGKILL');
      expect(s.child.kills).toBe(1);
      expect(s.child.disconnects).toBe(1);
      expect(s.child.messages).toHaveLength(1);
    },
  );
  it('waits for missing exit only until the original deadline', async () => {
    const s = setup();
    const pending = writeOutput(s.sink, bytes, s.dependencies.operation);
    s.child.callback?.(null);
    s.child.observer?.message(ack);
    s.child.observer?.disconnect();
    s.clock.advance(15000);
    expect(await pending).toMatchObject({ ok: false, error: { exitCode: 5 } });
    expect(s.child.kills).toBe(1);
  });
  it('checks freshness after exit and fences before spawn/send', async () => {
    const s = setup();
    const pending = writeOutput(s.sink, bytes, s.dependencies.operation);
    s.child.callback?.(null);
    s.child.observer?.message(ack);
    s.clock.advance(15000, false);
    s.child.observer?.exit(0, null);
    expect((await pending).ok).toBe(false);
    expect(s.child.kills).toBe(0);
    const t = setup();
    t.clock.advance(15000);
    expect((await writeOutput(t.sink, bytes, t.dependencies.operation)).ok).toBe(false);
    expect(t.counts.spawns).toBe(0);
    const u = setup();
    const sink = createOutputChildSink({
      operation: u.dependencies.operation,
      spawn: () => {
        u.controller.abort();
        return u.child;
      },
    });
    expect((await writeOutput(sink, bytes, u.dependencies.operation)).ok).toBe(false);
    expect(u.child.messages).toHaveLength(0);
    expect(u.child.kills).toBe(1);
  });
  it.each(['kill-false', 'kill-throw', 'disconnect-throw'] as const)(
    'does not replace deadline/cancellation with %s cleanup fault',
    async (kind) => {
      for (const cancelled of [false, true]) {
        const s = setup();
        s.child.killResult = kind !== 'kill-false';
        s.child.killThrows = kind === 'kill-throw';
        s.child.disconnectThrows = kind === 'disconnect-throw';
        const pending = runCli(['--help'], {
          ...s.dependencies,
          output: s.sink,
          dispose: () => s.sink.dispose(),
        });
        if (cancelled) s.controller.abort();
        else s.clock.advance(15000);
        expect(await pending).toBe(cancelled ? 130 : 5);
        expect(s.child.kills).toBe(1);
        s.child.observer?.exit(null, 'SIGKILL');
      }
    },
  );
  it('does not replace partially delivered output on failure', async () => {
    const s = setup();
    const pending = runCli(['--help'], {
      ...s.dependencies,
      output: s.sink,
      dispose: () => s.sink.dispose(),
    });
    // A write may already be partially visible; only exit/ack can establish success.
    s.child.observer?.exit(1, null);
    expect(await pending).toBe(1);
    expect(s.child.messages).toHaveLength(1);
    expect(s.counts.spawns).toBe(1);
  });
  it('uses explicit credential/preload-free fork options', () => {
    const posix = outputForkOptions('/absolute/node', 'darwin', '/ignored');
    expect(posix).toMatchObject({
      execPath: '/absolute/node',
      execArgv: [],
      env: {},
      detached: false,
      stdio: ['ignore', 1, 'ignore', 'ipc'],
    });
    expect(outputForkOptions('C:\\node.exe', 'win32', 'C:\\Windows').env).toEqual({
      SystemRoot: 'C:\\Windows',
    });
    expect(outputForkOptions('C:\\node.exe', 'win32', 'bad\0value').env).toEqual({});
    expect(posix).not.toHaveProperty('shell');
  });
});
