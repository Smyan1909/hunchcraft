import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consult } from '../../src/application/consult.js';
import { compileChecks } from '../../src/core/checks.js';
import { completedJudgmentEnvelope, parseResultEnvelope } from '../../src/core/result.js';
import { validateTypeSafeConfiguration } from '../../src/providers/typesafe/configuration.js';
import { createTypeSafeProvider } from '../../src/providers/typesafe/provider.js';
import { deferred, fixture, flush, response, setup } from '../helpers/consultation-fakes.js';

const configuration = () =>
  Promise.resolve(
    validateTypeSafeConfiguration({
      apiKey: 'dummy',
      baseURL: undefined,
      defaultModel: undefined,
      logLevel: undefined,
    }),
  );
describe('real SDK / fake HTTP through stateless consult', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it.each(['minimal6', 'csv13'] as const)(
    'projects every %s check with only selected state/questions transmitted',
    async (name) => {
      const s = setup(name);
      const compiled = compileChecks(fixture(name).brief);
      if (!compiled.ok) throw new Error();
      const fakeFetch = vi.fn((_url: unknown, init?: RequestInit) => {
        expect(typeof init?.body).toBe('string');
        if (typeof init?.body !== 'string') throw new Error('Expected SDK string body');
        const body: unknown = JSON.parse(init.body);
        expect(body).toEqual({
          model: 'jev-1.13.0',
          state: compiled.value.state,
          questions: compiled.value.questions,
        });
        return Promise.resolve(
          new Response(JSON.stringify(response(compiled.value)), {
            headers: { 'x-typesafe-request-id': 'offline-only' },
          }),
        );
      });
      const config = vi.fn(configuration);
      const provider = createTypeSafeProvider({
        configuration: config,
        fetch: fakeFetch,
        clock: s.clock,
      });
      const o = await consult(s.input, { provider });
      if (o.status !== 'ready') throw new Error('consultation failed');
      expect(o.result.checks.map((c) => c.id)).toEqual(compiled.value.checks.map((c) => c.id));
      expect(o.result.provider.metadata).toEqual({
        origin: 'provider-http',
        attempts: 1,
        requestId: 'offline-only',
        httpStatus: 200,
      });
      const projection = completedJudgmentEnvelope(o.result);
      if (!projection.ok) throw new Error();
      expect(projection.value).toEqual({
        schemaVersion: 'hunchcraft.result.v1',
        kind: 'judgment',
        status: 'completed',
        checkSetId: 'component-outline.v0',
        policyVersion: 'hunchcraft.policy.v1',
        provider: {
          name: 'typesafe',
          sdkVersion: '0.6.0',
          requestedModel: 'jev-1.13.0',
          returnedModel: 'jev-1.13.0',
          requestId: 'offline-only',
          attempts: 1,
          usage: { inputTokens: 120, outputTokens: 24 },
          costEstimate: null,
        },
        checks: o.result.checks,
      });
      expect(parseResultEnvelope(JSON.stringify(projection.value))).toEqual(projection);
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      expect(config).toHaveBeenCalledTimes(1);
      expect(s.input.operation.checkpoint('output').ok).toBe(true);
      expect(s.clock.timers.size).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
      s.input.operation.dispose();
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('missing key dispatches zero with unknown usage and no session prerequisite', async () => {
    const s = setup();
    const fakeFetch = vi.fn(() => Promise.reject(new Error('must not dispatch')));
    const provider = createTypeSafeProvider({
      clock: s.clock,
      fetch: fakeFetch,
      configuration: () =>
        Promise.resolve(
          validateTypeSafeConfiguration({
            apiKey: undefined,
            baseURL: undefined,
            defaultModel: undefined,
            logLevel: undefined,
          }),
        ),
    });
    expect(await consult(s.input, { provider })).toMatchObject({
      status: 'error',
      failure: { code: 'missing_key', exitCode: 3 },
      outcome: { provider: { attempts: 0, requestId: null, usage: null } },
    });
    expect(fakeFetch).not.toHaveBeenCalled();
    expect(s.input.operation.checkpoint('output').ok).toBe(true);
    s.input.operation.dispose();
  });
  it.each(['cancel', 'deadline'] as const)(
    '%s retains dispatch count and suppresses/observes late response',
    async (reason) => {
      const s = setup();
      const gate = deferred<Response>();
      const fakeFetch = vi.fn(() => gate.promise);
      const provider = createTypeSafeProvider({ clock: s.clock, fetch: fakeFetch, configuration });
      const pending = consult(s.input, { provider });
      await flush();
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      if (reason === 'cancel') s.controller.abort();
      else s.clock.advance(15000);
      expect(await pending).toMatchObject({
        status: 'error',
        failure: { code: reason === 'cancel' ? 'operation_cancelled' : 'operation_deadline' },
        outcome: { provider: { attempts: 1, usage: null } },
      });
      gate.reject(new Error('PRIVATE'));
      await flush();
      s.input.operation.dispose();
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('invalid answers retain independently known usage without a judgment or retry', async () => {
    const s = setup();
    const fakeFetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          '{"model":"wrong","answers":{},"usage":{"input_tokens":11,"output_tokens":2}}',
        ),
      ),
    );
    const provider = createTypeSafeProvider({ clock: s.clock, fetch: fakeFetch, configuration });
    expect(await consult(s.input, { provider })).toMatchObject({
      status: 'error',
      failure: { code: 'provider_response_contract' },
      outcome: { provider: { attempts: 1, usage: { inputTokens: 11, outputTokens: 2 } } },
    });
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    s.input.operation.dispose();
  });
  it('elapsed input time reduces the actual SDK attempt timeout', async () => {
    const s = setup();
    s.clock.advance(14000);
    const gate = deferred<Response>();
    const fakeFetch = vi.fn(() => gate.promise);
    const provider = createTypeSafeProvider({ clock: s.clock, fetch: fakeFetch, configuration });
    const pending = consult(s.input, { provider });
    await flush();
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    s.clock.advance(1000, false);
    expect(await pending).toMatchObject({
      status: 'error',
      failure: { code: 'provider_connection' },
      outcome: { provider: { attempts: 1, usage: null } },
    });
    expect(s.input.operation.checkpoint('output')).toMatchObject({
      ok: false,
      error: { code: 'operation_deadline' },
    });
    gate.reject(new Error('late'));
    await flush();
    s.input.operation.dispose();
  });
});
