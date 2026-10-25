import type { Fetch } from '@typesafe-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassifiedFailure, failure } from '../../../src/core/result.js';
import { validateTypeSafeConfiguration } from '../../../src/providers/typesafe/configuration.js';
import { boundedWait, createGuardedFetch } from '../../../src/providers/typesafe/transport.js';
import { deferred, FakeClock, flush } from '../../helpers/consultation-fakes.js';

const url = 'https://api.typesafe.ai/v1/systemone';
const raw = '{"usage":{"input_tokens":1,"output_tokens":2}}';
function setup(fetch: Fetch = () => Promise.resolve(new Response(raw))) {
  const clock = new FakeClock();
  const controller = new AbortController();
  const attempt = new AbortController();
  const configuration = validateTypeSafeConfiguration({
    apiKey: 'dummy',
    baseURL: undefined,
    defaultModel: undefined,
    logLevel: undefined,
  });
  if (!configuration.ok) throw new Error('configuration invalid');
  const guard = vi.fn(() => Promise.resolve());
  const underlying = vi.fn(fetch);
  const progress: unknown[] = [];
  const transport = createGuardedFetch({
    fetch: underlying,
    clock,
    configuration: configuration.value,
    body: '{"state":"offline"}',
    control: {
      signal: controller.signal,
      remainingMs: () => 15000 - clock.monotonic,
      beforeDispatch: guard,
      onProgress: (v) => {
        progress.push(v);
      },
    },
  });
  const init: RequestInit = {
    method: 'POST',
    body: '{"state":"offline"}',
    signal: attempt.signal,
    headers: {
      Authorization: 'Bearer dummy',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'typesafe-sdk/0.6.0',
      'X-TypeSafe-SDK': 'typesafe-sdk/0.6.0',
      'X-TypeSafe-Runtime': `node/${process.versions.node} (${process.platform}; ${process.arch})`,
    },
  };
  return { clock, controller, attempt, guard, underlying, transport, init, progress };
}

