import {
  checkBudgetExceeded,
  hasValidScalars,
  invalidInput,
  parseStrictJson,
  utf8Bytes,
} from './strict-json.js';
import type { CoreFailure, JsonObject, JsonValue } from './strict-json.js';

export const BRIEF_SCHEMA_VERSION = 'hunchcraft.brief.v1';
export interface Clarification {
  readonly id: string;
  readonly text: string;
}
export type RequirementOrigin =
  | Readonly<{ kind: 'request'; quote: string }>
  | Readonly<{ kind: 'clarification'; clarificationId: string; quote: string }>
  | Readonly<{ kind: 'inferred'; basis: string }>;
export interface Requirement {
  readonly id: string;
  readonly text: string;
  readonly origin: RequirementOrigin;
}
export type StandardOrigin =
  | Readonly<{ kind: 'repo'; evidenceId: string; quote: string }>
  | Readonly<{ kind: 'user'; clarificationId: string; quote: string }>;
export interface Standard {
  readonly id: string;
  readonly text: string;
  readonly origin: StandardOrigin;
}
export interface Component {
  readonly id: string;
  readonly name: string;
  readonly responsibility: string;
  readonly mechanism: string;
  readonly claimStatus: 'proposed' | 'source-backed' | 'unknown';
  readonly requirementRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly assumptionRefs: readonly string[];
}
export interface Relationship {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly contract: string;
  readonly requirementRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly assumptionRefs: readonly string[];
}
export interface Assumption {
  readonly id: string;
  readonly statement: string;
  readonly componentRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
}
export interface Evidence {
  readonly id: string;
  readonly locator: string;
  readonly startLine: number;
  readonly content: string;
  readonly provenance: 'caller-repo-read' | 'synthetic-example';
}
export interface LocalQuestion {
  readonly id: string;
  readonly statement: string;
  readonly componentRefs: readonly string[];
  readonly requirementRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
}
export interface BriefState {
  readonly originalRequest: string;
  readonly clarifications: readonly Clarification[];
  readonly requirements: readonly Requirement[];
  readonly standards: readonly Standard[];
  readonly components: readonly Component[];
  readonly relationships: readonly Relationship[];
  readonly assumptions: readonly Assumption[];
  readonly evidence: readonly Evidence[];
  readonly localQuestions: readonly LocalQuestion[];
}
export interface Brief {
  readonly schemaVersion: typeof BRIEF_SCHEMA_VERSION;
  readonly brief: BriefState;
}
export type ParsedBrief =
  Readonly<{ ok: true; value: Brief; inputBytes: number; stateBytes: number }> | CoreFailure;

class InvalidBrief extends Error {}
function record(value: JsonValue | undefined, fields: readonly string[]): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new InvalidBrief();
  // Narrow the readonly array alternative without asserting a domain schema.
  if (!isObject(value)) throw new InvalidBrief();
  const keys = Object.keys(value);
  if (keys.length !== fields.length || fields.some((field) => !Object.hasOwn(value, field)))
    throw new InvalidBrief();
  return value;
}
function isObject(value: JsonObject | readonly JsonValue[]): value is JsonObject {
  return !Array.isArray(value);
}
function text(value: JsonValue | undefined, max = 4 * 1024): string {
  if (typeof value !== 'string' || value.trim().length === 0 || utf8Bytes(value) > max)
    throw new InvalidBrief();
  return value;
}
function id(value: JsonValue | undefined): string {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value))
    throw new InvalidBrief();
  return value;
}
function array<T>(
  value: JsonValue | undefined,
  max: number,
  build: (value: JsonValue) => T,
  min = 0,
): readonly T[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new InvalidBrief();
  return Object.freeze(value.map((item: JsonValue) => build(item)));
}
function refs(value: JsonValue | undefined, max: number, min = 0): readonly string[] {
  const result = array(value, max, id, min);
  if (new Set(result).size !== result.length) throw new InvalidBrief();
  return result;
}

export function isValidLocator(locator: string): boolean {
  if (locator.length === 0 || !hasValidScalars(locator) || /[\\:\0]/.test(locator)) return false;
  const segments = locator.split('/');
  return segments.every((segment) => {
    const lower = segment.toLowerCase();
    return (
      segment !== '' &&
      segment !== '.' &&
      segment !== '..' &&
      !lower.startsWith('.env') &&
      ![
        '.git',
        '.ssh',
        '.claude',
        '.codex',
        '.agents',
        '.aws',
        '.gnupg',
        '.config',
        'id_rsa',
        'id_dsa',
        'id_ecdsa',
        'id_ed25519',
      ].includes(lower)
    );
  });
}

