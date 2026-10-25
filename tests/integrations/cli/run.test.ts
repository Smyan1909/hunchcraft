import { describe, expect, it } from 'vitest';
import { runCli } from '../../../src/integrations/cli/run.js';
import { writeOutput } from '../../../src/integrations/cli/output.js';
import { cliSetup } from '../../helpers/cli-fakes.js';
import { deferred, fixture, flush } from '../../helpers/consultation-fakes.js';

describe('bounded CLI lifecycle', () => {
  it('help never subscribes; validation consumes split bytes and disposes', async () => {
    const help = cliSetup();
    expect(await runCli(['--help'], help.dependencies)).toBe(0);
    expect(help.input.subscriptions).toBe(0);
    const s = cliSetup();
    const pending = runCli(['validate'], s.dependencies);
    const bytes = fixture().bytes;
    s.input.observer?.chunk(bytes.slice(0, 10));
    s.input.observer?.chunk(bytes.slice(10));
    s.input.observer?.end();
    expect(await pending).toBe(0);
    expect(JSON.parse(new TextDecoder().decode(s.writes[0]))).toMatchObject({
      kind: 'validation',
      checkCount: 6,
    });
    expect(s.input.disposals).toBe(1);
    expect(s.observed.disposals).toBe(1);
    expect(s.clock.timers.size).toBe(0);
  });
  it.each([{ args: [] }, { args: ['consult', 'secret'] }, { args: ['--unknown'] }])(
    'rejects arguments %j without stdin',
    async ({ args }) => {
      const s = cliSetup();
      expect(await runCli(args, s.dependencies)).toBe(2);
      expect(s.input.subscriptions).toBe(0);
      expect(new TextDecoder().decode(s.writes[0])).not.toContain('secret');
    },
  );
  it.each(['oversize', 'malformed', 'io'] as const)('sanitizes ordinary input %s', async (kind) => {
    const s = cliSetup();
    const pending = runCli(['validate'], s.dependencies);
    if (kind === 'io') s.input.observer?.error();
    else {
      s.input.observer?.chunk(kind === 'oversize' ? new Uint8Array(49153) : new Uint8Array([255]));
      s.input.observer?.end();
    }
    expect(await pending).toBe(kind === 'io' ? 1 : 2);
    expect(s.writes).toHaveLength(1);
  });
  it.each(['deadline', 'cancel', 'clock'] as const)(
    'fences blocked stdin at %s and ignores late data',
    async (kind) => {
      const s = cliSetup();
      const pending = runCli(['validate'], s.dependencies);
      if (kind === 'deadline') s.clock.advance(15000);
      else if (kind === 'cancel') s.controller.abort();
      else {
        s.clock.monotonic = -1;
        s.dependencies.operation.checkpoint('input');
      }
      expect(await pending).toBe(kind === 'deadline' ? 5 : kind === 'cancel' ? 130 : 1);
      s.input.observer?.chunk(fixture().bytes);
      s.input.observer?.end();
      await flush();
      expect(s.writes).toHaveLength(0);
      expect(s.input.disposals).toBe(1);
    },
  );
  it('validates full output before starting delivery', async () => {
    const s = cliSetup();
    let calls = 0;
    const result = await writeOutput(
      {
        deliver(): Promise<void> {
          calls++;
          return Promise.resolve();
        },
      },
      new Uint8Array([1, 2, 3]),
      s.dependencies.operation,
    );
    expect(result.ok).toBe(false);
    expect(calls).toBe(0);
    s.dependencies.operation.dispose();
  });
  it.each(['deadline', 'cancel', 'error', 'throw'] as const)(
    'does not replace attempted output after %s',
    async (kind) => {
      const s = cliSetup();
      const delivery = deferred<void>();
      let calls = 0;
      const pending = runCli(['--help'], {
        ...s.dependencies,
        output: {
          deliver(): Promise<void> {
            calls++;
            if (kind === 'throw') throw new Error('sensitive');
            return delivery.promise;
          },
        },
      });
      await flush();
      if (kind === 'deadline') s.clock.advance(15000);
      if (kind === 'cancel') s.controller.abort();
      if (kind === 'error') delivery.reject(new Error('secret'));
      expect(await pending).toBe(kind === 'deadline' ? 5 : kind === 'cancel' ? 130 : 1);
      delivery.resolve();
      await flush();
      expect(calls).toBe(1);
      expect(s.observed.disposals).toBe(1);
    },
  );
  it('checks deadline after last-byte acknowledgment', async () => {
    const s = cliSetup();
    expect(
      await runCli(['--help'], {
        ...s.dependencies,
        output: {
          deliver(): Promise<void> {
            s.clock.advance(15000, false);
            return Promise.resolve();
          },
        },
      }),
    ).toBe(5);
  });
  it('cannot print completed advice from a fixture origin', async () => {
    const s = cliSetup();
    const pending = runCli(['consult'], s.dependencies);
    s.input.observer?.chunk(fixture().bytes);
    s.input.observer?.end();
    expect(await pending).toBe(2);
    expect(new TextDecoder().decode(s.writes[0])).not.toContain('completed');
  });
  it('cleanup faults produce failure without replacement output', async () => {
    const s = cliSetup();
    expect(
      await runCli(['--help'], {
        ...s.dependencies,
        dispose(): void {
          throw new Error('secret');
        },
      }),
    ).toBe(1);
    expect(s.writes).toHaveLength(1);
  });
  it('input unsubscription failure terminates before any stdout', async () => {
    const s = cliSetup();
    const pending = runCli(['validate'], {
      ...s.dependencies,
      input: {
        subscribe(observer) {
          s.input.subscribe(observer);
          return () => {
            throw new Error('private cleanup failure');
          };
        },
      },
    });
    s.input.observer?.chunk(fixture().bytes);
    s.input.observer?.end();
    expect(await pending).toBe(1);
    expect(s.writes).toHaveLength(0);
  });
  it('operation disposal throw is handled without replacement output', async () => {
    const s = cliSetup();
    expect(
      await runCli(['--help'], {
        ...s.dependencies,
        operation: {
          ...s.dependencies.operation,
          dispose(): void {
            s.dependencies.operation.dispose();
            throw new Error('private cleanup failure');
          },
        },
      }),
    ).toBe(1);
    expect(s.writes).toHaveLength(1);
  });
});
