import { describe, expect, it } from 'vitest';
import { compileChecks } from '../../src/core/checks.js';
import {
  completedJudgmentEnvelope,
  ClassifiedFailure,
  classifiedFailure,
  failure,
  parseCompletedJudgment,
  prepareBytes,
  reconstructEvaluationOutcome,
  reconstructFailure,
  reconstructInternalJudgment,
  validateProviderResponse,
} from '../../src/core/result.js';
import { consult } from '../../src/application/consult.js';
import { evaluation, fixture, response, setup } from '../helpers/consultation-fakes.js';

function plan() {
  const c = compileChecks(fixture().brief);
  if (!c.ok) throw new Error();
  return c.value;
}
const metadata = {
  origin: 'test-fixture',
  attempts: 0,
  requestId: null,
  httpStatus: null,
} as const;
describe('closed answers', () => {
  it('rebuilds shuffled wire fields in compiled order with synthetic provenance', () => {
    const p = plan();
    const raw = response(p);
    const result = validateProviderResponse(raw, p, metadata);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.answers)).toEqual(p.checks.map((c) => c.wireId));
    expect(Object.isFrozen(result.value.answers.q005)).toBe(true);
    expect(result.value.usage).toEqual({ inputTokens: 120, outputTokens: 24 });
  });
  it.each([
    [
      'unknown root',
      (v: Record<string, unknown>) => {
        v.extra = 1;
      },
    ],
    [
      'wrong model',
      (v: Record<string, unknown>) => {
        v.model = 'jev-latest';
      },
    ],
    [
      'missing usage',
      (v: Record<string, unknown>) => {
        delete v.usage;
      },
    ],
    [
      'fractional usage',
      (v: Record<string, unknown>) => {
        v.usage = { input_tokens: 1.1, output_tokens: 2 };
      },
    ],
    [
      'negative zero usage',
      (v: Record<string, unknown>) => {
        v.usage = { input_tokens: -0, output_tokens: 2 };
      },
    ],
    [
      'unknown answer',
      (v: Record<string, unknown>) => {
        v.answers = {};
      },
    ],
  ])('rejects %s without partial data', (_label, mutate) => {
    const p = plan();
    const raw: Record<string, unknown> = structuredClone(response(p)) as Record<string, unknown>;
    mutate(raw);
    expect(validateProviderResponse(raw, p, metadata)).toEqual({
      ok: false,
      error: failure('provider_response_contract', 'response'),
    });
  });
  it.each([-0, -0.1, 1.1, NaN, Infinity])('rejects invalid Noul %s', (noul) => {
    const p = plan();
    const base = evaluation(p);
    if (!base.ok) throw new Error();
    expect(reconstructEvaluationOutcome(base, p, 'test-fixture').ok).toBe(true);
    const v = {
      model: 'jev-1.13.0',
      answers: {
        ...base.value.answers,
        q001: { type: 'noul', noul },
      },
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    expect(validateProviderResponse(v, p, metadata).ok).toBe(false);
  });
  it('does not run getters, toJSON or accept cyclic/accessor values', () => {
    let runs = 0;
    const raw = {
      model: 'jev-1.13.0',
      get answers() {
        runs++;
        throw new Error('secret');
      },
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    expect(validateProviderResponse(raw, plan(), metadata).ok).toBe(false);
    expect(runs).toBe(0);
    expect(
      validateProviderResponse(
        {
          toJSON: () => {
            runs++;
          },
        },
        plan(),
        metadata,
      ).ok,
    ).toBe(false);
    expect(runs).toBe(0);
    const cyclic: Record<string, unknown> = {};
    cyclic.answers = cyclic;
    expect(validateProviderResponse(cyclic, plan(), metadata).ok).toBe(false);
  });
  it.each([
    { origin: 'test-fixture', attempts: 1, requestId: null, httpStatus: null },
    { origin: 'test-fixture', attempts: 0, requestId: 'id', httpStatus: null },
    { origin: 'provider-http', attempts: 0, requestId: null, httpStatus: null },
    { origin: 'provider-http', attempts: 1, requestId: null, httpStatus: 301 },
    { origin: 'provider-http', attempts: -0, requestId: null, httpStatus: null },
  ])('rejects metadata forgery %j', (m) => {
    const p = plan();
    const base = evaluation(p);
    if (!base.ok) throw new Error();
    const origin = m.origin === 'provider-http' ? 'provider-http' : 'test-fixture';
    const validMetadata =
      origin === 'provider-http'
        ? { origin, attempts: 1, requestId: null, httpStatus: 200 }
        : metadata;
    expect(
      reconstructEvaluationOutcome(
        { ok: true, value: { ...base.value, metadata: validMetadata } },
        p,
        origin,
      ).ok,
    ).toBe(true);
    expect(
      reconstructEvaluationOutcome(
        {
          ok: true,
          value: { ...base.value, metadata: m },
        },
        p,
        origin,
      ).ok,
    ).toBe(false);
  });
  it('failure association is closed and accessor-safe', () => {
    const f = failure('operation_deadline', 'provider');
    expect(reconstructFailure(f)).toEqual({ ok: true, value: f });
    expect(reconstructFailure({ ...f, message: 'private source' }).ok).toBe(false);
    expect(reconstructFailure({ ...f, exitCode: 0 }).ok).toBe(false);
    expect(reconstructFailure({ ...f, code: 'approved' }).ok).toBe(false);
  });
  it('classified exceptions own immutable validated payloads and reject prototype forgery', () => {
    const original = failure('provider_connection', 'provider');
    const exception = new ClassifiedFailure(original);
    expect(classifiedFailure(exception)).toEqual(original);
    expect(Object.isFrozen(exception)).toBe(true);
    expect(Object.isFrozen(exception.failure)).toBe(true);
    expect(() =>
      Object.defineProperty(exception, 'failure', { value: { ...original, message: 'private' } }),
    ).toThrow();
    expect(Reflect.set(exception, 'failure', { ...original, message: 'private' })).toBe(false);
    expect(classifiedFailure(exception)).toEqual(original);
    let calls = 0;
    const forged: object = Object.create(ClassifiedFailure.prototype) as object;
    Object.defineProperty(forged, 'failure', {
      get: () => {
        calls++;
        return { ...original, message: 'private' };
      },
    });
    expect(forged instanceof ClassifiedFailure).toBe(true);
    expect(classifiedFailure(forged)).toBeNull();
    expect(calls).toBe(0);
    const invalidException = new ClassifiedFailure({ ...original, message: 'private' });
    expect(classifiedFailure(invalidException)).toEqual(failure('internal_failure', 'internal'));
  });
  it.each([
    ['sum', { probabilities: { '0': 0.1, '1': 0.3, '2': 0.5 } }],
    ['weighted score', { score: 1.6 }],
    ['legend', { legend: { '0': 'wrong', '1': 'wrong', '2': 'wrong' } }],
    ['extra level', { probabilities: { '0': 0.1, '1': 0.3, '2': 0.6, '3': 0 } }],
    ['confidence', { confidence: 1.01 }],
    ['negative zero', { score: -0 }],
    ['nonfinite', { score: Infinity }],
    ['unknown field', { approval: true }],
  ])('rejects Score %s on an otherwise valid response', (_label, patch) => {
    const p = plan();
    const base = validateProviderResponse(response(p), p, metadata);
    if (!base.ok) throw new Error();
    const raw = {
      model: 'jev-1.13.0',
      answers: { ...base.value.answers, q005: { ...base.value.answers.q005, ...patch } },
      usage: { input_tokens: 120, output_tokens: 24 },
    };
    expect(validateProviderResponse(raw, p, metadata).ok).toBe(false);
  });
  it('accepts sum/weighted tolerances without normalizing and shuffled answer keys', () => {
    const p = plan();
    const base = validateProviderResponse(response(p), p, metadata);
    if (!base.ok) throw new Error();
    const raw = {
      model: 'jev-1.13.0',
      answers: {
        ...Object.fromEntries(Object.entries(base.value.answers).reverse()),
        q005: {
          ...base.value.answers.q005,
          score: 1.500009,
          probabilities: { '2': 0.6000001, '0': 0.1, '1': 0.3 },
        },
      },
      usage: { input_tokens: 120, output_tokens: 24 },
    };
    const r = validateProviderResponse(raw, p, metadata);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.answers.q005).toMatchObject({
      score: 1.500009,
      probabilities: { '0': 0.1, '1': 0.3, '2': 0.6000001 },
    });
    expect(Object.keys(r.value.answers)).toEqual(p.checks.map((c) => c.wireId));
  });
});
describe('judgment and bytes', () => {
  it('preserves private owned bytes and enforces newline-inclusive cap', () => {
    const bytes = new Uint8Array([65, 10]);
    const prepared = prepareBytes(bytes);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    bytes[0] = 66;
    const copy = prepared.value.copyBytes();
    copy[0] = 67;
    expect([...prepared.value.copyBytes()]).toEqual([65, 10]);
    expect(Object.isFrozen(prepared.value)).toBe(true);
    const maximum = new Uint8Array(256 * 1024);
    maximum[maximum.length - 1] = 10;
    expect(prepareBytes(maximum).ok).toBe(true);
    expect(prepareBytes(new Uint8Array(256 * 1024 + 1)).ok).toBe(false);
    expect(prepareBytes(new Uint8Array()).ok).toBe(false);
    expect(prepareBytes(new Uint8Array([65])).ok).toBe(false);
  });
  it('reconstructs internal result, rejects forged nested fields and fixture production projection', async () => {
    const s = setup();
    const outcome = await consult(s.input, s.dependencies);
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(reconstructInternalJudgment(outcome.result)).toEqual({
      ok: true,
      value: outcome.result,
    });
    expect(completedJudgmentEnvelope(outcome.result).ok).toBe(false);
    expect(reconstructInternalJudgment({ ...outcome.result, approved: true }).ok).toBe(false);
    expect(
      reconstructInternalJudgment({
        ...outcome.result,
        freshness: { ...outcome.result.freshness, completedAt: '2026-10-11T12:00:00Z' },
      }).ok,
    ).toBe(false);
    expect(
      reconstructInternalJudgment({
        ...outcome.result,
        checks: outcome.result.checks.map((c) => ({
          ...c,
          feedback: { ...c.feedback, label: 'Approved' },
        })),
      }).ok,
    ).toBe(false);
    expect(
      reconstructInternalJudgment({
        ...outcome.result,
        timing: { ...outcome.result.timing, inputMs: -0 },
      }).ok,
    ).toBe(false);
  });
  it('strictly parses only production completed envelopes and detects duplicate decoded keys', async () => {
    const s = setup();
    const o = await consult(s.input, s.dependencies);
    if (o.status !== 'ready') throw new Error();
    const production = {
      ...o.result,
      provider: {
        ...o.result.provider,
        metadata: {
          origin: 'provider-http' as const,
          attempts: 1 as const,
          requestId: 'fixture_HTTP',
          httpStatus: 200,
        },
      },
    };
    const wire = completedJudgmentEnvelope(production);
    if (!wire.ok) throw new Error();
    const json = JSON.stringify(wire.value);
    const parsed = parseCompletedJudgment(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok)
      expect(parsed.value.provider.metadata).toEqual({
        origin: 'provider-http',
        attempts: 1,
        requestId: 'fixture_HTTP',
        httpStatus: null,
      });
    expect(
      parseCompletedJudgment(
        json.replace('"kind":"judgment"', '"kind":"judgment","\\u006bind":"judgment"'),
      ).ok,
    ).toBe(false);
    expect(parseCompletedJudgment(JSON.stringify(o.result)).ok).toBe(false);
    expect(
      parseCompletedJudgment(
        json.replace('"inputTokens":120', '"inputTokens":120.000000000000000001'),
      ).ok,
    ).toBe(false);
  });
});