function requirementOrigin(value: JsonValue | undefined): RequirementOrigin {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !isObject(value))
    throw new InvalidBrief();
  switch (value.kind) {
    case 'request': {
      const v = record(value, ['kind', 'quote']);
      return Object.freeze({ kind: 'request', quote: text(v.quote) });
    }
    case 'clarification': {
      const v = record(value, ['kind', 'clarificationId', 'quote']);
      return Object.freeze({
        kind: 'clarification',
        clarificationId: id(v.clarificationId),
        quote: text(v.quote),
      });
    }
    case 'inferred': {
      const v = record(value, ['kind', 'basis']);
      return Object.freeze({ kind: 'inferred', basis: text(v.basis) });
    }
    default:
      throw new InvalidBrief();
  }
}
function standardOrigin(value: JsonValue | undefined): StandardOrigin {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !isObject(value))
    throw new InvalidBrief();
  switch (value.kind) {
    case 'repo': {
      const v = record(value, ['kind', 'evidenceId', 'quote']);
      return Object.freeze({ kind: 'repo', evidenceId: id(v.evidenceId), quote: text(v.quote) });
    }
    case 'user': {
      const v = record(value, ['kind', 'clarificationId', 'quote']);
      return Object.freeze({
        kind: 'user',
        clarificationId: id(v.clarificationId),
        quote: text(v.quote),
      });
    }
    default:
      throw new InvalidBrief();
  }
}

