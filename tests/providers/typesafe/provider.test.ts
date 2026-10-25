import type { Fetch } from '@typesafe-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileChecks } from '../../../src/core/checks.js';
import {
  ClassifiedFailure,
  failure,
  progressConsistent,
  reconstructProgress,
} from '../../../src/core/result.js';
import type { EvaluationControl } from '../../../src/ports/decision-provider.js';
import { validateTypeSafeConfiguration } from '../../../src/providers/typesafe/configuration.js';
import { createTypeSafeProvider } from '../../../src/providers/typesafe/provider.js';
import { deferred, FakeClock, fixture, flush, response } from '../../helpers/consultation-fakes.js';

function setup(fetch?: Fetch, name: 'minimal6' | 'csv13' = 'minimal6') {
  const compiled = compileChecks(fixture(name).brief);
  if (!compiled.ok) throw new Error('invalid fixture');
  const plan = compiled.value;
  const clock = new FakeClock();
  const controller = new AbortController();
  const progress: unknown[] = [];
  const guard = vi.fn(() => Promise.resolve());
  const control: EvaluationControl = {
    signal: controller.signal,
    remainingMs: () => 15000 - clock.monotonic,
    beforeDispatch: guard,
    onProgress: (value) => {
      progress.push(value);
    },
  };
  const configuration = vi.fn(() =>
    Promise.resolve(
      validateTypeSafeConfiguration({
        apiKey: 'dummy-offline-key',
        baseURL: undefined,
        defaultModel: undefined,
        logLevel: 'debug',
      }),
    ),
  );
  const fakeFetch = vi.fn<Fetch>(
    fetch ??
      (() =>
        Promise.resolve(
          new Response(JSON.stringify(response(plan)), {
            headers: { 'x-typesafe-request-id': 'offline_123' },
          }),
        )),
  );
  const provider = createTypeSafeProvider({ configuration, fetch: fakeFetch, clock });
  return {
    plan,
    clock,
    controller,
    progress,
    guard,
    control,
    configuration,
    fakeFetch,
    provider,
    evaluate: () => provider.evaluate(plan, plan.state, control),
  };
}

