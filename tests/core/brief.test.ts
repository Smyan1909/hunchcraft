import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isValidLocator, parseBrief } from '../../src/core/brief.js';
import type { Brief } from '../../src/core/brief.js';

const csv = readFileSync(new URL('../fixtures/briefs/csv13.json', import.meta.url), 'utf8');
const minimal = readFileSync(new URL('../fixtures/briefs/minimal6.json', import.meta.url), 'utf8');
function fixture(): Brief {
  const result = parseBrief(csv);
  if (!result.ok) throw new Error('Expected valid fixture.');
  return result.value;
}

describe('closed brief validation', () => {
  it('preserves original request/excerpts and canonical field order with frozen nested values', () => {
    const result = parseBrief(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected valid fixture.');
    expect(result.value.brief.originalRequest).toBe(
      'Export all filtered rows as CSV and keep the interface usable during export.',
    );
    expect(result.value.brief.evidence[0]?.content).toContain('only the current page');
    expect(Object.keys(result.value.brief)).toEqual([
      'originalRequest',
      'clarifications',
      'requirements',
      'standards',
      'components',
      'relationships',
      'assumptions',
      'evidence',
      'localQuestions',
    ]);
    expect(result.stateBytes).toBe(
      new TextEncoder().encode(JSON.stringify(result.value.brief)).length,
    );
    expect(Object.isFrozen(result.value.brief.components)).toBe(true);
    expect(Object.isFrozen(result.value.brief.components[0]?.requirementRefs)).toBe(true);
    expect(Object.isFrozen(result.value.brief.requirements[0]?.origin)).toBe(true);
    expect(parseBrief(minimal).ok).toBe(true);
  });

  it.each([
    csv.replace('"clarifications": [],', ''),
    csv.replace('"schemaVersion": "hunchcraft.brief.v0"', '"schemaVersion": "other"'),
    csv.replace('"scopeId": "csv-export"', '"scopeId": "csv-export", "sessionId": "secret"'),
    csv.replace('"assumptionRefs": []', '"assumptionRefs": [], "enabled": false'),
    csv.replace('"all-rows"', '"0"'),
    csv.replace('"id": "indicator"', '"id": "serialize"'),
    csv.replace('"quote": "all filtered rows"', '"quote": "All filtered rows"'),
    csv.replace('"requirementRefs": ["all-rows"]', '"requirementRefs": ["missing"]'),
    csv.replace('"evidenceRefs": ["table-scope"]', '"evidenceRefs": []'),
    csv.replace('"requirementRefs": ["all-rows"]', '"requirementRefs": ["all-rows", "all-rows"]'),
    csv.replace('"from": "indicator"', '"from": "serialize"'),
    csv.replace('"provenance": "synthetic-example"', '"provenance": "authenticated"'),
    csv.replace('"startLine": 1', '"startLine": 0'),
    csv.replace('"startLine": 1', '"startLine": 1.00000000000000001'),
    csv.replace('"originalRequest":', '"originalRequest": "", "oldRequest":'),
    '[]',
    'null',
    'true',
  ])('rejects malformed/schema/reference/provenance fixtures %#', (source) => {
    expect(parseBrief(source)).toEqual({
      ok: false,
      error: { code: 'invalid_input', message: 'Input does not satisfy the v0 contract.' },
    });
  });

  it('requires meaningful text but preserves Unicode and exact quote whitespace', () => {
    const base = fixture();
    const brief = {
      ...base.brief,
      originalRequest: '  é\r\n😀  ',
      requirements: [
        {
          id: 'unicode',
          text: ' Interpreted outcome ',
          origin: { kind: 'request', quote: 'é\r\n😀' },
        },
      ],
      components: base.brief.components.map((item) => ({ ...item, requirementRefs: [] })),
      relationships: [],
    };
    const result = parseBrief(JSON.stringify({ ...base, brief }));
    expect(result).toMatchObject({
      ok: true,
      value: { brief: { originalRequest: '  é\r\n😀  ' } },
    });
    expect(
      parseBrief(JSON.stringify({ ...base, brief: { ...brief, originalRequest: ' \t\r\n ' } })).ok,
    ).toBe(false);
    expect(
      parseBrief(
        JSON.stringify({
          ...base,
          brief: {
            ...brief,
            requirements: [
              { id: 'unicode', text: 'Outcome', origin: { kind: 'request', quote: 'é\n😀' } },
            ],
          },
        }),
      ).ok,
    ).toBe(false);
  });

  it('validates every origin variant against the declared source', () => {
    const base = fixture();
    const brief = {
      ...base.brief,
      clarifications: [{ id: 'user', text: 'Keep compatibility.' }],
      requirements: [
        ...base.brief.requirements,
        {
          id: 'compat',
          text: 'Keep compatibility',
          origin: { kind: 'clarification', clarificationId: 'user', quote: 'compatibility' },
        },
        { id: 'escaping', text: 'Escape CSV', origin: { kind: 'inferred', basis: 'CSV format' } },
      ],
      standards: [
        {
          id: 'repo',
          text: 'Current page only',
          origin: { kind: 'repo', evidenceId: 'table-scope', quote: 'current page' },
        },
        {
          id: 'human',
          text: 'Compatibility',
          origin: { kind: 'user', clarificationId: 'user', quote: 'compatibility' },
        },
      ],
    };
    expect(parseBrief(JSON.stringify({ ...base, brief })).ok).toBe(true);
    expect(
      parseBrief(
        JSON.stringify({
          ...base,
          brief: {
            ...brief,
            standards: [
              {
                id: 'repo',
                text: 'Missing',
                origin: { kind: 'repo', evidenceId: 'missing', quote: 'current page' },
              },
            ],
          },
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseBrief(JSON.stringify({ ...base, brief: { ...brief, clarifications: [] } })).ok,
    ).toBe(false);
  });

  it('enforces subject counts, assumption references and local-question subjects', () => {
    const base = fixture();
    const component = base.brief.components[0];
    if (!component) throw new Error('Expected component.');
    expect(
      parseBrief(
        JSON.stringify({
          ...base,
          brief: {
            ...base.brief,
            components: Array.from({ length: 4 }, (_, index) => ({
              ...component,
              id: `component${index.toString()}`,
            })),
          },
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseBrief(
        JSON.stringify({
          ...base,
          brief: {
            ...base.brief,
            assumptions: [
              { id: 'a', statement: 'Unknown API', componentRefs: [], evidenceRefs: [] },
            ],
          },
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseBrief(
        JSON.stringify({
          ...base,
          brief: {
            ...base.brief,
            localQuestions: [
              {
                id: 'q',
                statement: 'Does this hold?',
                componentRefs: [],
                requirementRefs: [],
                evidenceRefs: [],
              },
            ],
          },
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseBrief(
        JSON.stringify({
          ...base,
          brief: {
            ...base.brief,
            assumptions: [
              { id: 'a', statement: 'Unknown API', componentRefs: ['missing'], evidenceRefs: [] },
            ],
          },
        }),
      ).ok,
    ).toBe(false);
  });

  it('enforces input/text/state byte caps without truncation', () => {
    const base = fixture();
    expect(parseBrief(' '.repeat(48 * 1024) + csv).ok).toBe(false);
    expect(
      parseBrief(
        JSON.stringify({ ...base, brief: { ...base.brief, originalRequest: 'é'.repeat(6145) } }),
      ).ok,
    ).toBe(false);
    expect(
      parseBrief(
        JSON.stringify({
          ...base,
          brief: {
            ...base.brief,
            evidence: [
              {
                id: 'e',
                locator: 'src/a',
                startLine: 1,
                content: 'x'.repeat(8193),
                provenance: 'synthetic-example',
              },
            ],
          },
        }),
      ).ok,
    ).toBe(false);
    const parsed = parseBrief(minimal);
    if (!parsed.ok) throw new Error('Expected valid fixture.');
    const brief = {
      ...parsed.value.brief,
      evidence: Array.from({ length: 4 }, (_, index) => ({
        id: `e${index.toString()}`,
        locator: 'src/a',
        startLine: 1,
        content: 'x'.repeat(8000),
        provenance: 'synthetic-example',
      })),
      components: parsed.value.brief.components.map((item) => ({ ...item, evidenceRefs: ['e0'] })),
      originalRequest: 'x'.repeat(1000),
    };
    expect(parseBrief(JSON.stringify({ ...parsed.value, brief }))).toMatchObject({
      ok: false,
      error: { code: 'check_budget_exceeded' },
    });
  });

  it.each([
    '/src/a',
    'src/',
    'src//a',
    './src/a',
    'src/../a',
    'C:/a',
    '\\server\\a',
    'https://a/b',
    'src\\a',
    '.GIT/config',
    'src/.ENV.local',
    'src/.ssh/a',
    'src/id_rsa',
    'src/\ud800',
  ])('rejects noncanonical/sensitive locator %s', (locator) => {
    expect(isValidLocator(locator)).toBe(false);
  });
  it('allows nonempty Unicode/space path segments without filesystem claims', () => {
    expect(isValidLocator('src/é space/😀.ts')).toBe(true);
    expect(isValidLocator('src-old/file.ts')).toBe(true);
  });

  it.each([
    ['clarifications', 4],
    ['requirements', 8],
    ['standards', 4],
    ['components', 3],
    ['relationships', 4],
    ['assumptions', 8],
    ['evidence', 8],
    ['localQuestions', 2],
  ] as const)(
    'accepts the %s maximum and rejects only its coherent maximum+1 count',
    (field, limit) => {
      const parsed = parseBrief(minimal);
      if (!parsed.ok) throw new Error('Expected valid fixture.');
      const base = parsed.value;
      const state = {
        ...base.brief,
        originalRequest: 'Export rows.',
        components: [
          {
            id: 'serialize',
            name: 'Serializer',
            responsibility: 'Export rows.',
            mechanism: 'Serialize rows.',
            claimStatus: 'source-backed',
            requirementRefs: [],
            evidenceRefs: ['table-scope'],
            assumptionRefs: [],
          },
          {
            id: 'support',
            name: 'Support',
            responsibility: 'Test export.',
            mechanism: 'Run tests.',
            claimStatus: 'proposed',
            requirementRefs: [],
            evidenceRefs: [],
            assumptionRefs: [],
          },
        ],
        evidence: [
          {
            id: 'table-scope',
            locator: 'src/a.ts',
            startLine: 1,
            content: 'Rows are supplied.',
            provenance: 'synthetic-example',
          },
        ],
      };
      const build = (count: number): string => {
        const ids = Array.from({ length: count }, (_, index) => `entity${index.toString()}`);
        const entities = {
          clarifications: ids.map((id) => ({ id, text: 'Export rows.' })),
          requirements: ids.map((id) => ({
            id,
            text: 'Export rows.',
            origin: { kind: 'request', quote: 'rows' },
          })),
          standards: ids.map((id) => ({
            id,
            text: 'Use supplied rows.',
            origin: { kind: 'repo', evidenceId: 'table-scope', quote: 'Rows' },
          })),
          components: ids.map((id) => ({
            id,
            name: 'Component',
            responsibility: 'Export rows.',
            mechanism: 'Serialize rows.',
            claimStatus: 'proposed',
            requirementRefs: [],
            evidenceRefs: [],
            assumptionRefs: [],
          })),
          relationships: ids.map((id) => ({
            id,
            from: 'serialize',
            to: 'support',
            contract: 'Test serialized rows.',
            requirementRefs: [],
            evidenceRefs: [],
            assumptionRefs: [],
          })),
          assumptions: ids.map((id) => ({
            id,
            statement: 'Rows are available.',
            componentRefs: ['serialize'],
            evidenceRefs: [],
          })),
          evidence: ids.map((id, index) => ({
            id: index === 0 ? 'table-scope' : id,
            locator: 'src/a.ts',
            startLine: 1,
            content: 'Rows are supplied.',
            provenance: 'synthetic-example',
          })),
          localQuestions: ids.map((id) => ({
            id,
            statement: 'Are rows available?',
            componentRefs: ['serialize'],
            requirementRefs: [],
            evidenceRefs: [],
          })),
        };
        return JSON.stringify({ ...base, brief: { ...state, [field]: entities[field] } });
      };
      const maximum = parseBrief(build(limit));
      expect(maximum).toMatchObject({ ok: true });
      if (!maximum.ok) throw new Error('Expected coherent maximum-count fixture.');
      expect(maximum.value.brief[field]).toHaveLength(limit);
      expect(maximum.inputBytes).toBeLessThan(48 * 1024);
      expect(maximum.stateBytes).toBeLessThan(32 * 1024);

      const overMaximum = build(limit + 1);
      // Even the complete envelope fits below the smaller state cap, so neither
      // state nor input size can explain this rejection.
      expect(new TextEncoder().encode(overMaximum).length).toBeLessThan(32 * 1024);
      expect(parseBrief(overMaximum)).toEqual({
        ok: false,
        error: { code: 'invalid_input', message: 'Input does not satisfy the v0 contract.' },
      });

      const missing = Object.fromEntries(Object.entries(state).filter(([key]) => key !== field));
      expect(parseBrief(JSON.stringify({ ...base, brief: missing }))).toEqual({
        ok: false,
        error: { code: 'invalid_input', message: 'Input does not satisfy the v0 contract.' },
      });
    },
  );

  it('does not treat a same-spelled ID in another entity type as a valid reference', () => {
    const base = fixture();
    const source = {
      ...base,
      brief: {
        ...base.brief,
        components: base.brief.components.map((item) => ({
          ...item,
          requirementRefs: ['table-scope'],
        })),
      },
    };
    expect(parseBrief(JSON.stringify(source)).ok).toBe(false);
    const valid = {
      ...base,
      brief: {
        ...base.brief,
        assumptions: [
          {
            id: 'serialize',
            statement: 'Unknown premise',
            componentRefs: ['serialize'],
            evidenceRefs: [],
          },
        ],
      },
    };
    expect(parseBrief(JSON.stringify(valid)).ok).toBe(true);
  });
});
