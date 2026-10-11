import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBrief } from '../../src/core/brief.js';
import type { Brief } from '../../src/core/brief.js';
import { compileChecks } from '../../src/core/checks.js';

function fixture(name: string): Brief {
  const result = parseBrief(
    readFileSync(new URL(`../fixtures/briefs/${name}.json`, import.meta.url)),
  );
  if (!result.ok) throw new Error('Expected valid fixture.');
  return result.value;
}

describe('mandatory component-outline.v0 compiler', () => {
  it.each([
    ['minimal6', 6],
    ['csv13', 13],
  ] as const)(
    'matches independently expanded %s golden fields and compact bytes',
    (name, count) => {
      const result = compileChecks(fixture(name));
      if (!result.ok) throw new Error('Expected valid compilation.');
      const expected: unknown = JSON.parse(
        readFileSync(new URL(`../fixtures/checks/${name}.json`, import.meta.url), 'utf8'),
      );
      expect(result.value.checks).toEqual(expected);
      expect(JSON.stringify(result.value.checks)).toBe(JSON.stringify(expected));
      expect(result.value.checks).toHaveLength(count);
      expect(Object.keys(result.value.questions)).toEqual(
        Array.from({ length: count }, (_, index) => `q${(index + 1).toString().padStart(3, '0')}`),
      );
      expect(result.value.questionBytes).toBe(
        new TextEncoder().encode(JSON.stringify(result.value.questions)).length,
      );
      expect(Object.isFrozen(result.value.checks[0]?.question.instructions.contextPaths)).toBe(
        true,
      );
      expect(Object.isFrozen(result.value.questions)).toBe(true);
    },
  );

  it('never skips evidence/global checks or removes necessary supporting work', () => {
    const base = fixture('minimal6');
    const source = {
      ...base,
      brief: {
        ...base.brief,
        components: base.brief.components.map((item) => ({
          ...item,
          name: 'Regression and cleanup support',
          responsibility: 'Test compatibility and dispose resources',
          mechanism: 'Run regressions and release listeners',
          claimStatus: 'unknown',
          evidenceRefs: [],
        })),
      },
    };
    const parsed = parseBrief(JSON.stringify(source));
    if (!parsed.ok) throw new Error('Expected valid fixture.');
    const compiled = compileChecks(parsed.value);
    if (!compiled.ok) throw new Error('Expected valid compilation.');
    expect(compiled.value.checks.map((check) => check.id)).toEqual([
      'g.request-gap',
      'g.domain-gap',
      'c.serialize.contradiction',
      'c.serialize.evidence-gap',
      'c.serialize.plausibility',
      'c.serialize.justification',
    ]);
    expect(compiled.value.state.components[0]?.name).toBe('Regression and cleanup support');
    expect(compiled.value.checks.every((check) => check.evidenceRefs.includes('table-scope'))).toBe(
      true,
    );
    expect(compiled.value.checks.every((check) => !Object.hasOwn(check, 'answer'))).toBe(true);
  });

  it('unions declared/associated assumptions and relationship/local refs by first occurrence', () => {
    const base = fixture('csv13');
    const source = {
      ...base,
      brief: {
        ...base.brief,
        components: base.brief.components.map((item) => ({
          ...item,
          assumptionRefs: item.id === 'serialize' ? ['z'] : ['a'],
        })),
        assumptions: [
          {
            id: 'a',
            statement: 'Shared premise',
            componentRefs: ['serialize', 'indicator'],
            evidenceRefs: [],
          },
          { id: 'z', statement: 'First declared', componentRefs: ['serialize'], evidenceRefs: [] },
        ],
        localQuestions: [
          {
            id: 'condition',
            statement: 'Does the contract provide the requested scope?',
            componentRefs: ['indicator', 'serialize'],
            requirementRefs: ['all-rows'],
            evidenceRefs: [],
          },
        ],
      },
    };
    const parsed = parseBrief(JSON.stringify(source));
    if (!parsed.ok) throw new Error('Expected valid fixture.');
    const result = compileChecks(parsed.value);
    if (!result.ok) throw new Error('Expected valid compilation.');
    expect(result.value.checks[4]?.assumptionRefs).toEqual(['z', 'a']);
    expect(result.value.checks[12]?.assumptionRefs).toEqual(['a', 'z']);
    const local = result.value.checks[13];
    expect(local?.componentRefs).toEqual(['indicator', 'serialize']);
    expect(local?.requirementRefs).toEqual(['all-rows']);
    expect(local?.assumptionRefs).toEqual(['a', 'z']);
    expect(local?.question.instructions.contextPaths).toEqual([
      'originalRequest',
      'clarifications',
      'standards',
      'requirements[0]',
      'components[1]',
      'components[0]',
      'assumptions[0]',
      'assumptions[1]',
      'localQuestions[0]',
      'evidence[0]',
      'evidence[1]',
    ]);
    expect(local?.question.instructions.task).toContain(
      'the local question at `localQuestions[0]`',
    );
  });

  it('accepts exactly16 and rejects17 mandatory checks, never silently truncating', () => {
    const base = fixture('csv13');
    const component = base.brief.components[0];
    if (!component) throw new Error('Expected component.');
    const build = (relationships: Brief['brief']['relationships']): Brief => {
      const parsed = parseBrief(
        JSON.stringify({
          ...base,
          brief: {
            ...base.brief,
            relationships,
            components: [
              ...base.brief.components,
              { ...component, id: 'support', requirementRefs: [] },
            ],
          },
        }),
      );
      if (!parsed.ok) throw new Error('Expected valid fixture.');
      return parsed.value;
    };
    const sixteen = compileChecks(build([]));
    expect(sixteen.ok).toBe(true);
    expect(compileChecks(build(base.brief.relationships))).toMatchObject({
      ok: false,
      error: { code: 'check_budget_exceeded' },
    });
  });

  it('rejects full wire-question byte overflow even when the count and state fit', () => {
    const base = fixture('csv13');
    const component = base.brief.components[0];
    if (!component) throw new Error('Expected component.');
    const assumptionRefs = Array.from({ length: 8 }, (_, index) => `a${index.toString()}`);
    const source = {
      ...base,
      brief: {
        ...base.brief,
        relationships: [],
        components: [component, ...base.brief.components].map((item, index) => ({
          ...item,
          id: `c${index.toString()}`,
          requirementRefs: ['all-rows', 'usable-ui'],
          assumptionRefs,
        })),
        assumptions: assumptionRefs.map((id) => ({
          id,
          statement: 'Explicit unknown',
          componentRefs: ['c0', 'c1', 'c2'],
          evidenceRefs: [],
        })),
        evidence: Array.from({ length: 8 }, (_, index) => ({
          id: `e${index.toString()}`,
          locator: 'src/a',
          startLine: 1,
          content: 'Supplied evidence',
          provenance: 'synthetic-example',
        })),
      },
    };
    source.brief.components = source.brief.components.map((item) => ({
      ...item,
      evidenceRefs: ['e0'],
    }));
    const parsed = parseBrief(JSON.stringify(source));
    if (!parsed.ok) throw new Error('Expected valid bounded state.');
    expect(parsed.stateBytes).toBeLessThan(32 * 1024);
    expect(compileChecks(parsed.value)).toMatchObject({
      ok: false,
      error: { code: 'check_budget_exceeded' },
    });
  });
});
