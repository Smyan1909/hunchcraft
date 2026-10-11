import type { Brief } from './brief.js';
import { isValidLocator } from './brief.js';
import { CHECK_SET_ID, EXECUTION_POLICY_VERSION, REQUESTED_MODEL } from './checks.js';
import type { Freshness, Validation } from './result.js';
import { valid, invalid } from './result.js';
import { parseStrictJson, utf8Bytes } from './strict-json.js';
import {
  InvalidValue,
  record,
  list,
  text,
  identifier,
  hex,
  numeric,
  literal,
  oneOf,
  bool,
  epoch,
} from './value.js';

const categories = [
  'original-request',
  'clarifications',
  'requirements',
  'standards',
  'proposal',
  'excerpts',
  'local-questions',
] as const;
export interface Scope {
  readonly schemaVersion: 'hunchcraft.scope.v0';
  readonly scopeId: string;
  readonly allowedContent: readonly (typeof categories)[number][];
  readonly excerptRoots: readonly string[];
  readonly allowSyntheticEvidence: boolean;
}
export interface RootFileIdentity {
  readonly platform: 'unix' | 'win32';
  readonly device: string;
  readonly inode: string;
}
export interface RepoObservation {
  readonly rootPath: string;
  readonly rootFileIdentity: RootFileIdentity;
  readonly cwdWithinRoot: boolean;
}
export interface ConsentSnapshot {
  readonly sessionId: string;
  readonly scope: Scope;
  readonly repo: Readonly<{ rootPath: string; rootFileIdentity: RootFileIdentity }>;
  readonly salt: string;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  readonly generation: number;
  readonly maxCalls: number;
  readonly attemptsUsed: number;
  readonly revoked: boolean;
  readonly activeInvocationId: string | null;
}
export interface ConsentExpectation {
  readonly sessionId: string;
  readonly scopeId: string;
  readonly repo: RepoObservation;
  readonly expectedGeneration: number | null;
}
export function invocationId(value: unknown): string {
  const result = text(value, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result))
    throw new InvalidValue();
  return result;
}
function rootIdentity(value: unknown): RootFileIdentity {
  const v = record(value, ['platform', 'device', 'inode']);
  const platform = oneOf(v.platform, ['unix', 'win32']);
  const device = text(v.device, 32);
  const inode = text(v.inode, 32);
  if (
    !/^(?:0|[1-9]\d{0,31})$/.test(device) ||
    !/^[1-9]\d{0,31}$/.test(inode) ||
    (platform === 'win32' && device === '0')
  )
    throw new InvalidValue();
  return Object.freeze({ platform, device, inode });
}
function rootPath(value: unknown, identity: RootFileIdentity): string {
  const path = text(value);
  if (identity.platform === 'unix' ? !path.startsWith('/') : !/^[A-Za-z]:[\\/]/.test(path))
    throw new InvalidValue();
  return path;
}
export function reconstructRepoObservation(value: unknown): Validation<RepoObservation> {
  try {
    const v = record(value, ['rootPath', 'rootFileIdentity', 'cwdWithinRoot']);
    const identity = rootIdentity(v.rootFileIdentity);
    return valid(
      Object.freeze({
        rootPath: rootPath(v.rootPath, identity),
        rootFileIdentity: identity,
        cwdWithinRoot: bool(v.cwdWithinRoot),
      }),
    );
  } catch {
    return invalid('internal_failure', 'internal');
  }
}
function scope(value: unknown): Scope {
  const v = record(value, [
    'schemaVersion',
    'scopeId',
    'allowedContent',
    'excerptRoots',
    'allowSyntheticEvidence',
  ]);
  const allowedContent = list(v.allowedContent, 7, (x) => oneOf(x, categories), 4);
  const excerptRoots = list(
    v.excerptRoots,
    8,
    (x) => {
      const p = text(x);
      if (p !== '.' && !isValidLocator(p)) throw new InvalidValue();
      return p;
    },
    1,
  );
  if (
    new Set(allowedContent).size !== allowedContent.length ||
    new Set(excerptRoots).size !== excerptRoots.length ||
    ['original-request', 'requirements', 'proposal', 'excerpts'].some(
      (c) => !allowedContent.some((a) => a === c),
    )
  )
    throw new InvalidValue();
  const result = Object.freeze({
    schemaVersion: literal(v.schemaVersion, 'hunchcraft.scope.v0'),
    scopeId: identifier(v.scopeId),
    allowedContent,
    excerptRoots,
    allowSyntheticEvidence: bool(v.allowSyntheticEvidence),
  });
  if (utf8Bytes(JSON.stringify(result)) > 16 * 1024) throw new InvalidValue();
  return result;
}
export function parseScope(input: string | Uint8Array): Validation<Scope> {
  const parsed = parseStrictJson(input, { maxBytes: 16 * 1024 });
  if (!parsed.ok) return invalid('invalid_input', 'input');
  try {
    return valid(scope(parsed.value));
  } catch {
    return invalid('invalid_input', 'input');
  }
}
function consent(value: unknown): ConsentSnapshot {
  const v = record(value, [
    'sessionId',
    'scope',
    'repo',
    'salt',
    'createdAtMs',
    'expiresAtMs',
    'generation',
    'maxCalls',
    'attemptsUsed',
    'revoked',
    'activeInvocationId',
  ]);
  const r = record(v.repo, ['rootPath', 'rootFileIdentity']);
  const identity = rootIdentity(r.rootFileIdentity);
  const createdAtMs = epoch(v.createdAtMs);
  const expiresAtMs = epoch(v.expiresAtMs);
  const maxCalls = numeric(v.maxCalls, 10, true, 1);
  if (expiresAtMs - createdAtMs < 60000 || expiresAtMs - createdAtMs > 1800000)
    throw new InvalidValue();
  const result = Object.freeze({
    sessionId: hex(v.sessionId, 32),
    scope: scope(v.scope),
    repo: Object.freeze({ rootPath: rootPath(r.rootPath, identity), rootFileIdentity: identity }),
    salt: hex(v.salt, 32),
    createdAtMs,
    expiresAtMs,
    generation: numeric(v.generation, undefined, true),
    maxCalls,
    attemptsUsed: numeric(v.attemptsUsed, maxCalls, true),
    revoked: bool(v.revoked),
    activeInvocationId: v.activeInvocationId === null ? null : invocationId(v.activeInvocationId),
  });
  if (utf8Bytes(JSON.stringify(result)) > 16 * 1024) throw new InvalidValue();
  return result;
}
export function reconstructConsentSnapshot(value: unknown): Validation<ConsentSnapshot> {
  try {
    return valid(consent(value));
  } catch {
    return invalid('local_io', 'consent');
  }
}
export function checkScope(input: Brief, allowed: Scope): Validation<Scope> {
  try {
    const s = scope(allowed);
    const b = input.brief;
    if (
      input.scopeId !== s.scopeId ||
      (b.clarifications.length && !s.allowedContent.includes('clarifications')) ||
      (b.standards.length && !s.allowedContent.includes('standards')) ||
      (b.localQuestions.length && !s.allowedContent.includes('local-questions'))
    )
      return invalid('scope_mismatch', 'consent');
    if (
      b.evidence.some(
        (e) =>
          !isValidLocator(e.locator) ||
          (e.provenance === 'synthetic-example' && !s.allowSyntheticEvidence) ||
          !s.excerptRoots.some(
            (root) => root === '.' || e.locator === root || e.locator.startsWith(`${root}/`),
          ),
      )
    )
      return invalid('scope_mismatch', 'consent');
    return valid(s);
  } catch {
    return invalid('scope_mismatch', 'consent');
  }
}
export function checkConsent(
  snapshot: ConsentSnapshot,
  expected: ConsentExpectation,
  nowMs: number,
): Validation<ConsentSnapshot> {
  const rebuilt = reconstructConsentSnapshot(snapshot);
  if (!rebuilt.ok) return rebuilt;
  try {
    const s = rebuilt.value;
    const now = epoch(nowMs);
    const repo = reconstructRepoObservation(expected.repo);
    if (!repo.ok) return invalid('scope_mismatch', 'consent');
    if (s.revoked) return invalid('consent_revoked', 'consent');
    if (now >= s.expiresAtMs) return invalid('consent_expired', 'consent');
    if (now < s.createdAtMs - 1000) return invalid('clock_inconsistent', 'internal');
    if (
      s.sessionId !== expected.sessionId ||
      s.scope.scopeId !== expected.scopeId ||
      !repo.value.cwdWithinRoot ||
      s.repo.rootPath !== repo.value.rootPath ||
      JSON.stringify(s.repo.rootFileIdentity) !== JSON.stringify(repo.value.rootFileIdentity) ||
      (expected.expectedGeneration !== null && s.generation !== expected.expectedGeneration)
    )
      return invalid('scope_mismatch', 'consent');
    return rebuilt;
  } catch {
    return invalid('clock_inconsistent', 'internal');
  }
}
export function repoBindingBytes(snapshot: ConsentSnapshot): Uint8Array {
  const s = consent(snapshot);
  return new TextEncoder().encode(
    JSON.stringify({
      rootPath: s.repo.rootPath,
      rootFileIdentity: s.repo.rootFileIdentity,
      salt: s.salt,
    }),
  );
}
export function completionTimes(snapshot: ConsentSnapshot, nowMs: number): Validation<Freshness> {
  try {
    const s = consent(snapshot);
    const now = epoch(nowMs);
    if (now < s.createdAtMs - 1000) return invalid('clock_inconsistent', 'internal');
    if (now >= s.expiresAtMs) return invalid('consent_expired', 'consent');
    return valid(
      Object.freeze({
        status: 'requires-current-brief-check',
        completedAt: new Date(now).toISOString(),
        expiresAt: new Date(Math.min(s.expiresAtMs, now + 60000)).toISOString(),
      }),
    );
  } catch {
    return invalid('clock_inconsistent', 'internal');
  }
}
export type TerminalState =
  'completed' | 'delivery-unknown' | 'unavailable' | 'failed' | 'timeout' | 'cancelled';