describe('one-shot capped guarded fetch', () => {
  it.each(['success', 'rejection', 'abort', 'deadline'] as const)(
    'settles %s finitely when timer cancellation throws, removes both signals and preserves primary failures',
    async (terminal) => {
      const clock = new FakeClock();
      const outer = new AbortController();
      const attempt = new AbortController();
      const removals = [
        vi.spyOn(outer.signal, 'removeEventListener'),
        vi.spyOn(attempt.signal, 'removeEventListener'),
      ];
      const registrations = [
        vi.spyOn(outer.signal, 'addEventListener'),
        vi.spyOn(attempt.signal, 'addEventListener'),
      ];
      const gate = deferred<string>();
      const originalSchedule = clock.schedule.bind(clock);
      let scheduledCallback = (): void => {};
      const cancel = vi.fn();
      vi.spyOn(clock, 'schedule').mockImplementation((delay, callback) => {
        scheduledCallback = callback;
        const originalCancel = originalSchedule(delay, callback);
        return () => {
          cancel();
          originalCancel();
          throw new Error('PRIVATE-DISPOSAL-SENTINEL');
        };
      });
      const pending = boundedWait(
        () => gate.promise,
        clock,
        () => Math.max(0, 100 - clock.monotonic),
        [outer.signal, attempt.signal],
      );
      let settled = false;
      const observed = pending.then((result) => {
        settled = true;
        return result;
      });
      if (terminal === 'success') gate.resolve('value');
      else if (terminal === 'rejection')
        gate.reject(new ClassifiedFailure(failure('provider_http', 'provider')));
      else if (terminal === 'abort') attempt.abort();
      else clock.advance(100);
      await flush();
      expect(settled).toBe(true);
      const outcome = await observed;
      const expected =
        terminal === 'success'
          ? failure('internal_failure', 'internal')
          : terminal === 'rejection'
            ? failure('provider_http', 'provider')
            : failure('provider_connection', 'provider');
      expect(outcome).toEqual({ ok: false, error: expected });
      expect(JSON.stringify(outcome)).not.toContain('PRIVATE');
      expect(cancel).toHaveBeenCalledTimes(1);
      for (let i = 0; i < removals.length; i++) {
        expect(removals[i]).toHaveBeenCalledTimes(1);
        expect(removals[i]?.mock.calls[0]).toEqual(registrations[i]?.mock.calls[0]?.slice(0, 2));
      }
      expect(clock.timers.size).toBe(0);
      // Even a faulty scheduler delivering its cancelled callback cannot re-finalize.
      scheduledCallback();
      outer.abort();
      attempt.abort();
      gate.reject(new Error('PRIVATE-LATE-REJECTION'));
      await flush();
      expect(cancel).toHaveBeenCalledTimes(1);
      for (const removal of removals) {
        expect(removal).toHaveBeenCalledTimes(1);
        removal.mockRestore();
      }
      for (const registration of registrations) registration.mockRestore();
      expect(await pending).toBe(outcome);
    },
  );
  it.each(['success', 'rejection'] as const)(
    'attempts every listener removal after a removal fault on %s',
    async (terminal) => {
      const clock = new FakeClock();
      const outer = new AbortController();
      const attempt = new AbortController();
      const remove = outer.signal.removeEventListener.bind(outer.signal);
      const first = vi.spyOn(outer.signal, 'removeEventListener').mockImplementation((...args) => {
        remove(...args);
        throw new Error('PRIVATE-REMOVAL-SENTINEL');
      });
      const second = vi.spyOn(attempt.signal, 'removeEventListener');
      const gate = deferred<void>();
      const pending = boundedWait(
        () => gate.promise,
        clock,
        () => 100,
        [outer.signal, attempt.signal],
      );
      if (terminal === 'success') gate.resolve();
      else gate.reject(new ClassifiedFailure(failure('provider_http', 'provider')));
      let settled = false;
      const observed = pending.then((result) => {
        settled = true;
        return result;
      });
      await flush();
      expect(settled).toBe(true);
      expect(await observed).toEqual({
        ok: false,
        error:
          terminal === 'success'
            ? failure('internal_failure', 'internal')
            : failure('provider_http', 'provider'),
      });
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      expect(clock.timers.size).toBe(0);
      first.mockRestore();
      second.mockRestore();
    },
  );
  it.each(['initial-checkpoint', 'settled-checkpoint', 'synchronous-start'] as const)(
    'sanitizes forged payload at bounded-wait %s catch without invoking its accessor',
    async (site) => {
      const clock = new FakeClock();
      const controller = new AbortController();
      let reads = 0;
      const spoof = new Error('PRIVATE');
      Object.setPrototypeOf(spoof, ClassifiedFailure.prototype);
      Object.defineProperty(spoof, 'failure', {
        get() {
          reads++;
          throw new Error('PRIVATE');
        },
      });
      let samples = 0;
      const remaining = (): number => {
        samples++;
        if (site === 'initial-checkpoint' || (site === 'settled-checkpoint' && samples === 4))
          throw spoof;
        return 100;
      };
      const result = await boundedWait(
        () => {
          if (site === 'synchronous-start') throw spoof;
          return Promise.resolve();
        },
        clock,
        remaining,
        [controller.signal],
      );
      expect(result).toEqual({
        ok: false,
        error: failure(
          site === 'synchronous-start' ? 'provider_connection' : 'internal_failure',
          site === 'synchronous-start' ? 'provider' : 'internal',
        ),
      });
      expect(reads).toBe(0);
      expect(JSON.stringify(result)).not.toContain('PRIVATE');
      expect(clock.timers.size).toBe(0);
    },
  );
  it.each(['guard', 'fetch'] as const)(
    'sanitizes forged classified exceptions from %s without reading payload accessors',
    async (source) => {
      for (const accessor of [false, true]) {
        let reads = 0;
        const spoof = new Error('PRIVATE-EXCEPTION-SENTINEL');
        Object.setPrototypeOf(spoof, ClassifiedFailure.prototype);
        Object.defineProperty(
          spoof,
          'failure',
          accessor
            ? {
                get() {
                  reads++;
                  throw new Error('PRIVATE-GETTER-SENTINEL');
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
        else s.underlying.mockRejectedValue(spoof);
        await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
          failure: failure('provider_connection', 'provider'),
        });
        expect(s.transport.error()).toEqual(failure('provider_connection', 'provider'));
        expect(s.transport.snapshot()).toMatchObject({
          metadata: { attempts: source === 'guard' ? 0 : 1 },
          usage: null,
        });
        expect(reads).toBe(0);
        expect(JSON.stringify(s.transport.error())).not.toContain('PRIVATE');
        expect(s.underlying).toHaveBeenCalledTimes(source === 'guard' ? 0 : 1);
        await s.transport.dispose();
        expect(s.clock.timers.size).toBe(0);
      }
    },
  );
  it.each(['guard', 'fetch'] as const)(
    'retains private validated payload after rejected construction mutation from %s',
    async (source) => {
      const constructed = new ClassifiedFailure(failure('operation_deadline', 'provider'));
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
      else s.underlying.mockRejectedValue(constructed);
      await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
        failure: failure('operation_deadline', 'provider'),
      });
      expect(s.transport.error()).toEqual(failure('operation_deadline', 'provider'));
      expect(s.transport.snapshot().metadata.attempts).toBe(source === 'guard' ? 0 : 1);
      expect(JSON.stringify(s.transport.error())).not.toContain('PRIVATE');
      await s.transport.dispose();
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('rejects RequestInit accessors without executing them', async () => {
    const s = setup();
    let reads = 0;
    Object.defineProperty(s.init, 'body', {
      get() {
        reads++;
        throw new Error('PRIVATE');
      },
    });
    await expect(s.transport.fetch(url, s.init)).rejects.toBeInstanceOf(ClassifiedFailure);
    expect(reads).toBe(0);
    expect(s.guard).not.toHaveBeenCalled();
    expect(s.underlying).not.toHaveBeenCalled();
    await s.transport.dispose();
  });
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it.each([
    'http://api.typesafe.ai/v1/systemone',
    'https://api.typesafe.ai/v1/systemone?secret',
    'https://api.typesafe.ai/v1/systemone#secret',
    'https://dummy@api.typesafe.ai/v1/systemone',
    'https://api.typesafe.ai/v1/models',
    'https://api.typesafe.ai:443/v1/systemone',
    'https://other.invalid/v1/systemone',
  ])('refuses destination %s before guard', async (destination) => {
    const s = setup();
    await expect(s.transport.fetch(destination, s.init)).rejects.toBeInstanceOf(ClassifiedFailure);
    expect(s.transport.error()?.code).toBe('configuration_conflict');
    expect(s.guard).not.toHaveBeenCalled();
    expect(s.underlying).not.toHaveBeenCalled();
    await s.transport.dispose();
  });
  it.each([
    { method: 'GET' },
    { body: '{"state":"offline","extra":"private"}' },
    { body: '{ "state":"offline"}' },
    { redirect: 'follow' },
    { credentials: 'include' },
    { signal: null },
    { signal: undefined },
    { headers: { Authorization: 'Bearer dummy' } },
  ])('refuses changed request properties before guard', async (changes) => {
    const s = setup();
    // Unknown request variations are test-only external values, not production casts.
    const changed = { ...s.init };
    for (const [key, value] of Object.entries(changes))
      Object.defineProperty(changed, key, { value, enumerable: true, configurable: true });
    await expect(s.transport.fetch(url, changed)).rejects.toBeInstanceOf(ClassifiedFailure);
    expect(s.guard).not.toHaveBeenCalled();
    expect(s.underlying).not.toHaveBeenCalled();
    await s.transport.dispose();
  });
  it.each(['x-private', 'cookie', 'x-typesafe-retry-count', 'proxy-authorization'])(
    'refuses unexpected header %s',
    async (name) => {
      const s = setup();
      const headers = new Headers(s.init.headers);
      headers.set(name, 'PRIVATE');
      await expect(s.transport.fetch(url, { ...s.init, headers })).rejects.toBeInstanceOf(
        ClassifiedFailure,
      );
      expect(s.guard).not.toHaveBeenCalled();
      expect(s.underlying).not.toHaveBeenCalled();
      await s.transport.dispose();
    },
  );
  it('accepts supported Headers representation/casing and forces redirect error', async () => {
    const s = setup();
    const result = await s.transport.fetch(url, {
      ...s.init,
      headers: new Headers(s.init.headers),
    });
    expect(await result.text()).toBe(raw);
    expect(s.underlying.mock.calls[0]?.[1]?.redirect).toBe('error');
    expect(s.transport.snapshot()).toMatchObject({
      metadata: { attempts: 1, httpStatus: 200 },
      usage: { inputTokens: 1, outputTokens: 2 },
    });
    await s.transport.dispose();
    expect(s.clock.timers.size).toBe(0);
  });
  it('rejects concurrent/repeated SDK dispatch instead of sharing guard success', async () => {
    const s = setup();
    const gate = deferred<void>();
    s.guard.mockImplementation(() => gate.promise);
    const pending = s.transport.fetch(url, s.init);
    await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
      failure: { code: 'internal_failure' },
    });
    gate.resolve();
    await expect(pending).rejects.toMatchObject({ failure: { code: 'internal_failure' } });
    expect(s.guard).toHaveBeenCalledTimes(1);
    expect(s.underlying).not.toHaveBeenCalled();
    await s.transport.dispose();
  });
  it.each(['outer', 'attempt'] as const)(
    'observes %s abort during a hung guard and prevents late dispatch',
    async (signal) => {
      const s = setup();
      const gate = deferred<void>();
      s.guard.mockImplementation(() => gate.promise);
      const pending = s.transport.fetch(url, s.init);
      await flush();
      (signal === 'outer' ? s.controller : s.attempt).abort();
      await expect(pending).rejects.toMatchObject({ failure: { code: 'provider_connection' } });
      gate.resolve();
      await flush();
      expect(s.underlying).not.toHaveBeenCalled();
      expect(s.transport.snapshot().metadata.attempts).toBe(0);
      await s.transport.dispose();
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('elapsed deadline after guard wins even before scheduled timer notification', async () => {
    const s = setup();
    s.guard.mockImplementation(() => {
      s.clock.advance(15000, false);
      return Promise.resolve();
    });
    await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
      failure: { code: 'provider_connection' },
    });
    expect(s.underlying).not.toHaveBeenCalled();
    await s.transport.dispose();
    expect(s.clock.timers.size).toBe(0);
  });
  it('rejects already aborted SDK attempt without calling guard', async () => {
    const s = setup();
    s.attempt.abort();
    await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
      failure: { code: 'provider_connection' },
    });
    expect(s.guard).not.toHaveBeenCalled();
    expect(s.underlying).not.toHaveBeenCalled();
    await s.transport.dispose();
  });
  it('preserves denial markers instead of copying guard errors', async () => {
    const s = setup();
    s.guard.mockRejectedValue(new ClassifiedFailure(failure('operation_deadline', 'provider')));
    await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
      failure: { code: 'operation_deadline' },
    });
    expect(s.underlying).not.toHaveBeenCalled();
    await s.transport.dispose();
  });
  it.each([200, 500])(
    'counts decoded chunk overflow for %i despite false Content-Length',
    async (status) => {
      const cancel = vi.fn();
      const chunks = [new Uint8Array(256 * 1024), new Uint8Array(1)];
      const s = setup(() =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              pull(controller) {
                const chunk = chunks.shift();
                if (chunk) controller.enqueue(chunk);
              },
              cancel,
            }),
            { status, headers: { 'content-length': '1', 'content-encoding': 'gzip' } },
          ),
        ),
      );
      await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
        failure: { code: 'response_too_large' },
      });
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(s.transport.snapshot()).toMatchObject({
        metadata: { attempts: 1, httpStatus: status },
        usage: null,
      });
      await s.transport.dispose();
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('rejects one oversized chunk without retaining it', async () => {
    const cancel = vi.fn();
    const s = setup(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array(257 * 1024));
            },
            cancel,
          }),
        ),
      ),
    );
    await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
      failure: { code: 'response_too_large' },
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    await s.transport.dispose();
  });
  it('accepts exactly 256 KiB in decoded chunks even when Content-Length falsely claims overflow', async () => {
    const padded = new TextEncoder().encode(raw + ' '.repeat(256 * 1024 - raw.length));
    const s = setup(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(padded.subarray(0, 123));
              c.enqueue(padded.subarray(123));
              c.close();
            },
          }),
          { headers: { 'content-length': '999999999' } },
        ),
      ),
    );
    const result = await s.transport.fetch(url, s.init);
    expect((await result.arrayBuffer()).byteLength).toBe(256 * 1024);
    expect(s.transport.snapshot().usage).toEqual({ inputTokens: 1, outputTokens: 2 });
    await s.transport.dispose();
  });
  it.each(['outer', 'attempt'] as const)(
    'bounds never-EOF body on %s abort with known header metadata',
    async (signal) => {
      const cancel = vi.fn();
      const s = setup(() =>
        Promise.resolve(
          new Response(new ReadableStream({ cancel }), {
            headers: { 'x-typesafe-request-id': 'known' },
          }),
        ),
      );
      const pending = s.transport.fetch(url, s.init);
      await flush();
      (signal === 'outer' ? s.controller : s.attempt).abort();
      await expect(pending).rejects.toMatchObject({ failure: { code: 'provider_connection' } });
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(s.transport.snapshot()).toMatchObject({
        metadata: { attempts: 1, httpStatus: 200, requestId: 'known' },
        usage: null,
      });
      await s.transport.dispose();
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('body cancellation rejection is observed without replacing overflow', async () => {
    const s = setup(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array(257 * 1024));
            },
            cancel() {
              return Promise.reject(new Error('PRIVATE'));
            },
          }),
        ),
      ),
    );
    await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
      failure: { code: 'response_too_large' },
    });
    await s.transport.dispose();
    expect(s.transport.error()?.code).toBe('response_too_large');
    expect(s.clock.timers.size).toBe(0);
  });
  it('never-settling cancellation gets one injected 1000 ms cleanup grace', async () => {
    const cancelGate = deferred<void>();
    const s = setup(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array(257 * 1024));
            },
            cancel() {
              return cancelGate.promise;
            },
          }),
        ),
      ),
    );
    await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
      failure: { code: 'response_too_large' },
    });
    let settled = false;
    const pending = s.transport.dispose().then(() => {
      settled = true;
    });
    await flush();
    expect(settled).toBe(false);
    s.clock.advance(999);
    await flush();
    expect(settled).toBe(false);
    s.clock.advance(1);
    await pending;
    expect(s.clock.timers.size).toBe(0);
    cancelGate.reject(new Error('PRIVATE'));
    await flush();
  });
  it('read failure is sanitized, and malformed UTF-8/BOM/depth cannot yield usage', async () => {
    const inputs = [
      new Uint8Array([0xff]),
      new TextEncoder().encode('\ufeff{}'),
      new TextEncoder().encode('['.repeat(17) + '0' + ']'.repeat(17)),
    ];
    for (const bytes of inputs) {
      const s = setup(() => Promise.resolve(new Response(bytes)));
      await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
        failure: { code: 'provider_response_contract' },
      });
      expect(s.transport.snapshot().usage).toBeNull();
      await s.transport.dispose();
    }
    const s = setup(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            pull(c) {
              c.error(new Error('PRIVATE'));
            },
          }),
        ),
      ),
    );
    await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
      failure: { code: 'provider_connection' },
    });
    expect(JSON.stringify(s.transport.snapshot())).not.toContain('PRIVATE');
    await s.transport.dispose();
  });
  it('non-JSON error prose retains HTTP cause/status but no usage or prose', async () => {
    const s = setup(() => Promise.resolve(new Response('PRIVATE BODY', { status: 500 })));
    await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
      failure: { code: 'provider_http' },
    });
    expect(s.transport.snapshot()).toMatchObject({ usage: null, metadata: { httpStatus: 500 } });
    await s.transport.dispose();
  });
  it('does not fabricate HTTP status for an invalid transport response', async () => {
    const s = setup(() => Promise.resolve(Response.error()));
    await expect(s.transport.fetch(url, s.init)).rejects.toMatchObject({
      failure: { code: 'provider_response_contract' },
    });
    expect(s.transport.snapshot().metadata.httpStatus).toBeNull();
    await s.transport.dispose();
  });
  it('wait validates clock rollback and observes rejection after deadline', async () => {
    const clock = new FakeClock();
    const signal = new AbortController();
    const gate = deferred<void>();
    const pending = boundedWait(
      () => gate.promise,
      clock,
      () => 100,
      [signal.signal],
    );
    clock.advance(100);
    expect(await pending).toMatchObject({ ok: false, error: { code: 'provider_connection' } });
    gate.reject(new Error('PRIVATE'));
    await flush();
    expect(clock.timers.size).toBe(0);
    clock.monotonic = 2;
    const result = await boundedWait(
      () => {
        clock.monotonic = 1;
        return Promise.resolve();
      },
      clock,
      () => 100,
      [signal.signal],
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'internal_failure' } });
    expect(clock.timers.size).toBe(0);
  });
});
