import { describe, expect, it, vi } from 'vitest';
import { createNodeCli, createNodeClock } from '../../src/composition/node.js';
import { runCli } from '../../src/integrations/cli/run.js';
import { cliSetup } from '../helpers/cli-fakes.js';
import { fixture, flush, response } from '../helpers/consultation-fakes.js';
import { compileChecks } from '../../src/core/checks.js';

describe('explicit Node composition with real SDK and fake HTTP', () => {
  it('does not lose a deadline when Node timer notification is early', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      const clock = createNodeClock();
      let calls = 0;
      const cancel = clock.schedule(0.5, () => {
        calls++;
      });
      vi.advanceTimersByTime(1);
      expect(calls).toBe(0);
      now = 0.5;
      vi.advanceTimersByTime(1);
      expect(calls).toBe(1);
      cancel();
      cancel();
      expect(vi.getTimerCount()).toBe(0);
      const stopped = clock.schedule(10, () => {
        calls++;
      });
      stopped();
      now = 20;
      vi.advanceTimersByTime(20);
      expect(calls).toBe(1);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
  it('does not report success when Operation timer disposal fails', async () => {
    const s = cliSetup();
    s.dependencies.operation.dispose();
    const schedule = s.clock.schedule.bind(s.clock);
    s.clock.schedule = (delay, callback) => {
      const cancel = schedule(delay, callback);
      return () => {
        cancel();
        throw new Error('private timer disposal failure');
      };
    };
    const dependencies = createNodeCli({
      ...s.dependencies,
      clock: s.clock,
      signal: s.controller.signal,
      environment: () => ({}),
      fetch: () => Promise.reject(new Error('not authorized')),
    });
    expect(await runCli(['--help'], dependencies)).toBe(1);
  });
  it.each(['--help', 'validate', 'invalid', 'malformed'])(
    '%s never reads environment or dispatches',
    async (command) => {
      const s = cliSetup();
      let reads = 0;
      let requests = 0;
      const dependencies = createNodeCli({
        ...s.dependencies,
        clock: s.clock,
        signal: s.controller.signal,
        environment: () => {
          reads++;
          throw new Error('not authorized');
        },
        fetch: () => {
          requests++;
          return Promise.reject(new Error('not authorized'));
        },
      });
      s.dependencies.operation.dispose();
      const pending = runCli([command === 'malformed' ? 'consult' : command], dependencies);
      if (command === 'validate' || command === 'malformed') {
        s.input.observer?.chunk(command === 'validate' ? fixture().bytes : new Uint8Array([255]));
        s.input.observer?.end();
      }
      expect(await pending).toBe(command === 'invalid' || command === 'malformed' ? 2 : 0);
      expect(reads).toBe(0);
      expect(requests).toBe(0);
    },
  );
  it.each(['missing', 'conflict', 'valid'] as const)(
    'consult %s enforces pinned configuration and one dispatch',
    async (mode) => {
      const s = cliSetup();
      let reads = 0;
      const requests: { url: string; init: RequestInit | undefined }[] = [];
      const plan = compileChecks(fixture().brief);
      if (!plan.ok) throw new Error('fixture');
      const dependencies = createNodeCli({
        ...s.dependencies,
        clock: s.clock,
        signal: s.controller.signal,
        environment: () => {
          reads++;
          return mode === 'missing'
            ? {}
            : {
                TYPESAFE_API_KEY: 'dummy-offline-key',
                TYPESAFE_BASE_URL: mode === 'conflict' ? 'https://untrusted.invalid' : undefined,
                TYPESAFE_LOG_LEVEL: 'debug',
              };
        },
        fetch: (url, init) => {
          requests.push({ url, init });
          return Promise.resolve(
            new Response(JSON.stringify(response(plan.value)), {
              status: 200,
              headers: { 'content-type': 'application/json', 'x-request-id': 'offline' },
            }),
          );
        },
      });
      s.dependencies.operation.dispose();
      const pending = runCli(['consult'], dependencies);
      s.input.observer?.chunk(fixture().bytes);
      s.input.observer?.end();
      expect(await pending).toBe(mode === 'valid' ? 0 : 3);
      expect(reads).toBe(1);
      expect(requests).toHaveLength(mode === 'valid' ? 1 : 0);
      if (mode === 'valid') {
        const request = requests[0];
        if (!request) throw new Error('missing request');
        expect(request.url).toBe('https://api.typesafe.ai/v1/systemone');
        expect(typeof request.init?.body).toBe('string');
        if (typeof request.init?.body !== 'string') throw new Error('missing body');
        const body: unknown = JSON.parse(request.init.body);
        expect(body).toEqual({
          state: fixture().brief.brief,
          model: 'jev-1.13.0',
          questions: Object.fromEntries(plan.value.checks.map((c) => [c.wireId, c.question])),
        });
        expect(new TextDecoder().decode(s.writes[0])).toContain('completed');
        expect(new TextDecoder().decode(s.writes[0])).not.toContain('dummy-offline-key');
      }
      await flush();
      expect(s.clock.timers.size).toBe(0);
    },
  );
});