export type Terminal =
  | Readonly<{
      state: 'completed' | 'delivery-unknown';
      completedAtMs: number;
      resultExpiresAtMs: number;
    }>
  | Readonly<{
      state: 'unavailable' | 'failed' | 'timeout' | 'cancelled';
      completedAtMs: null;
      resultExpiresAtMs: null;
    }>;
export interface RecordedAttempt {
  readonly requestId: string;
  readonly invocationId: string;
  readonly sourceDigest: string;
  readonly state: 'active' | TerminalState;
  readonly completedAtMs: number | null;
  readonly resultExpiresAtMs: number | null;
}
export interface SessionRead {
  readonly consent: ConsentSnapshot;
  readonly attempt: RecordedAttempt | null;
}
export interface AdmissionInput {
  readonly sessionId: string;
  readonly requestId: string;
  readonly invocationId: string;
  readonly scopeId: string;
  readonly sourceDigest: string;
  readonly repoBinding: string;
  readonly repo: RepoObservation;
  readonly expectedGeneration: number;
  readonly checkSetId: typeof CHECK_SET_ID;
  readonly policyVersion: typeof EXECUTION_POLICY_VERSION;
  readonly requestedModel: typeof REQUESTED_MODEL;
}
export interface Reservation {
  readonly admission: AdmissionInput;
  readonly consent: ConsentSnapshot;
}
export interface FinalizationInput {
  readonly sessionId: string;
  readonly requestId: string;
  readonly invocationId: string;
  readonly sourceDigest: string;
  readonly terminal: Terminal;
}
export interface FinalizationReceipt extends FinalizationInput {
  readonly disposition: 'persisted' | 'not-admitted';
}
function terminal(value: unknown): Terminal {
  const v = record(value, ['state', 'completedAtMs', 'resultExpiresAtMs']);
  const state = oneOf(v.state, [
    'completed',
    'delivery-unknown',
    'unavailable',
    'failed',
    'timeout',
    'cancelled',
  ]);
  if (state === 'completed' || state === 'delivery-unknown') {
    const completedAtMs = epoch(v.completedAtMs);
    const resultExpiresAtMs = epoch(v.resultExpiresAtMs);
    if (resultExpiresAtMs < completedAtMs || resultExpiresAtMs - completedAtMs > 60000)
      throw new InvalidValue();
    return Object.freeze({ state, completedAtMs, resultExpiresAtMs });
  }
  literal(v.completedAtMs, null);
  literal(v.resultExpiresAtMs, null);
  return Object.freeze({ state, completedAtMs: null, resultExpiresAtMs: null });
}
function attempt(value: unknown): RecordedAttempt {
  const v = record(value, [
    'requestId',
    'invocationId',
    'sourceDigest',
    'state',
    'completedAtMs',
    'resultExpiresAtMs',
  ]);
  const state = oneOf(v.state, [
    'active',
    'completed',
    'delivery-unknown',
    'unavailable',
    'failed',
    'timeout',
    'cancelled',
  ]);
  const pair =
    state === 'active'
      ? {
          completedAtMs: literal(v.completedAtMs, null),
          resultExpiresAtMs: literal(v.resultExpiresAtMs, null),
        }
      : terminal({ state, completedAtMs: v.completedAtMs, resultExpiresAtMs: v.resultExpiresAtMs });
  return Object.freeze({
    requestId: identifier(v.requestId),
    invocationId: invocationId(v.invocationId),
    sourceDigest: hex(v.sourceDigest, 64),
    state,
    completedAtMs: pair.completedAtMs,
    resultExpiresAtMs: pair.resultExpiresAtMs,
  });
}
export function reconstructSessionRead(value: unknown): Validation<SessionRead> {
  try {
    const v = record(value, ['consent', 'attempt']);
    return valid(
      Object.freeze({
        consent: consent(v.consent),
        attempt: v.attempt === null ? null : attempt(v.attempt),
      }),
    );
  } catch {
    return invalid('local_io', 'consent');
  }
}
export function reconstructAdmissionInput(value: unknown): Validation<AdmissionInput> {
  try {
    const v = record(value, [
      'sessionId',
      'requestId',
      'invocationId',
      'scopeId',
      'sourceDigest',
      'repoBinding',
      'repo',
      'expectedGeneration',
      'checkSetId',
      'policyVersion',
      'requestedModel',
    ]);
    const repo = reconstructRepoObservation(v.repo);
    if (!repo.ok) throw new InvalidValue();
    return valid(
      Object.freeze({
        sessionId: hex(v.sessionId, 32),
        requestId: identifier(v.requestId),
        invocationId: invocationId(v.invocationId),
        scopeId: identifier(v.scopeId),
        sourceDigest: hex(v.sourceDigest, 64),
        repoBinding: hex(v.repoBinding, 64),
        repo: repo.value,
        expectedGeneration: numeric(v.expectedGeneration, undefined, true),
        checkSetId: literal(v.checkSetId, CHECK_SET_ID),
        policyVersion: literal(v.policyVersion, EXECUTION_POLICY_VERSION),
        requestedModel: literal(v.requestedModel, REQUESTED_MODEL),
      }),
    );
  } catch {
    return invalid('internal_failure', 'internal');
  }
}
export function reconstructReservation(value: unknown): Validation<Reservation> {
  try {
    const v = record(value, ['admission', 'consent']);
    const a = reconstructAdmissionInput(v.admission);
    if (!a.ok) throw new InvalidValue();
    return valid(Object.freeze({ admission: a.value, consent: consent(v.consent) }));
  } catch {
    return invalid('local_io', 'consent');
  }
}
export function reconstructFinalizationInput(value: unknown): Validation<FinalizationInput> {
  try {
    const v = record(value, ['sessionId', 'requestId', 'invocationId', 'sourceDigest', 'terminal']);
    return valid(
      Object.freeze({
        sessionId: hex(v.sessionId, 32),
        requestId: identifier(v.requestId),
        invocationId: invocationId(v.invocationId),
        sourceDigest: hex(v.sourceDigest, 64),
        terminal: terminal(v.terminal),
      }),
    );
  } catch {
    return invalid('internal_failure', 'internal');
  }
}
export function reconstructFinalizationReceipt(value: unknown): Validation<FinalizationReceipt> {
  try {
    const v = record(value, [
      'sessionId',
      'requestId',
      'invocationId',
      'sourceDigest',
      'terminal',
      'disposition',
    ]);
    const input = reconstructFinalizationInput({
      sessionId: v.sessionId,
      requestId: v.requestId,
      invocationId: v.invocationId,
      sourceDigest: v.sourceDigest,
      terminal: v.terminal,
    });
    if (!input.ok) throw new InvalidValue();
    return valid(
      Object.freeze({
        ...input.value,
        disposition: oneOf(v.disposition, ['persisted', 'not-admitted']),
      }),
    );
  } catch {
    return invalid('local_io', 'consent');
  }
}