function buildState(value: JsonValue | undefined): BriefState {
  const v = record(value, [
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
  return Object.freeze({
    originalRequest: text(v.originalRequest, 12 * 1024),
    clarifications: array(v.clarifications, 4, (item) => {
      const x = record(item, ['id', 'text']);
      return Object.freeze({ id: id(x.id), text: text(x.text) });
    }),
    requirements: array(v.requirements, 8, (item) => {
      const x = record(item, ['id', 'text', 'origin']);
      return Object.freeze({
        id: id(x.id),
        text: text(x.text),
        origin: requirementOrigin(x.origin),
      });
    }),
    standards: array(v.standards, 4, (item) => {
      const x = record(item, ['id', 'text', 'origin']);
      return Object.freeze({ id: id(x.id), text: text(x.text), origin: standardOrigin(x.origin) });
    }),
    components: array(
      v.components,
      3,
      (item) => {
        const x = record(item, [
          'id',
          'name',
          'responsibility',
          'mechanism',
          'claimStatus',
          'requirementRefs',
          'evidenceRefs',
          'assumptionRefs',
        ]);
        const claimStatus = x.claimStatus;
        if (
          claimStatus !== 'proposed' &&
          claimStatus !== 'source-backed' &&
          claimStatus !== 'unknown'
        )
          throw new InvalidBrief();
        const result = Object.freeze({
          id: id(x.id),
          name: text(x.name),
          responsibility: text(x.responsibility),
          mechanism: text(x.mechanism),
          claimStatus,
          requirementRefs: refs(x.requirementRefs, 8),
          evidenceRefs: refs(x.evidenceRefs, 8),
          assumptionRefs: refs(x.assumptionRefs, 8),
        });
        if (claimStatus === 'source-backed' && result.evidenceRefs.length === 0)
          throw new InvalidBrief();
        return result;
      },
      1,
    ),
    relationships: array(v.relationships, 4, (item) => {
      const x = record(item, [
        'id',
        'from',
        'to',
        'contract',
        'requirementRefs',
        'evidenceRefs',
        'assumptionRefs',
      ]);
      return Object.freeze({
        id: id(x.id),
        from: id(x.from),
        to: id(x.to),
        contract: text(x.contract),
        requirementRefs: refs(x.requirementRefs, 8),
        evidenceRefs: refs(x.evidenceRefs, 8),
        assumptionRefs: refs(x.assumptionRefs, 8),
      });
    }),
    assumptions: array(v.assumptions, 8, (item) => {
      const x = record(item, ['id', 'statement', 'componentRefs', 'evidenceRefs']);
      return Object.freeze({
        id: id(x.id),
        statement: text(x.statement),
        componentRefs: refs(x.componentRefs, 3, 1),
        evidenceRefs: refs(x.evidenceRefs, 8),
      });
    }),
    evidence: array(
      v.evidence,
      8,
      (item) => {
        const x = record(item, ['id', 'locator', 'startLine', 'content', 'provenance']);
        const locator = x.locator;
        const startLine = x.startLine;
        const provenance = x.provenance;
        if (
          typeof locator !== 'string' ||
          utf8Bytes(locator) > 4 * 1024 ||
          !isValidLocator(locator) ||
          typeof startLine !== 'number' ||
          !Number.isSafeInteger(startLine) ||
          startLine < 1 ||
          (provenance !== 'caller-repo-read' && provenance !== 'synthetic-example')
        )
          throw new InvalidBrief();
        return Object.freeze({
          id: id(x.id),
          locator,
          startLine,
          content: text(x.content, 8 * 1024),
          provenance,
        });
      },
      1,
    ),
    localQuestions: array(v.localQuestions, 2, (item) => {
      const x = record(item, [
        'id',
        'statement',
        'componentRefs',
        'requirementRefs',
        'evidenceRefs',
      ]);
      const result = Object.freeze({
        id: id(x.id),
        statement: text(x.statement),
        componentRefs: refs(x.componentRefs, 3),
        requirementRefs: refs(x.requirementRefs, 8),
        evidenceRefs: refs(x.evidenceRefs, 8),
      });
      if (result.componentRefs.length + result.requirementRefs.length === 0)
        throw new InvalidBrief();
      return result;
    }),
  });
}

function validateReferences(state: BriefState): void {
  const entities = [
    state.clarifications,
    state.requirements,
    state.standards,
    state.components,
    state.relationships,
    state.assumptions,
    state.evidence,
    state.localQuestions,
  ];
  for (const list of entities)
    if (new Set(list.map((item) => item.id)).size !== list.length) throw new InvalidBrief();
  const check = (references: readonly string[], list: readonly { readonly id: string }[]): void => {
    if (references.some((reference) => !list.some((item) => item.id === reference)))
      throw new InvalidBrief();
  };
  const quote = (source: string | undefined, quoted: string): void => {
    if (source === undefined || !source.includes(quoted)) throw new InvalidBrief();
  };
  for (const requirement of state.requirements) {
    const origin = requirement.origin;
    if (origin.kind === 'request') quote(state.originalRequest, origin.quote);
    if (origin.kind === 'clarification')
      quote(
        state.clarifications.find((item) => item.id === origin.clarificationId)?.text,
        origin.quote,
      );
  }
  for (const standard of state.standards) {
    const origin = standard.origin;
    quote(
      origin.kind === 'repo'
        ? state.evidence.find((item) => item.id === origin.evidenceId)?.content
        : state.clarifications.find((item) => item.id === origin.clarificationId)?.text,
      origin.quote,
    );
  }
  for (const item of [...state.components, ...state.relationships]) {
    check(item.requirementRefs, state.requirements);
    check(item.evidenceRefs, state.evidence);
    check(item.assumptionRefs, state.assumptions);
  }
  for (const item of state.relationships) {
    check([item.from, item.to], state.components);
    if (item.from === item.to) throw new InvalidBrief();
  }
  for (const item of state.assumptions) {
    check(item.componentRefs, state.components);
    check(item.evidenceRefs, state.evidence);
  }
  for (const item of state.localQuestions) {
    check(item.componentRefs, state.components);
    check(item.requirementRefs, state.requirements);
    check(item.evidenceRefs, state.evidence);
  }
}

/** Strict JSON -> fresh canonical closed objects. Provenance remains caller-supplied. */
export function parseBrief(input: string | Uint8Array): ParsedBrief {
  const parsed = parseStrictJson(input);
  if (!parsed.ok) return parsed;
  try {
    const v = record(parsed.value, ['schemaVersion', 'brief']);
    if (v.schemaVersion !== BRIEF_SCHEMA_VERSION) throw new InvalidBrief();
    const value: Brief = Object.freeze({
      schemaVersion: BRIEF_SCHEMA_VERSION,
      brief: buildState(v.brief),
    });
    validateReferences(value.brief);
    const stateBytes = utf8Bytes(JSON.stringify(value.brief));
    if (stateBytes > 32 * 1024) return checkBudgetExceeded();
    return Object.freeze({ ok: true, value, inputBytes: parsed.inputBytes, stateBytes });
  } catch (error) {
    if (error instanceof InvalidBrief) return invalidInput();
    throw error;
  }
}
