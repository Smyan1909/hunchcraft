import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consult } from '../../src/application/consult.js';
import { verify } from '../../src/application/verify.js';
import { compileChecks } from '../../src/core/checks.js';
import { completedJudgmentEnvelope } from '../../src/core/result.js';
import { validateTypeSafeConfiguration } from '../../src/providers/typesafe/configuration.js';
import { createTypeSafeProvider } from '../../src/providers/typesafe/provider.js';
import { deferred, flush, response, setup } from '../helpers/consultation-fakes.js';

describe('real SDK / fake HTTP through M1b consult and verify', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it.each(['minimal6', 'csv13'] as const)(
    'commits and verifies every %s check without output or repeat dispatch',
    async (name) => {
      const s = setup(name);
      const plan = compileChecks(s.input.brief);
      if (!plan.ok) throw new Error('invalid plan');
      const fakeFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(response(plan.value)), {
            headers: { 'x-typesafe-request-id': 'offline-only' },
          }),
        ),
      );
      const configuration = vi.fn(() => {
        expect(s.store.admitCalls).toBe(1);
        return Promise.resolve(
          validateTypeSafeConfiguration({
            apiKey: 'dummy',
            baseURL: undefined,
            defaultModel: undefined,
            logLevel: undefined,
          }),
        );
      });
      const provider = createTypeSafeProvider({ configuration, fetch: fakeFetch, clock: s.clock });
      const outcome = await consult(s.input, { ...s.dependencies, provider });
      expect(outcome.status).toBe('ready');
      if (outcome.status !== 'ready') throw new Error('consultation failed');
      expect(outcome.result.checks.map((c) => c.id)).toEqual(plan.value.checks.map((c) => c.id));
      expect(outcome.result.provider.metadata).toEqual({
        origin: 'provider-http',
        attempts: 1,
        requestId: 'offline-only',
        httpStatus: 200,
      });
      expect(s.store.snapshots.get(s.input.sessionId)?.attemptsUsed).toBe(1);
      expect(s.store.snapshots.get(s.input.sessionId)?.activeInvocationId).toBeNull();
      const projection = completedJudgmentEnvelope(outcome.result);
      if (!projection.ok) throw new Error('projection failed');
      const admissions = s.store.admitCalls;
      const finalizations = s.store.finalizeCalls;
      for (const result of [
        { format: 'internal', value: outcome.result } as const,
        { format: 'completed-json', bytes: JSON.stringify(projection.value) } as const,
      ]) {
        expect(await verify({ ...s.input, result }, s.dependencies)).toMatchObject({
          kind: 'verification',
          status: 'applicable-to-supplied-snapshot',
        });
      }
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      expect(configuration).toHaveBeenCalledTimes(1);
      expect(s.store.admitCalls).toBe(admissions);
      expect(s.store.finalizeCalls).toBe(finalizations);
      expect(s.clock.timers.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it('post-admission configuration failure consumes count, dispatches zero, confirms unavailable', async () => {
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
    expect(await consult(s.input, { ...s.dependencies, provider })).toMatchObject({
      status: 'error',
      outcome: {
        error: { code: 'missing_key' },
        provider: { metadata: { attempts: 0 }, usage: null },
      },
      cleanup: { status: 'confirmed' },
    });
    expect(fakeFetch).not.toHaveBeenCalled();
    expect(s.store.snapshots.get(s.input.sessionId)?.attemptsUsed).toBe(1);
    expect(s.store.checkCalls).toBe(0);
  });
  it.each(['cancel', 'deadline'] as const)(
    'application %s precedence retains fake HTTP count and suppresses late response',
    async (reason) => {
      const s = setup();
      const gate = deferred<Response>();
      const fakeFetch = vi.fn(() => gate.promise);
      const provider = createTypeSafeProvider({
        clock: s.clock,
        fetch: fakeFetch,
        configuration: () =>
          Promise.resolve(
            validateTypeSafeConfiguration({
              apiKey: 'dummy',
              baseURL: undefined,
              defaultModel: undefined,
              logLevel: undefined,
            }),
          ),
      });
      const pending = consult(s.input, { ...s.dependencies, provider });
      await flush();
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      if (reason === 'cancel') s.controller.abort();
      else s.clock.advance(15000);
      expect(await pending).toMatchObject({
        status: 'error',
        outcome: {
          error: { code: reason === 'cancel' ? 'operation_cancelled' : 'operation_deadline' },
          provider: { metadata: { attempts: 1 }, usage: null },
        },
        cleanup: { status: 'confirmed' },
      });
      gate.reject(new Error('PRIVATE'));
      await flush();
      expect(s.store.snapshots.get(s.input.sessionId)?.activeInvocationId).toBeNull();
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('invalid reply retains known usage in failure and terminalizes without judgment', async () => {
    const s = setup();
    const provider = createTypeSafeProvider({
      clock: s.clock,
      fetch: () =>
        Promise.resolve(
          new Response(
            '{"model":"wrong","answers":{},"usage":{"input_tokens":11,"output_tokens":2}}',
          ),
        ),
      configuration: () =>
        Promise.resolve(
          validateTypeSafeConfiguration({
            apiKey: 'dummy',
            baseURL: undefined,
            defaultModel: undefined,
            logLevel: undefined,
          }),
        ),
    });
    expect(await consult(s.input, { ...s.dependencies, provider })).toMatchObject({
      status: 'error',
      outcome: {
        error: { code: 'provider_response_contract' },
        provider: {
          usage: { inputTokens: 11, outputTokens: 2 },
          metadata: { attempts: 1, httpStatus: 200 },
        },
      },
      cleanup: { status: 'confirmed' },
    });
    expect(s.store.snapshots.get(s.input.sessionId)?.attemptsUsed).toBe(1);
  });
});