describe('pinned real SDK through exclusively fake HTTP', () => {
  it('configuration wait disposal fault returns fixed internal failure without guard or fetch', async () => {
    const s = setup();
    const originalSchedule = s.clock.schedule.bind(s.clock);
    const cancel = vi.fn();
    vi.spyOn(s.clock, 'schedule').mockImplementation((delay, callback) => {
      const originalCancel = originalSchedule(delay, callback);
      return () => {
        cancel();
        originalCancel();
        throw new Error('PRIVATE-TIMER-SENTINEL');
      };
    });
    const removal = vi.spyOn(s.controller.signal, 'removeEventListener');
    let settled = false;
    const pending = s.evaluate().then((outcome) => {
      settled = true;
      return outcome;
    });
    await flush();
    expect(settled).toBe(true);
    const outcome = await pending;
    expect(outcome).toEqual({
      ok: false,
      error: failure('internal_failure', 'internal'),
      metadata: { origin: 'provider-http', attempts: 0, requestId: null, httpStatus: null },
      usage: null,
    });
    expect(JSON.stringify(outcome)).not.toContain('PRIVATE');
    expect(s.configuration).toHaveBeenCalledTimes(1);
    expect(s.guard).not.toHaveBeenCalled();
    expect(s.fakeFetch).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(removal).toHaveBeenCalledTimes(1);
    expect(s.clock.timers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['guard', 'fetch'] as const)(
    'rejects prototype/payload spoofs from %s without inspecting secrets',
    async (source) => {
      for (const accessor of [false, true]) {
        let reads = 0;
        const spoof = new Error('PRIVATE-SDK-BODY-SENTINEL');
        Object.setPrototypeOf(spoof, ClassifiedFailure.prototype);
        Object.defineProperty(
          spoof,
          'failure',
          accessor
            ? {
                get() {
                  reads++;
                  throw new Error('PRIVATE-PAYLOAD-SENTINEL');
                },
              }
            : {
                value: {
                  ...failure('operation_cancelled', 'provider'),
                  message: 'PRIVATE-PAYLOAD-SENTINEL',
                },
              },
        );
        const s = setup();
        if (source === 'guard') s.guard.mockRejectedValue(spoof);
        else s.fakeFetch.mockRejectedValue(spoof);
        const outcome = await s.evaluate();
        expect(outcome).toMatchObject({
          ok: false,
          error: failure('provider_connection', 'provider'),
          metadata: { attempts: source === 'guard' ? 0 : 1 },
          usage: null,
        });
        expect(reads).toBe(0);
        expect(JSON.stringify(outcome)).not.toContain('PRIVATE');
        expect(s.guard).toHaveBeenCalledTimes(1);
        expect(s.fakeFetch).toHaveBeenCalledTimes(source === 'guard' ? 0 : 1);
        expect(s.clock.timers.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
      }
    },
  );
  it.each(['guard', 'fetch'] as const)(
    'preserves constructor-validated failure after rejected mutation from %s',
    async (source) => {
      const constructed = new ClassifiedFailure(failure('operation_cancelled', 'provider'));
      expect(Reflect.set(constructed, 'failure', { message: 'PRIVATE-MUTATION-SENTINEL' })).toBe(
        false,
      );
      expect(
        Reflect.defineProperty(constructed, 'failure', {
          get() {
            throw new Error('PRIVATE');
          },
        }),
      ).toBe(false);
      const s = setup();
      if (source === 'guard') s.guard.mockRejectedValue(constructed);
      else s.fakeFetch.mockRejectedValue(constructed);
      const outcome = await s.evaluate();
      expect(outcome).toMatchObject({
        ok: false,
        error: failure('operation_cancelled', 'provider'),
        metadata: { attempts: source === 'guard' ? 0 : 1 },
        usage: null,
      });
      expect(JSON.stringify(outcome)).not.toContain('PRIVATE');
      expect(s.fakeFetch).toHaveBeenCalledTimes(source === 'guard' ? 0 : 1);
      expect(s.clock.timers.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it('requires fetch injection even when global fetch is present', async () => {
    const s = setup();
    const globalFetch = vi.fn(() => Promise.reject(new Error('unexpected global fetch')));
    const dependencies = { configuration: s.configuration, clock: s.clock, fetch: s.fakeFetch };
    Object.defineProperty(dependencies, 'fetch', { value: undefined });
    vi.stubGlobal('fetch', globalFetch);
    try {
      const provider = createTypeSafeProvider(dependencies);
      expect(await provider.evaluate(s.plan, s.plan.state, s.control)).toMatchObject({
        ok: false,
        error: { code: 'configuration_conflict' },
        metadata: { attempts: 0 },
      });
      expect(globalFetch).not.toHaveBeenCalled();
      expect(s.configuration).not.toHaveBeenCalled();
      expect(s.guard).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('explicit SDK options do not read any TypeSafe credential/config environment fallback', async () => {
    const s = setup();
    const original = process.env;
    let reads = 0;
    process.env = new Proxy(original, {
      get(target, key) {
        if (typeof key === 'string' && key.startsWith('TYPESAFE_')) {
          reads++;
          throw new Error('credential fallback read');
        }
        return Reflect.get(target, key) as unknown;
      },
    });
    try {
      expect((await s.evaluate()).ok).toBe(true);
      expect(reads).toBe(0);
    } finally {
      process.env = original;
    }
  });
  it('SDK construction refusal never enters guard or transport', async () => {
    const s = setup();
    vi.stubGlobal('window', { document: {} });
    vi.stubGlobal('navigator', {});
    try {
      expect(await s.evaluate()).toMatchObject({
        ok: false,
        error: { code: 'configuration_conflict' },
        metadata: { attempts: 0 },
      });
      expect(s.guard).not.toHaveBeenCalled();
      expect(s.fakeFetch).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('SDK attempt timeout bounds ignored-abort body receipt, retaining known headers', async () => {
    const cancel = vi.fn();
    const s = setup(() =>
      Promise.resolve(
        new Response(new ReadableStream({ cancel }), {
          headers: { 'x-typesafe-request-id': 'body-known' },
        }),
      ),
    );
    const pending = s.evaluate();
    await flush();
    await vi.advanceTimersByTimeAsync(10000);
    expect(await pending).toMatchObject({
      ok: false,
      error: { code: 'provider_connection' },
      metadata: { attempts: 1, httpStatus: 200, requestId: 'body-known' },
      usage: null,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(s.clock.timers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('real SDK validates a full successful reply padded/chunked to exactly 256 KiB', async () => {
    const s = setup();
    const raw = JSON.stringify(response(s.plan));
    const bytes = new TextEncoder().encode(raw + ' '.repeat(256 * 1024 - raw.length));
    s.fakeFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(bytes.subarray(0, 100));
              c.enqueue(bytes.subarray(100));
              c.close();
            },
          }),
        ),
      ),
    );
    expect(await s.evaluate()).toMatchObject({
      ok: true,
      value: { usage: { inputTokens: 120, outputTokens: 24 } },
    });
    expect(s.fakeFetch).toHaveBeenCalledTimes(1);
    expect(s.clock.timers.size).toBe(0);
  });
  it('post-guard elapsed timeout stops dispatch and clears SDK native timer even without timer notification', async () => {
    const s = setup();
    s.guard.mockImplementation(() => {
      s.clock.advance(15000, false);
      return Promise.resolve();
    });
    expect(await s.evaluate()).toMatchObject({ ok: false, metadata: { attempts: 0 } });
    expect(s.fakeFetch).not.toHaveBeenCalled();
    expect(s.clock.timers.size).toBe(0);
    await flush();
    expect(vi.getTimerCount()).toBe(0);
  });
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(['minimal6', 'csv13'] as const)(
    'sends exact projected state/questions, returns all %s bindings and stable progress',
    async (name) => {
      const s = setup(undefined, name);
      expect(s.provider.origin).toBe('provider-http');
      expect(s.configuration).not.toHaveBeenCalled();
      const result = await s.evaluate();
      expect(result.ok).toBe(true);
      expect(s.guard).toHaveBeenCalledTimes(1);
      expect(s.fakeFetch).toHaveBeenCalledTimes(1);
      const call = s.fakeFetch.mock.calls[0];
      if (!call) throw new Error('missing dispatch');
      expect(call[0]).toBe('https://api.typesafe.ai/v1/systemone');
      expect(call[1]).toMatchObject({
        method: 'POST',
        redirect: 'error',
        body: JSON.stringify({
          state: s.plan.state,
          model: 'jev-1.13.0',
          questions: s.plan.questions,
        }),
      });
      const headers = new Headers(call[1]?.headers);
      expect([...headers.keys()]).toEqual([
        'accept',
        'authorization',
        'content-type',
        'user-agent',
        'x-typesafe-runtime',
        'x-typesafe-sdk',
      ]);
      expect(headers.get('authorization')).toBe('Bearer dummy-offline-key');
      if (!result.ok) throw new Error('invalid reply');
      expect(Object.keys(result.value.answers)).toEqual(s.plan.checks.map((c) => c.wireId));
      expect(result.value.metadata).toEqual({
        origin: 'provider-http',
        attempts: 1,
        httpStatus: 200,
        requestId: 'offline_123',
      });
      expect(result.value.usage).toEqual({ inputTokens: 120, outputTokens: 24 });
      let previous = reconstructProgress({
        metadata: { origin: 'provider-http', attempts: 0, requestId: null, httpStatus: null },
        usage: null,
      });
      for (const value of [
        ...s.progress,
        { metadata: result.value.metadata, usage: result.value.usage },
      ]) {
        const next = reconstructProgress(value);
        expect(next.ok).toBe(true);
        if (!next.ok || !previous.ok) throw new Error('bad progress');
        expect(progressConsistent(previous.value, next.value)).toBe(true);
        previous = next;
      }
      expect(s.clock.timers.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('does not inherit poisoned environment/options or emit SDK logs', async () => {
    for (const [key, value] of Object.entries({
      TYPESAFE_API_KEY: 'dummy-poison',
      TYPESAFE_BASE_URL: 'https://poison.invalid',
      TYPESAFE_DEFAULT_MODEL: 'poison',
      TYPESAFE_LOG_LEVEL: 'debug',
    }))
      vi.stubEnv(key, value);
    const spies = [
      vi.spyOn(console, 'debug'),
      vi.spyOn(console, 'info'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
    ];
    const s = setup();
    expect((await s.evaluate()).ok).toBe(true);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(JSON.stringify(s.fakeFetch.mock.calls)).not.toContain('poison');
  });

  it('configuration failure has zero guard/dispatch attempts after lazy activation', async () => {
    const s = setup();
    s.configuration.mockImplementation(() =>
      Promise.resolve(
        validateTypeSafeConfiguration({
          apiKey: undefined,
          baseURL: undefined,
          defaultModel: undefined,
          logLevel: undefined,
        }),
      ),
    );
    expect(await s.evaluate()).toMatchObject({
      ok: false,
      error: { code: 'missing_key' },
      metadata: { attempts: 0 },
      usage: null,
    });
    expect(s.guard).not.toHaveBeenCalled();
    expect(s.fakeFetch).not.toHaveBeenCalled();
  });

  it('configuration that ignores cancellation settles finitely without late dispatch', async () => {
    const s = setup();
    const gate = deferred<ReturnType<typeof validateTypeSafeConfiguration>>();
    s.configuration.mockImplementation(() => gate.promise);
    const pending = s.evaluate();
    await flush();
    s.controller.abort();
    expect(await pending).toMatchObject({ ok: false, metadata: { attempts: 0 } });
    gate.resolve(
      validateTypeSafeConfiguration({
        apiKey: 'dummy',
        baseURL: undefined,
        defaultModel: undefined,
        logLevel: undefined,
      }),
    );
    await flush();
    expect(s.guard).not.toHaveBeenCalled();
    expect(s.fakeFetch).not.toHaveBeenCalled();
    expect(s.clock.timers.size).toBe(0);
  });

  it('preserves classified guard denial through SDK wrapping', async () => {
    const s = setup();
    s.guard.mockRejectedValue(new ClassifiedFailure(failure('operation_cancelled', 'provider')));
    expect(await s.evaluate()).toMatchObject({
      ok: false,
      error: { code: 'operation_cancelled' },
      metadata: { attempts: 0 },
    });
    expect(s.fakeFetch).not.toHaveBeenCalled();
  });

  it('SDK attempt signal stops a late ignoring-abort guard before dispatch', async () => {
    const s = setup();
    const gate = deferred<void>();
    s.guard.mockImplementation(() => gate.promise);
    const pending = s.evaluate();
    await flush();
    await vi.advanceTimersByTimeAsync(10000);
    expect(await pending).toMatchObject({
      ok: false,
      error: { code: 'provider_connection' },
      metadata: { attempts: 0 },
    });
    gate.resolve();
    await flush();
    expect(s.fakeFetch).not.toHaveBeenCalled();
    expect(s.clock.timers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([401, 403, 422, 429, 500, 529])(
    'sanitizes HTTP %i and never retries, retaining strict valid usage',
    async (status) => {
      const s = setup(() =>
        Promise.resolve(
          new Response(
            '{"message":"PRIVATE-BODY-SENTINEL","usage":{"input_tokens":17,"output_tokens":3}}',
            {
              status,
              headers: {
                'x-typesafe-request-id': 'safe-id',
                'x-private': 'PRIVATE-HEADER-SENTINEL',
              },
            },
          ),
        ),
      );
      const result = await s.evaluate();
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'provider_http' },
        metadata: { attempts: 1, httpStatus: status, requestId: 'safe-id' },
        usage: { inputTokens: 17, outputTokens: 3 },
      });
      expect(JSON.stringify(result)).not.toContain('PRIVATE');
      expect(s.fakeFetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([300, 301, 302, 303, 304, 307, 308, 399])(
    'refuses redirect %i without a follow-up',
    async (status) => {
      const s = setup(() =>
        Promise.resolve(
          new Response(null, { status, headers: { location: 'https://private.invalid' } }),
        ),
      );
      expect(await s.evaluate()).toMatchObject({
        ok: false,
        error: { code: 'redirect_refused' },
        metadata: { attempts: 1, httpStatus: status },
      });
      expect(s.fakeFetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['sync', 'reject'] as const)(
    'records attempt before %s fetch failure, never inspects thrown data',
    async (mode) => {
      const hostile = new Proxy(new Error('PRIVATE'), {
        get: () => {
          throw new Error('PRIVATE');
        },
      });
      const s = setup(() => {
        expect(s.progress[0]).toMatchObject({ metadata: { attempts: 1 }, usage: null });
        if (mode === 'sync') throw hostile;
        return Promise.reject(hostile);
      });
      const result = await s.evaluate();
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'provider_connection' },
        metadata: { attempts: 1 },
        usage: null,
      });
      expect(JSON.stringify(result)).not.toContain('PRIVATE');
      expect(s.fakeFetch).toHaveBeenCalledTimes(1);
    },
  );

  it('attempt timeout bounds ignoring-abort fetch and cancels a late response body', async () => {
    const gate = deferred<Response>();
    const cancel = vi.fn();
    const s = setup(() => gate.promise);
    const pending = s.evaluate();
    await flush();
    await vi.advanceTimersByTimeAsync(10000);
    expect(await pending).toMatchObject({
      ok: false,
      error: { code: 'provider_connection' },
      metadata: { attempts: 1, httpStatus: null },
    });
    const progressCount = s.progress.length;
    gate.resolve(new Response(new ReadableStream({ cancel })));
    await flush();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(s.progress.length).toBe(progressCount);
    expect(s.clock.timers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('outer cancellation retains dispatch metadata and observes a late rejection', async () => {
    const gate = deferred<Response>();
    const s = setup(() => gate.promise);
    const pending = s.evaluate();
    await flush();
    s.controller.abort();
    expect(await pending).toMatchObject({ ok: false, metadata: { attempts: 1 }, usage: null });
    gate.reject(new Error('PRIVATE'));
    await flush();
    expect(s.fakeFetch).toHaveBeenCalledTimes(1);
    expect(s.clock.timers.size).toBe(0);
  });

  it.each([
    'wrong-model',
    'missing-answer',
    'legend',
    'sum',
    'score',
    'confidence',
    'noul-confidence',
    'extra-root',
  ] as const)('rejects %s while preserving independently strict usage', async (mutation) => {
    const s = setup();
    const raw = JSON.stringify(response(s.plan));
    const parsed: unknown = JSON.parse(raw);
    // Mutations act on test-owned JSON only, using own descriptors rather than schema casts.
    if (parsed === null || typeof parsed !== 'object') throw new Error('bad fixture');
    const answers: unknown = Object.getOwnPropertyDescriptor(parsed, 'answers')?.value;
    if (answers === null || typeof answers !== 'object') throw new Error('bad fixture');
    const scoreCheck = s.plan.checks.find((c) => c.question.type === 'score');
    if (!scoreCheck) throw new Error('no score');
    const score: unknown = Object.getOwnPropertyDescriptor(answers, scoreCheck.wireId)?.value;
    if (score === null || typeof score !== 'object') throw new Error('bad fixture');
    if (mutation === 'wrong-model') Object.assign(parsed, { model: 'jev-latest' });
    if (mutation === 'missing-answer') Reflect.deleteProperty(answers, 'q001');
    if (mutation === 'legend')
      Object.assign(score, { legend: { '0': 'wrong', '1': 'wrong', '2': 'wrong' } });
    if (mutation === 'sum')
      Object.assign(score, { probabilities: { '0': 0.1, '1': 0.3, '2': 0.5 } });
    if (mutation === 'score') Object.assign(score, { score: 0 });
    if (mutation === 'confidence') Object.assign(score, { confidence: 1.1 });
    if (mutation === 'noul-confidence')
      Object.assign(answers, { q001: { type: 'noul', noul: 0.5, confidence: 1 } });
    if (mutation === 'extra-root') Object.assign(parsed, { approved: true });
    s.fakeFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(parsed))));
    expect(await s.evaluate()).toMatchObject({
      ok: false,
      error: { code: 'provider_response_contract' },
      usage: { inputTokens: 120, outputTokens: 24 },
      metadata: { attempts: 1, httpStatus: 200 },
    });
  });

  it.each([
    '{"model":"jev-1.13.0","answers":{"q001":{},"q\u005cu0030\u005cu0030\u005cu0031":{}},"usage":{"input_tokens":1,"output_tokens":1}}',
    '{"model":"jev-1.13.0","answers":{"q001":{"probabilities":{"0":0.1,"\u005cu0030":0.1}}},"usage":{"input_tokens":1,"output_tokens":1}}',
    '{"usage":{"input_tokens":1.00000000000000001,"output_tokens":1}}',
    '{"usage":{"input_tokens":-0,"output_tokens":1}}',
    '\ufeff{}',
    '{"a":1e999}',
    '{"__proto__":{}}',
    'not JSON PRIVATE',
  ])(
    'strictly rejects raw body before SDK can erase violations, with unknown usage',
    async (raw) => {
      const s = setup(() => Promise.resolve(new Response(raw)));
      expect(await s.evaluate()).toMatchObject({
        ok: false,
        error: { code: 'provider_response_contract' },
        usage: null,
      });
    },
  );

  it.each(['missing', 'fractional', 'negative', 'unsafe'] as const)(
    'requires valid %s successful usage',
    async (kind) => {
      const s = setup();
      const raw = JSON.stringify(response(s.plan));
      const changed =
        kind === 'missing'
          ? raw.replace(',"usage":{"input_tokens":120,"output_tokens":24}', '')
          : raw.replace(
              '"input_tokens":120',
              `"input_tokens":${kind === 'fractional' ? '0.1' : kind === 'negative' ? '-1' : '9007199254740992'}`,
            );
      s.fakeFetch.mockImplementation(() => Promise.resolve(new Response(changed)));
      expect(await s.evaluate()).toMatchObject({
        ok: false,
        error: { code: 'provider_response_contract' },
        usage: null,
      });
    },
  );

  it.each(['bad id!', 'x'.repeat(129)])('drops invalid request ID without echo', async (id) => {
    const s = setup();
    s.fakeFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(response(s.plan)), {
          headers: { 'x-typesafe-request-id': id },
        }),
      ),
    );
    expect(await s.evaluate()).toMatchObject({
      ok: true,
      value: { metadata: { requestId: null } },
    });
  });
});
