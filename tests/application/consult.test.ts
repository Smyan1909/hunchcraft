import { describe, expect, it, vi } from 'vitest';
import { consult } from '../../src/application/consult.js';
import { compileChecks } from '../../src/core/checks.js';
import { ClassifiedFailure, completedJudgmentEnvelope, failure } from '../../src/core/result.js';
import type { EvaluationOutcome } from '../../src/core/result.js';
import type { DecisionProvider, EvaluationControl } from '../../src/ports/decision-provider.js';
import { deferred, evaluation, fixture, flush, setup } from '../helpers/consultation-fakes.js';

describe('stateless consultation', () => {
  it.each(['cancel', 'deadline'] as const)(
    'refuses intake/dispatch if operation is already %s',
    async (reason) => {
      const s = setup();
      if (reason === 'cancel') s.controller.abort();
      else s.clock.advance(15000, false);
      expect(await consult(s.input, s.dependencies)).toMatchObject({
        status: 'error',
        failure: { code: reason === 'cancel' ? 'operation_cancelled' : 'operation_deadline' },
        outcome: { provider: { attempts: 0, requestId: null, usage: null } },
      });
      expect(s.provider.calls).toBe(0);
      s.input.operation.dispose();
    },
  );
  it.each(['minimal6', 'csv13'] as const)(
    'returns all raw %s judgments without sessions or preparation',
    async (name) => {
      const s = setup(name);
      const result = await consult(s.input, s.dependencies);
      expect(result.status).toBe('ready');
      if (result.status !== 'ready') throw new Error();
      expect(Object.keys(result)).toEqual(['status', 'result']);
      expect(result.result.checks).toHaveLength(name === 'minimal6' ? 6 : 13);
      expect(result.result.checks[0]?.id).toBe('g.request-gap');
      expect(result.result.checks[1]?.id).toBe('g.domain-gap');
      expect(result.result.checks.find((c) => c.answer.type === 'score')?.answer).toMatchObject({
        score: 1.5,
        probabilities: { '0': 0.1, '1': 0.3, '2': 0.6 },
        confidence: 0.4,
      });
      expect(s.provider.calls).toBe(1);
      expect(s.provider.dispatches).toBe(1);
      expect(completedJudgmentEnvelope(result.result).ok).toBe(false);
      expect(s.input.operation.checkpoint('output').ok).toBe(true);
      expect(s.input.operation.signal.aborted).toBe(false);
      expect(s.clock.timers.size).toBe(1);
      s.input.operation.dispose();
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('independent concurrent invocations have no shared cap or state', async () => {
    const a = setup();
    const b = setup();
    const gate = deferred<void>();
    a.provider.handler = async (plan, control) => {
      await control.beforeDispatch();
      await gate.promise;
      return evaluation(plan);
    };
    const pending = consult(a.input, a.dependencies);
    expect((await consult(b.input, b.dependencies)).status).toBe('ready');
    gate.resolve();
    expect((await pending).status).toBe('ready');
    a.input.operation.dispose();
    b.input.operation.dispose();
  });
  it.each(['success', 'rejection'] as const)(
    'concurrent consultations sharing an Operation dispatch once and observe late %s',
    async (settlement) => {
      const s = setup();
      const gate = deferred<void>();
      s.provider.handler = async (plan, control) => {
        await control.beforeDispatch();
        s.provider.dispatches++;
        await gate.promise;
        return evaluation(plan);
      };
      try {
        const first = consult(s.input, s.dependencies);
        await flush();
        expect(s.provider.dispatches).toBe(1);
        const second = consult(s.input, s.dependencies);
        // The duplicate claim interrupts the first wait without requiring the
        // ignored-abort provider to settle or the clock to reach its deadline.
        const outcomes = await Promise.all([first, second]);
        expect(s.provider.calls).toBe(2);
        expect(s.provider.dispatches).toBe(1);
        expect(s.clock.monotonic).toBe(0);
        for (const outcome of outcomes)
          expect(outcome).toMatchObject({
            status: 'error',
            failure: { code: 'internal_failure' },
          });
        expect(s.provider.controls.every((control) => control.signal.aborted)).toBe(true);
        const retained = JSON.stringify(outcomes);
        if (settlement === 'success') gate.resolve();
        else gate.reject(new Error('PRIVATE-LATE-REJECTION'));
        // Vitest's unhandled-rejection checking remains enabled; the losing
        // provider promise must stay observed even after both calls return.
        await flush();
        expect(s.provider.dispatches).toBe(1);
        expect(JSON.stringify(outcomes)).toBe(retained);
      } finally {
        s.input.operation.dispose();
      }
      expect(s.clock.timers.size).toBe(0);
    },
  );
  it('completed results own reconstructed final answers and metadata despite later port mutation', async () => {
    const s = setup();
    const compilation = compileChecks(fixture().brief);
    if (!compilation.ok) throw new Error('Expected valid compilation');
    const base = evaluation(compilation.value);
    if (!base.ok) throw new Error('Expected valid fixture');
    const baseScore = base.value.answers.q005;
    if (baseScore?.type !== 'score') throw new Error('Expected Score fixture');
    const noul = { type: 'noul' as const, noul: 0.2 };
    const submittedScore = {
      ...baseScore,
      legend: { ...baseScore.legend },
      probabilities: { ...baseScore.probabilities },
    };
    const final = {
      ok: true as const,
      value: {
        answers: { ...base.value.answers, q001: noul, q005: submittedScore },
        metadata: {
          origin: 'provider-http' as const,
          attempts: 1 as const,
          requestId: 'HTTP_FINAL',
          httpStatus: 200,
        },
        usage: { inputTokens: 120, outputTokens: 24 },
      },
    };
    const p: DecisionProvider = {
      origin: 'provider-http',
      evaluate: async (_plan, _state, control) => {
        await control.beforeDispatch();
        return final;
      },
    };
    try {
      const outcome = await consult(s.input, { provider: p });
      if (outcome.status !== 'ready') throw new Error('Expected completed result');
      const retained = JSON.stringify(outcome);
      expect(outcome.result.provider.metadata).not.toBe(final.value.metadata);
      expect(outcome.result.provider.usage).not.toBe(final.value.usage);
      const score = outcome.result.checks.find((check) => check.wireId === 'q005')?.answer;
      if (score?.type !== 'score') throw new Error('Expected retained Score');
      expect(score).not.toBe(final.value.answers.q005);
      expect(score.legend).not.toBe(final.value.answers.q005.legend);
      expect(score.probabilities).not.toBe(final.value.answers.q005.probabilities);
      final.value.answers.q001.noul = 0.95;
      final.value.answers.q005.score = 0;
      final.value.answers.q005.legend['0'] = 'PRIVATE-MUTATED-LEGEND';
      final.value.answers.q005.probabilities['0'] = 0.9;
      final.value.metadata.requestId = 'MUTATED_ID';
      final.value.usage.inputTokens = 999;
      expect(JSON.stringify(outcome)).toBe(retained);
      expect(outcome.result.checks[0]?.answer).toEqual({ type: 'noul', noul: 0.2 });
      expect(score.probabilities).toEqual({ '0': 0.1, '1': 0.3, '2': 0.6 });
      expect(completedJudgmentEnvelope(outcome.result).ok).toBe(true);
    } finally {
      s.input.operation.dispose();
    }
  });
  it.each(['null', '{}', '{"schemaVersion":"hunchcraft.brief.v0","brief":{}}', 'bad'])(
    'invalid document %s never evaluates',
    async (bytes) => {
      const s = setup();
      const o = await consult({ ...s.input, bytes }, s.dependencies);
      expect(o).toMatchObject({
        status: 'error',
        failure: { code: 'invalid_input', exitCode: 2 },
        outcome: {
          schemaVersion: 'hunchcraft.result.v1',
          status: 'failed',
          provider: { attempts: 0, requestId: null, usage: null, costEstimate: null },
        },
      });
      expect(s.provider.calls).toBe(0);
      expect(s.input.operation.checkpoint('output').ok).toBe(true);
      s.input.operation.dispose();
    },
  );
  it('rejects mandatory check overflow without dispatch', async () => {
    const s = setup();
    const base = fixture('csv13').brief;
    const component = base.brief.components[0];
    if (!component) throw new Error();
    const bytes = JSON.stringify({
      ...base,
      brief: {
        ...base.brief,
        components: [...base.brief.components, { ...component, id: 'support' }],
      },
    });
    expect(await consult({ ...s.input, bytes }, s.dependencies)).toMatchObject({
      status: 'error',
      failure: { code: 'check_budget_exceeded', exitCode: 2 },
    });
    expect(s.provider.calls).toBe(0);
    s.input.operation.dispose();
  });
  it('the caller deadline is not reset by consultation and remains enforced at output', async () => {
    const s = setup();
    s.clock.advance(14000);
    const o = await consult(s.input, s.dependencies);
    expect(o.status).toBe('ready');
    expect(s.input.operation.remainingMs()).toBe(1000);
    s.clock.advance(1000, false);
    expect(s.input.operation.checkpoint('output')).toEqual({
      ok: false,
      error: failure('operation_deadline', 'output'),
    });
    s.input.operation.dispose();
  });
  it('caller cancellation after advice but before output still invalidates consumption', async () => {
    const s = setup();
    expect((await consult(s.input, s.dependencies)).status).toBe('ready');
    s.controller.abort();
    expect(s.input.operation.checkpoint('output')).toMatchObject({
      ok: false,
      error: { code: 'operation_cancelled' },
    });
    s.input.operation.dispose();
  });
  it.each(['cancel', 'deadline', 'elapsed', 'dispose'] as const)(
    'bounds ignored-abort work on %s and observes late rejection',
    async (reason) => {
      const s = setup();
      const gate = deferred<EvaluationOutcome>();
      s.provider.handler = async (_plan, control) => {
        await control.beforeDispatch();
        return gate.promise;
      };
      const pending = consult(s.input, s.dependencies);
      await flush();
      if (reason === 'cancel') s.controller.abort();
      else if (reason === 'dispose') s.input.operation.dispose();
      else s.clock.advance(15000, reason === 'deadline');
      if (reason === 'elapsed') gate.reject(new Error('PRIVATE'));
      const o = await pending;
      expect(o).toMatchObject({
        status: 'error',
        failure: {
          code:
            reason === 'cancel'
              ? 'operation_cancelled'
              : reason === 'dispose'
                ? 'internal_failure'
                : 'operation_deadline',
        },
      });
      gate.reject(new Error('PRIVATE'));
      await flush();
      expect(JSON.stringify(o)).not.toContain('PRIVATE');
      s.input.operation.dispose();
    },
  );
  it.each(['cancel', 'elapsed'] as const)(
    'suppresses late success with %s precedence',
    async (reason) => {
      const s = setup();
      const gate = deferred<void>();
      s.provider.handler = async (plan, control) => {
        await control.beforeDispatch();
        await gate.promise;
        return evaluation(plan);
      };
      const pending = consult(s.input, s.dependencies);
      await flush();
      if (reason === 'cancel') s.controller.abort();
      else s.clock.advance(15000, false);
      gate.resolve();
      expect(await pending).toMatchObject({
        status: 'error',
        failure: { code: reason === 'cancel' ? 'operation_cancelled' : 'operation_deadline' },
      });
      s.input.operation.dispose();
    },
  );
  it('refuses repeated guards and another consultation cannot reset the invocation claim', async () => {
    const s = setup();
    s.provider.handler = async (plan, control) => {
      await control.beforeDispatch();
      await control.beforeDispatch();
      return evaluation(plan);
    };
    expect(await consult(s.input, s.dependencies)).toMatchObject({
      status: 'error',
      failure: { code: 'internal_failure' },
    });
    s.input.operation.dispose();
    const t = setup();
    expect((await consult(t.input, t.dependencies)).status).toBe('ready');
    expect(await consult(t.input, t.dependencies)).toMatchObject({
      status: 'error',
      failure: { code: 'internal_failure' },
    });
    expect(t.provider.dispatches).toBe(1);
    t.input.operation.dispose();
  });
  it('cannot report success without the dispatch guard', async () => {
    const s = setup();
    s.provider.handler = (plan) => Promise.resolve(evaluation(plan));
    expect(await consult(s.input, s.dependencies)).toMatchObject({
      status: 'error',
      failure: { code: 'internal_failure' },
    });
    s.input.operation.dispose();
  });
  it.each(['unknown', 'forged', 'classified'] as const)(
    'sanitizes %s exceptions without reading exception properties',
    async (kind) => {
      const s = setup();
      let reads = 0;
      const forged: object = Object.create(ClassifiedFailure.prototype) as object;
      Object.defineProperty(forged, 'failure', {
        get: () => {
          reads++;
          throw new Error('PRIVATE');
        },
      });
      const error =
        kind === 'classified'
          ? new ClassifiedFailure(failure('provider_connection', 'provider'))
          : kind === 'forged'
            ? forged
            : new Error('PRIVATE');
      if (!(error instanceof Error)) throw new Error('Expected error-prototype fixture');
      s.provider.handler = () => Promise.reject(error);
      const o = await consult(s.input, s.dependencies);
      expect(o).toMatchObject({
        status: 'error',
        failure: { code: kind === 'classified' ? 'provider_connection' : 'internal_failure' },
      });
      expect(reads).toBe(0);
      expect(JSON.stringify(o)).not.toContain('PRIVATE');
      expect(s.input.operation.checkpoint('output').ok).toBe(true);
      s.input.operation.dispose();
    },
  );
  it('revalidates port answers instead of trusting the TypeScript union', async () => {
    const s = setup();
    s.provider.handler = async (plan, control) => {
      await control.beforeDispatch();
      const e = evaluation(plan);
      if (!e.ok) throw new Error();
      return { ok: true, value: { ...e.value, answers: {} } };
    };
    expect(await consult(s.input, s.dependencies)).toMatchObject({
      status: 'error',
      failure: { code: 'internal_failure' },
    });
    s.input.operation.dispose();
  });
});

describe('monotonic dispatched progress', () => {
  const dispatched = {
    metadata: { origin: 'provider-http', attempts: 1, requestId: 'HTTP_1', httpStatus: 502 },
    usage: { inputTokens: 11, outputTokens: 2 },
  } as const;
  function provider(
    handler: (control: EvaluationControl) => Promise<EvaluationOutcome>,
  ): DecisionProvider {
    return { origin: 'provider-http', evaluate: (_plan, _state, control) => handler(control) };
  }
  it('keeps independently validated metadata on rejection', async () => {
    const s = setup();
    const p = provider(async (control) => {
      await control.beforeDispatch();
      control.onProgress(dispatched);
      throw new Error('PRIVATE');
    });
    const o = await consult(s.input, { provider: p });
    expect(o).toMatchObject({
      status: 'error',
      outcome: {
        provider: { attempts: 1, requestId: 'HTTP_1', usage: { inputTokens: 11, outputTokens: 2 } },
      },
    });
    s.input.operation.dispose();
  });
  it('owns submitted progress and reconstructed failure fields despite mutations during and after evaluation', async () => {
    const s = setup();
    const submitted = {
      metadata: { ...dispatched.metadata, httpStatus: 502 },
      usage: { inputTokens: 11, outputTokens: 2 },
    };
    const final = {
      ok: false as const,
      error: { ...failure('provider_http', 'provider') },
      metadata: { ...dispatched.metadata, httpStatus: 502 },
      usage: { inputTokens: 11, outputTokens: 2 },
    };
    const gate = deferred<void>();
    const p = provider(async (control) => {
      await control.beforeDispatch();
      control.onProgress(submitted);
      submitted.metadata.httpStatus = 200;
      submitted.usage.inputTokens = 999;
      await gate.promise;
      return final;
    });
    try {
      const pending = consult(s.input, { provider: p });
      await flush();
      expect(submitted.usage.inputTokens).toBe(999);
      gate.resolve();
      const outcome = await pending;
      if (outcome.status !== 'error') throw new Error('Expected provider failure');
      expect(outcome.failure).toEqual(failure('provider_http', 'provider'));
      expect(outcome.outcome.provider).toEqual({
        attempts: 1,
        requestId: 'HTTP_1',
        usage: { inputTokens: 11, outputTokens: 2 },
        costEstimate: null,
      });
      expect(outcome.failure).not.toBe(final.error);
      expect(outcome.outcome.provider.usage).not.toBe(final.usage);
      expect(outcome.outcome.provider.usage).not.toBe(submitted.usage);
      const retained = JSON.stringify(outcome);
      final.error.message = 'PRIVATE-MUTATED-FAILURE';
      final.metadata.httpStatus = 201;
      final.usage.inputTokens = 888;
      submitted.usage.outputTokens = 777;
      expect(JSON.stringify(outcome)).toBe(retained);
    } finally {
      s.input.operation.dispose();
    }
  });
  it.each([
    { metadata: { ...dispatched.metadata, attempts: 0 }, usage: null },
    { metadata: { ...dispatched.metadata, requestId: 'different' }, usage: dispatched.usage },
    { metadata: { ...dispatched.metadata, httpStatus: 200 }, usage: dispatched.usage },
    { metadata: dispatched.metadata, usage: null },
    { metadata: dispatched.metadata, usage: { inputTokens: 12, outputTokens: 2 } },
    { metadata: dispatched.metadata, usage: dispatched.usage, extra: true },
  ])('rejects regression/invalid progress %j while retaining prior valid data', async (next) => {
    const s = setup();
    const p = provider(async (control) => {
      await control.beforeDispatch();
      control.onProgress(dispatched);
      control.onProgress(next);
      return { ok: false, error: failure('provider_http', 'provider'), ...dispatched };
    });
    expect(await consult(s.input, { provider: p })).toMatchObject({
      status: 'error',
      failure: { code: 'internal_failure' },
      outcome: { provider: { attempts: 1, requestId: 'HTTP_1', usage: dispatched.usage } },
    });
    s.input.operation.dispose();
  });
  it('rejects dispatched progress before guard and refuses late progress/guard after return', async () => {
    const s = setup();
    let saved: EvaluationControl | undefined;
    const p = provider((control) => {
      saved = control;
      control.onProgress(dispatched);
      return Promise.resolve({
        ok: false,
        error: failure('missing_key', 'configuration'),
        metadata: { origin: 'provider-http', attempts: 0, requestId: null, httpStatus: null },
        usage: null,
      });
    });
    const o = await consult(s.input, { provider: p });
    expect(o).toMatchObject({
      status: 'error',
      failure: { code: 'internal_failure' },
      outcome: { provider: { attempts: 0, usage: null } },
    });
    if (!saved) throw new Error();
    saved.onProgress(dispatched);
    await expect(saved.beforeDispatch()).rejects.toThrow();
    expect(o).toMatchObject({ outcome: { provider: { attempts: 0, usage: null } } });
    s.input.operation.dispose();
  });
  it('final outcome cannot erase established observations', async () => {
    const s = setup();
    const p = provider(async (control) => {
      await control.beforeDispatch();
      control.onProgress(dispatched);
      return {
        ok: false,
        error: failure('provider_http', 'provider'),
        metadata: { ...dispatched.metadata, requestId: null },
        usage: null,
      };
    });
    expect(await consult(s.input, { provider: p })).toMatchObject({
      status: 'error',
      failure: { code: 'internal_failure' },
      outcome: { provider: { requestId: 'HTTP_1', usage: dispatched.usage } },
    });
    s.input.operation.dispose();
  });
  it('pre-dispatch missing configuration remains a bounded zero-attempt failure', async () => {
    const s = setup();
    const evaluate = vi.fn(() =>
      Promise.resolve({
        ok: false as const,
        error: failure('missing_key', 'configuration'),
        metadata: {
          origin: 'provider-http' as const,
          attempts: 0 as const,
          requestId: null,
          httpStatus: null,
        },
        usage: null,
      }),
    );
    expect(
      await consult(s.input, { provider: { origin: 'provider-http', evaluate } }),
    ).toMatchObject({
      status: 'error',
      failure: { exitCode: 3 },
      outcome: { provider: { attempts: 0, requestId: null, usage: null } },
    });
    expect(s.input.operation.checkpoint('output').ok).toBe(true);
    s.input.operation.dispose();
  });
});
