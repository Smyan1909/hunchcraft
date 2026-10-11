import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBrief } from '../../src/core/brief.js';
import { compileChecks } from '../../src/core/checks.js';
import { identityBytes, identityRepresentation } from '../../src/core/identity.js';

function representation(source: string): string {
  const brief = parseBrief(source);
  if (!brief.ok) throw new Error('Expected valid fixture.');
  const plan = compileChecks(brief.value);
  if (!plan.ok) throw new Error('Expected valid compilation.');
  const text = identityRepresentation(brief.value, plan.value);
  expect(identityBytes(brief.value, plan.value)).toEqual(new TextEncoder().encode(text));
  return text;
}
const csv = readFileSync(new URL('../fixtures/briefs/csv13.json', import.meta.url), 'utf8');

describe('pure canonical source identity representation', () => {
  it.each(['csv13', 'minimal6'])(
    'matches exact canonical bytes from independently authored %s fixtures',
    (name) => {
      const source = readFileSync(
        new URL(`../fixtures/briefs/${name}.json`, import.meta.url),
        'utf8',
      );
      // Parse expected fixture bytes independently; no call to the production compiler
      // supplies expected checks, constants, order or question text.
      const raw: unknown = JSON.parse(source);
      if (typeof raw !== 'object' || raw === null || !('brief' in raw) || !('context' in raw))
        throw new Error('Invalid expected fixture.');
      const checks: unknown = JSON.parse(
        readFileSync(new URL(`../fixtures/checks/${name}.json`, import.meta.url), 'utf8'),
      );
      const expected = JSON.stringify({
        identityVersion: 'hunchcraft.identity.v0',
        briefSchemaVersion: 'hunchcraft.brief.v0',
        context: raw.context,
        state: raw.brief,
        checkSetId: 'component-outline.v0',
        compiledChecks: checks,
        requestedModel: 'jev-1.13.0',
        endpoint: 'https://api.typesafe.ai',
        executionPolicyVersion: 'hunchcraft.policy.v0',
      });
      const actual = representation(source);
      expect(actual).toBe(expected);
      expect(actual.endsWith('\n')).toBe(false);
      expect(createHash('sha256').update(actual, 'utf8').digest('hex')).toBe(
        createHash('sha256').update(expected, 'utf8').digest('hex'),
      );
    },
  );

  it('rebuilds object keys but preserves array and string semantics', () => {
    const parsed: unknown = JSON.parse(csv);
    function reverseKeys(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(reverseKeys);
      if (typeof value !== 'object' || value === null) return value;
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([key, item]) => [key, reverseKeys(item)]),
      );
    }
    expect(representation(JSON.stringify(reverseKeys(parsed)))).toBe(representation(csv));
    expect(
      representation(
        csv.replace('csv-request-1', 'another-request').replace('csv-export', 'another-scope'),
      ),
    ).toBe(representation(csv));
    for (const changed of [
      csv.replace('proposal-1', 'proposal-2'),
      csv.replace('csv-goal', 'new-goal'),
      csv.replace('CSV serializer', ' CSV serializer'),
      csv.replace('current page of', 'current pages of'),
    ]) {
      expect(representation(changed)).not.toBe(representation(csv));
    }
    const brief = parseBrief(csv);
    if (!brief.ok) throw new Error('Expected valid fixture.');
    expect(
      representation(
        JSON.stringify({
          ...brief.value,
          brief: { ...brief.value.brief, components: [...brief.value.brief.components].reverse() },
        }),
      ),
    ).not.toBe(representation(csv));
  });

  it('includes exact template/criteria/binding records and returns separately owned bytes', () => {
    const brief = parseBrief(csv);
    if (!brief.ok) throw new Error('Expected valid fixture.');
    const plan = compileChecks(brief.value);
    if (!plan.ok) throw new Error('Expected valid compilation.');
    const before = identityRepresentation(brief.value, plan.value);
    const criteriaPlan = {
      ...plan.value,
      checks: plan.value.checks.map((check) =>
        check.question.type === 'score'
          ? {
              ...check,
              question: { ...check.question, criteria: [...check.question.criteria].reverse() },
            }
          : check,
      ),
    };
    expect(identityRepresentation(brief.value, criteriaPlan)).not.toBe(before);
    const bindingPlan = {
      ...plan.value,
      checks: plan.value.checks.map((check) => ({
        ...check,
        evidenceRefs: [...check.evidenceRefs].reverse(),
      })),
    };
    expect(identityRepresentation(brief.value, bindingPlan)).not.toBe(before);
    const changedPlan = {
      ...plan.value,
      checks: plan.value.checks.map((check, index) =>
        index === 0
          ? {
              ...check,
              templateId: 'different-version',
              question: {
                ...check.question,
                instructions: { ...check.question.instructions, task: 'Changed literal question' },
              },
            }
          : check,
      ),
    };
    expect(identityRepresentation(brief.value, changedPlan)).not.toBe(before);
    const bytes = identityBytes(brief.value, plan.value);
    bytes.fill(0);
    expect(identityRepresentation(brief.value, plan.value)).toBe(before);
    expect(identityBytes(brief.value, plan.value)[0]).toBe(123);
  });
});
