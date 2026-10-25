import { describe, expect, it, vi } from 'vitest';
import { createOperation } from '../../src/application/operation.js';
import { ClassifiedFailure, failure } from '../../src/core/result.js';
import { deferred, FakeClock, flush } from '../helpers/consultation-fakes.js';

function setup() {
  const clock = new FakeClock();
  const caller = new AbortController();
  const operation = createOperation(
    clock,
    { monotonicMs: 0, wallTimeMs: clock.wall },
    caller.signal,
  );
  return { clock, caller, operation };
}
describe('borrowed operation lifecycle', () => {
  it.each(['cancel', 'deadline'] as const)(
    'cleanup faults cannot replace a selected %s',
    async (reason) => {
      const clock = new FakeClock();
      const caller = new AbortController();
      const schedule = clock.schedule.bind(clock);
      vi.spyOn(clock, 'schedule').mockImplementation((delay, callback) => {
        const cancel = schedule(delay, callback);
        return () => {
          cancel();
          throw new Error('PRIVATE');
        };
      });
      const operation = createOperation(
        clock,
        { monotonicMs: 0, wallTimeMs: clock.wall },
        caller.signal,
      );
      const gate = deferred<void>();
      const pending = operation.wait('provider', () => gate.promise);
      if (reason === 'cancel') caller.abort();
      else clock.advance(15000);
      expect(() => operation.dispose()).not.toThrow();
      expect(await pending).toMatchObject({
        ok: false,
        error: { code: reason === 'cancel' ? 'operation_cancelled' : 'operation_deadline' },
      });
      expect(operation.checkpoint('output')).toMatchObject({
        ok: false,
        error: { code: reason === 'cancel' ? 'operation_cancelled' : 'operation_deadline' },
      });
      gate.reject(new Error('late'));
      await flush();
      expect(clock.timers.size).toBe(0);
    },
  );
  it('captures start readings so caller mutation cannot extend the deadline', () => {
    const clock = new FakeClock();
    const caller = new AbortController();
    const startedAt = { monotonicMs: 0, wallTimeMs: clock.wall };
    const operation = createOperation(clock, startedAt, caller.signal);
    startedAt.monotonicMs = 14000;
    startedAt.wallTimeMs += 14000;
    clock.advance(14000, false);
    expect(operation.remainingMs()).toBe(1000);
    clock.advance(1000);
    expect(operation.checkpoint('output')).toMatchObject({
      ok: false,
      error: { code: 'operation_deadline' },
    });
    operation.dispose();
  });
  it('keeps the deadline active for sanitized output after dependency rejection', async () => {
    const s = setup();
    expect(
      await s.operation.wait('provider', () => Promise.reject(new Error('PRIVATE'))),
    ).toMatchObject({ ok: false, error: { code: 'internal_failure' } });
    expect(s.operation.signal.aborted).toBe(false);
    expect(await s.operation.wait('output', () => Promise.resolve('sanitized'))).toEqual({
      ok: true,
      value: 'sanitized',
    });
    s.clock.advance(15000);
    expect(s.operation.checkpoint('output').ok).toBe(false);
    s.operation.dispose();
  });
  it('bounds a wait with one original deadline and observes rejection losers', async () => {
    const s = setup();
    const gate = deferred<void>();
    const pending = s.operation.wait('input', () => gate.promise);
    s.clock.advance(15000);
    expect(await pending).toMatchObject({ ok: false, error: { code: 'operation_deadline' } });
    gate.reject(new Error('PRIVATE'));
    await flush();
    s.operation.dispose();
    expect(s.clock.timers.size).toBe(0);
  });
  it('dispose resolves pending waits even if timer cancellation and listener removal throw', async () => {
    const clock = new FakeClock();
    const caller = new AbortController();
    const cancel = vi.spyOn(clock, 'schedule').mockImplementation(() => () => {
      throw new Error('PRIVATE');
    });
    const operation = createOperation(
      clock,
      { monotonicMs: 0, wallTimeMs: clock.wall },
      caller.signal,
    );
    const remove = vi.spyOn(caller.signal, 'removeEventListener').mockImplementation(() => {
      throw new Error('PRIVATE');
    });
    const gate = deferred<void>();
    const pending = operation.wait('output', () => gate.promise);
    expect(() => operation.dispose()).not.toThrow();
    expect(await pending).toEqual({ ok: false, error: failure('internal_failure', 'internal') });
    expect(remove).toHaveBeenCalledTimes(1);
    operation.dispose();
    expect(remove).toHaveBeenCalledTimes(1);
    gate.reject(new Error('PRIVATE'));
    await flush();
    remove.mockRestore();
    cancel.mockRestore();
  });
  it('settles when a wait observer removal throws and never leaks the fault', async () => {
    const s = setup();
    const remove = vi.spyOn(s.operation.signal, 'removeEventListener').mockImplementation(() => {
      throw new Error('PRIVATE');
    });
    expect(await s.operation.wait('output', () => Promise.resolve('value'))).toEqual({
      ok: false,
      error: failure('internal_failure', 'internal'),
    });
    remove.mockRestore();
    s.operation.dispose();
  });
  it.each(['rollback', 'wall', 'nonfinite'] as const)(
    'fails closed on in-process clock fault %s',
    (kind) => {
      const s = setup();
      s.clock.advance(1000);
      expect(s.operation.checkpoint('input').ok).toBe(true);
      if (kind === 'rollback') s.clock.monotonic -= 1;
      else if (kind === 'wall') s.clock.wall -= 1001;
      else s.clock.monotonic = NaN;
      expect(s.operation.checkpoint('output')).toEqual({
        ok: false,
        error: failure('clock_inconsistent', 'internal'),
      });
      s.operation.dispose();
    },
  );
  it('allows a small observed wall rollback without resetting elapsed time', () => {
    const s = setup();
    s.clock.advance(1000);
    expect(s.operation.checkpoint('input').ok).toBe(true);
    s.clock.wall -= 1000;
    expect(s.operation.remainingMs()).toBe(14000);
    s.operation.dispose();
  });
  it('handles schedule and listener-install faults without starting dependent work', async () => {
    const clock = new FakeClock();
    const caller = new AbortController();
    vi.spyOn(clock, 'schedule').mockImplementation(() => {
      throw new Error('PRIVATE');
    });
    const operation = createOperation(
      clock,
      { monotonicMs: 0, wallTimeMs: clock.wall },
      caller.signal,
    );
    const start = vi.fn(() => Promise.resolve());
    expect(await operation.wait('input', start)).toMatchObject({
      ok: false,
      error: { code: 'internal_failure' },
    });
    expect(start).not.toHaveBeenCalled();
    operation.dispose();
    const s = setup();
    const add = vi.spyOn(s.operation.signal, 'addEventListener').mockImplementation(() => {
      throw new Error('PRIVATE');
    });
    expect(await s.operation.wait('input', start)).toMatchObject({
      ok: false,
      error: { code: 'internal_failure' },
    });
    expect(start).not.toHaveBeenCalled();
    add.mockRestore();
    s.operation.dispose();
  });
  it('uses local cancellation/deadline precedence over late classified rejection', async () => {
    const s = setup();
    const gate = deferred<void>();
    const pending = s.operation.wait('provider', () => gate.promise);
    s.clock.advance(15000, false);
    s.caller.abort();
    gate.reject(new ClassifiedFailure(failure('provider_connection', 'provider')));
    expect(await pending).toMatchObject({ ok: false, error: { code: 'operation_cancelled' } });
    s.operation.dispose();
  });
});
