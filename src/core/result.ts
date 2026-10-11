import type { Brief, Context } from './brief.js';
import type { CompiledCheck, CompiledPlan, Question } from './checks.js';
import { CHECK_SET_ID, EXECUTION_POLICY_VERSION, REQUESTED_MODEL } from './checks.js';
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
  refs,
  iso,
} from './value.js';

const messages = {
  invalid_input: 'Input does not satisfy the v0 contract.',
  check_budget_exceeded: 'The complete mandatory check set exceeds the v0 limit.',
  consent_missing: 'No scoped session consent is available.',
  consent_revoked: 'Scoped session consent has been revoked.',
  consent_expired: 'Scoped session consent has expired.',
  scope_mismatch: 'The request does not match the scoped session.',
  session_busy: 'The session already has an active reservation.',
  session_call_limit: 'The scoped session call limit is exhausted.',
  request_already_admitted: 'This request identifier has already been admitted.',
  missing_key: 'A TypeSafe API key is not configured.',
  configuration_conflict: 'Provider configuration conflicts with the v0 policy.',
  provider_http: 'The provider rejected or could not serve the request.',
  provider_connection: 'The provider transport did not complete successfully.',
  provider_response_contract: 'The provider response does not satisfy the expected contract.',
  response_too_large: 'The provider response exceeds the v0 byte limit.',
  redirect_refused: 'Authenticated provider redirects are not allowed.',
  operation_deadline: 'Consultation did not complete before its deadline.',
  source_mismatch: 'The result does not match the current supplied snapshot.',
  result_expired: 'The result has expired.',
  clock_inconsistent: 'Stored and current timing values are detectably inconsistent.',
  operation_cancelled: 'The operation was cancelled locally.',
  local_io: 'A local input, output or state operation failed.',
  secure_storage_unavailable: 'Private local session storage could not be established.',
  output_too_large: 'The complete output exceeds the v0 byte limit.',
  internal_failure: 'An internal contract or invariant failed.',
} as const;
export type ErrorCode = keyof typeof messages;
export type ErrorStage =
  | 'arguments'
  | 'input'
  | 'compile'
  | 'consent'
  | 'configuration'
  | 'provider'
  | 'response'
  | 'freshness'
  | 'output'
  | 'internal';
export type ErrorStatus =
  'invalid' | 'unavailable' | 'provider-failure' | 'timeout' | 'stale' | 'cancelled' | 'failed';
export interface Failure {
  readonly code: ErrorCode;
  readonly message: string;
  readonly stage: ErrorStage;
  readonly status: ErrorStatus;
  readonly exitCode: 1 | 2 | 3 | 4 | 5 | 6 | 130;
}
export type Validation<T> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: Failure }>;
const stages: readonly ErrorStage[] = [
  'arguments',
  'input',
  'compile',
  'consent',
  'configuration',
  'provider',
  'response',
  'freshness',
  'output',
  'internal',
];
function classification(
  code: ErrorCode,
  stage: ErrorStage,
): readonly [ErrorStatus, Failure['exitCode']] {
  switch (code) {
    case 'invalid_input':
      if (!['arguments', 'input', 'response'].includes(stage)) throw new InvalidValue();
      return ['invalid', 2];
    case 'check_budget_exceeded':
      if (stage !== 'compile') throw new InvalidValue();
      return ['invalid', 2];
    case 'consent_missing':
    case 'consent_revoked':
    case 'consent_expired':
    case 'scope_mismatch':
    case 'session_busy':
    case 'session_call_limit':
    case 'request_already_admitted':
    case 'secure_storage_unavailable':
      if (stage !== 'consent') throw new InvalidValue();
      return code === 'secure_storage_unavailable' ? ['failed', 1] : ['unavailable', 3];
    case 'missing_key':
    case 'configuration_conflict':
      if (stage !== 'configuration') throw new InvalidValue();
      return ['unavailable', 3];
    case 'provider_http':
    case 'provider_connection':
    case 'redirect_refused':
      if (stage !== 'provider') throw new InvalidValue();
      return ['provider-failure', 4];
    case 'provider_response_contract':
    case 'response_too_large':
      if (stage !== 'response') throw new InvalidValue();
      return ['provider-failure', 4];
    case 'source_mismatch':
    case 'result_expired':
      if (stage !== 'freshness') throw new InvalidValue();
      return ['stale', 6];
    case 'clock_inconsistent':
      if (stage !== 'freshness' && stage !== 'internal') throw new InvalidValue();
      return stage === 'freshness' ? ['stale', 6] : ['failed', 1];
    case 'operation_cancelled':
      return ['cancelled', 130];
    case 'operation_deadline':
      return ['timeout', 5];
    case 'output_too_large':
      if (stage !== 'output') throw new InvalidValue();
      return ['failed', 1];
    case 'internal_failure':
      if (stage !== 'internal') throw new InvalidValue();
      return ['failed', 1];
    case 'local_io':
      return ['failed', 1];
  }
}
export function failure(code: ErrorCode, stage: ErrorStage): Failure {
  if (!Object.hasOwn(messages, code) || !stages.includes(stage)) throw new InvalidValue();
  const [status, exitCode] = classification(code, stage);
  return Object.freeze({ code, message: messages[code], stage, status, exitCode });
}
export function valid<T>(value: T): Validation<T> {
  return Object.freeze({ ok: true, value });
}
export function invalid<T>(code: ErrorCode, stage: ErrorStage): Validation<T> {
  return Object.freeze({ ok: false, error: failure(code, stage) });
}
function boundary<T>(build: () => T, code: ErrorCode, stage: ErrorStage): Validation<T> {
  try {
    return valid(build());
  } catch {
    return invalid(code, stage);
  }
}
export function reconstructFailure(value: unknown): Validation<Failure> {
  return boundary(
    () => {
      const v = record(value, ['code', 'message', 'stage', 'status', 'exitCode']);
      let code: ErrorCode | undefined;
      for (const candidate of Object.keys(messages)) {
        if (candidate === v.code && isErrorCode(candidate)) code = candidate;
      }
      if (!code) throw new InvalidValue();
      const f = failure(code, oneOf(v.stage, stages));
      literal(v.message, f.message);
      literal(v.status, f.status);
      literal(v.exitCode, f.exitCode);
      return f;
    },
    'internal_failure',
    'internal',
  );
}
function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(messages, value);
}
export class ClassifiedFailure extends Error {
  readonly #validatedFailure: Failure;
  readonly failure: Failure;
  constructor(value: Failure) {
    const rebuilt = reconstructFailure(value);
    const f = rebuilt.ok ? rebuilt.value : failure('internal_failure', 'internal');
    super(f.message);
    this.#validatedFailure = f;
    this.failure = f;
    Object.freeze(this);
  }
  static extract(this: void, value: unknown): Failure | null {
    return typeof value === 'object' && value !== null && #validatedFailure in value
      ? value.#validatedFailure
      : null;
  }
}
// Capture our method rather than dispatching through a caller-replaceable property.
const extractClassifiedFailure = ClassifiedFailure.extract;
/** Recognize constructor-validated payloads without reading unknown exception properties. */
export function classifiedFailure(value: unknown): Failure | null {
  return extractClassifiedFailure(value);
}
export type Usage = Readonly<{ inputTokens: number; outputTokens: number }>;
export type EvaluationMetadata = Readonly<{
  origin: 'test-fixture' | 'provider-http';
  attempts: 0 | 1;
  requestId: string | null;
  httpStatus: number | null;
}>;
export type Answer =
  | Readonly<{ type: 'noul'; noul: number }>
  | Readonly<{
      type: 'score';
      score: number;
      legend: Readonly<{ '0': string; '1': string; '2': string }>;
      probabilities: Readonly<{ '0': number; '1': number; '2': number }>;
      confidence: number;
    }>;
export type EvaluationResult = Readonly<{
  answers: Readonly<Record<string, Answer>>;
  usage: Usage;
  metadata: EvaluationMetadata;
}>;
export type EvaluationOutcome =
  | Readonly<{ ok: true; value: EvaluationResult }>
  | Readonly<{ ok: false; error: Failure; usage: Usage | null; metadata: EvaluationMetadata }>;
export type ErrorOutcome = Readonly<{
  schemaVersion: 'hunchcraft.v0';
  kind: 'error';
  status: ErrorStatus;
  requestId: string | null;
  sessionId: string | null;
  error: Failure;
  provider: Readonly<{ usage: Usage | null; metadata: EvaluationMetadata }> | null;
}>;
function usage(value: unknown, wire = false): Usage {
  const v = record(
    value,
    wire ? ['input_tokens', 'output_tokens'] : ['inputTokens', 'outputTokens'],
  );
  return Object.freeze({
    inputTokens: numeric(v[wire ? 'input_tokens' : 'inputTokens'], undefined, true),
    outputTokens: numeric(v[wire ? 'output_tokens' : 'outputTokens'], undefined, true),
  });
}
function metadata(value: unknown, success = false): EvaluationMetadata {
  const v = record(value, ['origin', 'attempts', 'requestId', 'httpStatus']);
  const origin = oneOf(v.origin, ['test-fixture', 'provider-http']);
  const attempts = numeric(v.attempts, 1, true) === 1 ? 1 : 0;
  const requestId = v.requestId === null ? null : text(v.requestId, 128);
  if (requestId !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(requestId)) throw new InvalidValue();
  const httpStatus = v.httpStatus === null ? null : numeric(v.httpStatus, 599, true, 100);
  if (origin === 'test-fixture' && (attempts !== 0 || requestId !== null || httpStatus !== null))
    throw new InvalidValue();
  if (
    origin === 'provider-http' &&
    ((success && attempts !== 1) || (attempts === 0 && (requestId !== null || httpStatus !== null)))
  )
    throw new InvalidValue();
  if (success && httpStatus !== null && (httpStatus < 200 || httpStatus > 299))
    throw new InvalidValue();
  return Object.freeze({ origin, attempts, requestId, httpStatus });
}
export function reconstructProgress(
  value: unknown,
): Validation<Readonly<{ metadata: EvaluationMetadata; usage: Usage | null }>> {
  return boundary(
    () => {
      const v = record(value, ['metadata', 'usage']);
      return Object.freeze({
        metadata: metadata(v.metadata),
        usage: v.usage === null ? null : usage(v.usage),
      });
    },
    'internal_failure',
    'internal',
  );
}
export function progressConsistent(
  previous: Readonly<{ metadata: EvaluationMetadata; usage: Usage | null }>,
  next: Readonly<{ metadata: EvaluationMetadata; usage: Usage | null }>,
): boolean {
  return (
    previous.metadata.origin === next.metadata.origin &&
    previous.metadata.attempts <= next.metadata.attempts &&
    (previous.metadata.requestId === null ||
      previous.metadata.requestId === next.metadata.requestId) &&
    (previous.metadata.httpStatus === null ||
      previous.metadata.httpStatus === next.metadata.httpStatus) &&
    (previous.usage === null ||
      (next.usage !== null &&
        previous.usage.inputTokens === next.usage.inputTokens &&
        previous.usage.outputTokens === next.usage.outputTokens))
  );
}
function answer(value: unknown, question: Question): Answer {
  if (question.type === 'noul') {
    const v = record(value, ['type', 'noul']);
    literal(v.type, 'noul');
    return Object.freeze({ type: 'noul', noul: numeric(v.noul, 1) });
  }
  const v = record(value, ['type', 'score', 'legend', 'probabilities', 'confidence']);
  literal(v.type, 'score');
  const l = record(v.legend, ['0', '1', '2']);
  const p = record(v.probabilities, ['0', '1', '2']);
  const legend = Object.freeze({ '0': text(l['0']), '1': text(l['1']), '2': text(l['2']) });
  if (
    legend['0'] !== question.criteria[0] ||
    legend['1'] !== question.criteria[1] ||
    legend['2'] !== question.criteria[2]
  )
    throw new InvalidValue();
  const probabilities = Object.freeze({
    '0': numeric(p['0'], 1),
    '1': numeric(p['1'], 1),
    '2': numeric(p['2'], 1),
  });
  const score = numeric(v.score, 2);
  if (
    Math.abs(probabilities['0'] + probabilities['1'] + probabilities['2'] - 1) > 1e-6 ||
    Math.abs(score - probabilities['1'] - 2 * probabilities['2']) > 1e-5
  )
    throw new InvalidValue();
  return Object.freeze({
    type: 'score',
    score,
    legend,
    probabilities,
    confidence: numeric(v.confidence, 1),
  });
}
function answers(value: unknown, plan: CompiledPlan): Readonly<Record<string, Answer>> {
  const v = record(
    value,
    plan.checks.map((c) => c.wireId),
  );
  return Object.freeze(
    Object.fromEntries(plan.checks.map((c) => [c.wireId, answer(v[c.wireId], c.question)])),
  );
}
export function validateProviderResponse(
  value: unknown,
  plan: CompiledPlan,
  snapshot: EvaluationMetadata,
): Validation<EvaluationResult> {
  return boundary(
    () => {
      const v = record(value, ['model', 'answers', 'usage']);
      literal(v.model, REQUESTED_MODEL);
      return Object.freeze({
        answers: answers(v.answers, plan),
        usage: usage(v.usage, true),
        metadata: metadata(snapshot, true),
      });
    },
    'provider_response_contract',
    'response',
  );
}
/** M2 can retain independently valid usage without retaining an invalid response. */
export function validateProviderUsage(value: unknown): Validation<Usage> {
  return boundary(() => usage(value, true), 'provider_response_contract', 'response');
}
export function reconstructEvaluationOutcome(
  value: unknown,
  plan: CompiledPlan,
  origin: EvaluationMetadata['origin'],
): Validation<EvaluationOutcome> {
  return boundary(
    () => {
      // Inspect the discriminant as a data property without executing unknown code.
      const d = Object.getOwnPropertyDescriptor(value, 'ok');
      if (!d || !Object.hasOwn(d, 'value')) throw new InvalidValue();
      if (d.value === true) {
        const v = record(value, ['ok', 'value']);
        const r = record(v.value, ['answers', 'usage', 'metadata']);
        const m = metadata(r.metadata, true);
        literal(m.origin, origin);
        return Object.freeze({
          ok: true,
          value: Object.freeze({
            answers: answers(r.answers, plan),
            usage: usage(r.usage),
            metadata: m,
          }),
        });
      }
      const v = record(value, ['ok', 'error', 'usage', 'metadata']);
      literal(v.ok, false);
      const f = reconstructFailure(v.error);
      if (!f.ok) throw new InvalidValue();
      const m = metadata(v.metadata);
      literal(m.origin, origin);
      return Object.freeze({
        ok: false,
        error: f.value,
        usage: v.usage === null ? null : usage(v.usage),
        metadata: m,
      });
    },
    'internal_failure',
    'internal',
  );
}

export type Feedback = Readonly<{
  label: string;
  direction:
    | 'yes-indicates-gap'
    | 'yes-indicates-contradiction'
    | 'yes-indicates-mismatch'
    | 'higher-is-more-plausible'
    | 'higher-is-more-justified'
    | 'condition-yes';
  reviewPrompt: string;
}>;
const gapPrompt =
  'Compare the preserved request and this proposal for missing outcomes; revise or clarify the implicated scope if warranted.';
const feedbackEntries: readonly (readonly [string, string, Feedback['direction'], string])[] = [
  ['request.gap', 'Requested-outcome gap', 'yes-indicates-gap', gapPrompt],
  [
    'domain.gap',
    'Implicit-obligation gap',
    'yes-indicates-gap',
    'Check necessary correctness/lifecycle obligations for this task; do not add unrelated product scope or assume domain completeness.',
  ],
  ['requirement.gap', 'Requirement mechanism gap', 'yes-indicates-gap', gapPrompt],
  [
    'component.contradiction',
    'Supplied-source contradiction',
    'yes-indicates-contradiction',
    "Compare this component's factual claims with supplied excerpts; resolve an actual conflict before treating the mechanism as established.",
  ],
  [
    'component.evidence-gap',
    'Missing implementation evidence',
    'yes-indicates-gap',
    'Identify the needed contract/source read for this component; missing evidence does not by itself refute the proposed mechanism.',
  ],
  [
    'component.plausibility',
    'Planning-stage plausibility',
    'higher-is-more-plausible',
    'Clarify how this component performs its responsibility and label unresolved operating premises; do not confuse planning fit with proof.',
  ],
  [
    'component.justification',
    'Component justification',
    'higher-is-more-justified',
    'Check direct or necessary-support contribution; do not remove tests/cleanup merely because their contribution is indirect.',
  ],
  [
    'relationship.mismatch',
    'Relationship mismatch',
    'yes-indicates-mismatch',
    "Check the bound components' data/control contract together.",
  ],
  [
    'local.condition',
    'Supplied local condition',
    'condition-yes',
    "Assess this supplied condition and its evidence without treating the question's wording as an established answer.",
  ],
];
const feedbackRegistry: Readonly<Record<string, Feedback>> = Object.freeze(
  Object.fromEntries(
    feedbackEntries.map(([suffix, label, direction, reviewPrompt]) => [
      `${CHECK_SET_ID}/${suffix}`,
      Object.freeze({ label, direction, reviewPrompt }),
    ]),
  ),
);
export function feedbackFor(templateId: string): Validation<Feedback> {
  const f = Object.hasOwn(feedbackRegistry, templateId) ? feedbackRegistry[templateId] : undefined;
  return f ? valid(f) : invalid('invalid_input', 'input');
}
export type JudgmentCheck = CompiledCheck & Readonly<{ answer: Answer; feedback: Feedback }>;
export type SourceIdentity = Readonly<{
  version: 'hunchcraft.identity.v0';
  digest: string;
  repoBinding: string;
}>;
export type Freshness = Readonly<{
  status: 'requires-current-brief-check';
  completedAt: string;
  expiresAt: string;
}>;
export type Timing = Readonly<{
  inputMs: number;
  compileMs: number;
  admissionMs: number;
  providerMs: number;
  validationMs: number;
  totalMs: number;
}>;
export type Coverage = Readonly<{
  basis: 'supplied-material-only';
  baselineChecks: number;
  localChecks: number;
  requirementExtraction: 'caller-supplied-nonexhaustive';
  evidenceAuthentication: 'caller-supplied';
}>;
export interface InternalJudgment {
  readonly schemaVersion: 'hunchcraft.v0';
  readonly kind: 'judgment';
  readonly status: 'completed';
  readonly requestId: string;
  readonly sessionId: string;
  readonly scopeId: string;
  readonly context: Context;
  readonly sourceIdentity: SourceIdentity;
  readonly checkSetId: typeof CHECK_SET_ID;
  readonly policyVersion: typeof EXECUTION_POLICY_VERSION;
  readonly freshness: Freshness;
  readonly coverage: Coverage;
  readonly provider: Readonly<{
    name: 'typesafe';
    sdkVersion: '0.6.0';
    requestedModel: typeof REQUESTED_MODEL;
    returnedModel: typeof REQUESTED_MODEL;
    metadata: EvaluationMetadata;
    usage: Usage;
    costEstimate: null;
  }>;
  readonly timing: Timing;
  readonly checks: readonly JudgmentCheck[];
}
export type CompletedJudgmentEnvelope = Omit<InternalJudgment, 'provider'> &
  Readonly<{
    provider: Readonly<{
      name: 'typesafe';
      sdkVersion: '0.6.0';
      requestedModel: typeof REQUESTED_MODEL;
      returnedModel: typeof REQUESTED_MODEL;
      requestId: string | null;
      attempts: 1;
      usage: Usage;
      costEstimate: null;
    }>;
  }>;
export interface JudgmentConstruction {
  readonly input: Brief;
  readonly plan: CompiledPlan;
  readonly evaluation: EvaluationResult;
  readonly sessionId: string;
  readonly sourceIdentity: SourceIdentity;
  readonly freshness: Freshness;
  readonly timing: Timing;
}
function question(value: unknown): Question {
  const v = record(value, ['type', 'instructions', 'criteria']);
  const i = record(v.instructions, ['task', 'subjectPath', 'contextPaths']);
  const instructions = Object.freeze({
    task: text(i.task),
    subjectPath: text(i.subjectPath, 128),
    contextPaths: list(i.contextPaths, 40, (x) => text(x, 128)),
  });
  if (new Set(instructions.contextPaths).size !== instructions.contextPaths.length)
    throw new InvalidValue();
  const path =
    /^(?:originalRequest|clarifications|standards|requirements|components|relationships|assumptions|evidence|localQuestions)(?:\[[0-7]\])?$/;
  if (!path.test(instructions.subjectPath) || instructions.contextPaths.some((p) => !path.test(p)))
    throw new InvalidValue();
  if (v.type === 'noul') {
    const c = record(v.criteria, ['true', 'false']);
    return Object.freeze({
      type: 'noul',
      instructions,
      criteria: Object.freeze({ true: text(c.true), false: text(c.false) }),
    });
  }
  literal(v.type, 'score');
  return Object.freeze({ type: 'score', instructions, criteria: list(v.criteria, 3, text, 3) });
}
function check(value: unknown, index: number): JudgmentCheck {
  const v = record(value, [
    'id',
    'wireId',
    'templateId',
    'subject',
    'componentRefs',
    'requirementRefs',
    'evidenceRefs',
    'assumptionRefs',
    'question',
    'answer',
    'feedback',
  ]);
  const q = question(v.question);
  const s = record(v.subject, ['kind', 'id']);
  const subject = Object.freeze({
    kind: oneOf(s.kind, ['proposal', 'requirement', 'component', 'relationship', 'local-question']),
    id: identifier(s.id),
  });
  const templateId = text(v.templateId, 128);
  const f = feedbackFor(templateId);
  if (!f.ok) throw new InvalidValue();
  const feedback = record(v.feedback, ['label', 'direction', 'reviewPrompt']);
  literal(feedback.label, f.value.label);
  literal(feedback.direction, f.value.direction);
  literal(feedback.reviewPrompt, f.value.reviewPrompt);
  const id = text(v.id, 128);
  const prefix = `${CHECK_SET_ID}/`;
  const suffix = templateId.slice(prefix.length);
  const expected =
    suffix === 'request.gap'
      ? 'g.request-gap'
      : suffix === 'domain.gap'
        ? 'g.domain-gap'
        : suffix === 'requirement.gap'
          ? `r.${subject.id}.gap`
          : suffix === 'relationship.mismatch'
            ? `l.${subject.id}.mismatch`
            : suffix === 'local.condition'
              ? `q.${subject.id}.condition`
              : `c.${subject.id}.${suffix.slice('component.'.length)}`;
  if (
    id !== expected ||
    q.type !==
      (suffix === 'component.plausibility' || suffix === 'component.justification'
        ? 'score'
        : 'noul')
  )
    throw new InvalidValue();
  const expectedKind =
    suffix === 'request.gap' || suffix === 'domain.gap'
      ? 'proposal'
      : suffix === 'requirement.gap'
        ? 'requirement'
        : suffix === 'relationship.mismatch'
          ? 'relationship'
          : suffix === 'local.condition'
            ? 'local-question'
            : 'component';
  if (subject.kind !== expectedKind || (expectedKind === 'proposal' && subject.id !== 'proposal'))
    throw new InvalidValue();
  return Object.freeze({
    id,
    wireId: literal(v.wireId, `q${String(index + 1).padStart(3, '0')}`),
    templateId,
    subject,
    componentRefs: refs(v.componentRefs, 3),
    requirementRefs: refs(v.requirementRefs, 8),
    evidenceRefs: refs(v.evidenceRefs, 8),
    assumptionRefs: refs(v.assumptionRefs, 8),
    question: q,
    answer: answer(v.answer, q),
    feedback: f.value,
  });
}
const rootFields = [
  'schemaVersion',
  'kind',
  'status',
  'requestId',
  'sessionId',
  'scopeId',
  'context',
  'sourceIdentity',
  'checkSetId',
  'policyVersion',
  'freshness',
  'coverage',
  'provider',
  'timing',
  'checks',
];
function judgment(value: unknown): InternalJudgment {
  const v = record(value, rootFields);
  const c = record(v.context, ['goalId', 'proposalRevision']);
  const s = record(v.sourceIdentity, ['version', 'digest', 'repoBinding']);
  const f = record(v.freshness, ['status', 'completedAt', 'expiresAt']);
  const completedAt = iso(f.completedAt);
  const expiresAt = iso(f.expiresAt);
  if (
    Date.parse(expiresAt) < Date.parse(completedAt) ||
    Date.parse(expiresAt) - Date.parse(completedAt) > 60000
  )
    throw new InvalidValue();
  const p = record(v.provider, [
    'name',
    'sdkVersion',
    'requestedModel',
    'returnedModel',
    'metadata',
    'usage',
    'costEstimate',
  ]);
  const t = record(v.timing, [
    'inputMs',
    'compileMs',
    'admissionMs',
    'providerMs',
    'validationMs',
    'totalMs',
  ]);
  let index = 0;
  const checks = list(v.checks, 16, (x) => check(x, index++), 6);
  if (
    new Set(checks.map((x) => x.id)).size !== checks.length ||
    checks[0]?.id !== 'g.request-gap' ||
    checks[1]?.id !== 'g.domain-gap'
  )
    throw new InvalidValue();
  if (
    checks.some((x) => utf8Bytes(JSON.stringify(x.question)) > 4096) ||
    utf8Bytes(JSON.stringify(Object.fromEntries(checks.map((x) => [x.wireId, x.question])))) > 16384
  )
    throw new InvalidValue();
  const cov = record(v.coverage, [
    'basis',
    'baselineChecks',
    'localChecks',
    'requirementExtraction',
    'evidenceAuthentication',
  ]);
  const localChecks = checks.filter((x) => x.subject.kind === 'local-question').length;
  // Canonical family order and complete four-check component groups are structural,
  // even before comparison against a particular current brief.
  let cursor = 2;
  const requirements: string[] = [];
  while (checks[cursor]?.subject.kind === 'requirement') {
    const c = checks[cursor];
    if (!c || requirements.includes(c.subject.id) || requirements.length === 8)
      throw new InvalidValue();
    requirements.push(c.subject.id);
    cursor++;
  }
  const components: string[] = [];
  while (checks[cursor]?.subject.kind === 'component') {
    const c = checks[cursor];
    if (!c || components.includes(c.subject.id) || components.length === 3)
      throw new InvalidValue();
    components.push(c.subject.id);
    for (const suffix of ['contradiction', 'evidence-gap', 'plausibility', 'justification']) {
      const grouped = checks[cursor++];
      if (
        !grouped ||
        grouped.subject.id !== c.subject.id ||
        grouped.templateId !== `${CHECK_SET_ID}/component.${suffix}`
      )
        throw new InvalidValue();
    }
  }
  if (components.length === 0) throw new InvalidValue();
  const relationships: string[] = [];
  while (checks[cursor]?.subject.kind === 'relationship') {
    const c = checks[cursor++];
    if (!c || relationships.includes(c.subject.id) || relationships.length === 4)
      throw new InvalidValue();
    relationships.push(c.subject.id);
  }
  const locals: string[] = [];
  while (checks[cursor]?.subject.kind === 'local-question') {
    const c = checks[cursor++];
    if (!c || locals.includes(c.subject.id) || locals.length === 2) throw new InvalidValue();
    locals.push(c.subject.id);
  }
  if (cursor !== checks.length) throw new InvalidValue();
  for (const c of checks) {
    if (
      c.componentRefs.some((id) => !components.includes(id)) ||
      c.requirementRefs.some((id) => !requirements.includes(id)) ||
      c.evidenceRefs.length === 0
    )
      throw new InvalidValue();
    const expectedPath =
      c.subject.kind === 'proposal'
        ? 'components'
        : c.subject.kind === 'requirement'
          ? `requirements[${requirements.indexOf(c.subject.id)}]`
          : c.subject.kind === 'component'
            ? `components[${components.indexOf(c.subject.id)}]`
            : c.subject.kind === 'relationship'
              ? `relationships[${relationships.indexOf(c.subject.id)}]`
              : `localQuestions[${locals.indexOf(c.subject.id)}]`;
    if (c.question.instructions.subjectPath !== expectedPath) throw new InvalidValue();
    if (
      c.subject.kind === 'component' &&
      (c.componentRefs.length !== 1 || c.componentRefs[0] !== c.subject.id)
    )
      throw new InvalidValue();
    if (c.subject.kind === 'relationship' && c.componentRefs.length !== 2) throw new InvalidValue();
    if (
      c.subject.kind === 'local-question' &&
      c.componentRefs.length + c.requirementRefs.length === 0
    )
      throw new InvalidValue();
    if (JSON.stringify(c.evidenceRefs) !== JSON.stringify(checks[0]?.evidenceRefs))
      throw new InvalidValue();
  }
  literal(numeric(cov.localChecks, 2, true), localChecks);
  literal(numeric(cov.baselineChecks, 16, true), checks.length - localChecks);
  const timing = Object.freeze({
    inputMs: numeric(t.inputMs, 15000),
    compileMs: numeric(t.compileMs, 15000),
    admissionMs: numeric(t.admissionMs, 15000),
    providerMs: numeric(t.providerMs, 15000),
    validationMs: numeric(t.validationMs, 15000),
    totalMs: numeric(t.totalMs, 15000),
  });
  if (Object.values(timing).some((ms) => ms > timing.totalMs)) throw new InvalidValue();
  const result: InternalJudgment = Object.freeze({
    schemaVersion: literal(v.schemaVersion, 'hunchcraft.v0'),
    kind: literal(v.kind, 'judgment'),
    status: literal(v.status, 'completed'),
    requestId: identifier(v.requestId),
    sessionId: hex(v.sessionId, 32),
    scopeId: identifier(v.scopeId),
    context: Object.freeze({
      goalId: identifier(c.goalId),
      proposalRevision: identifier(c.proposalRevision),
    }),
    sourceIdentity: Object.freeze({
      version: literal(s.version, 'hunchcraft.identity.v0'),
      digest: hex(s.digest, 64),
      repoBinding: hex(s.repoBinding, 64),
    }),
    checkSetId: literal(v.checkSetId, CHECK_SET_ID),
    policyVersion: literal(v.policyVersion, EXECUTION_POLICY_VERSION),
    freshness: Object.freeze({
      status: literal(f.status, 'requires-current-brief-check'),
      completedAt,
      expiresAt,
    }),
    coverage: Object.freeze({
      basis: literal(cov.basis, 'supplied-material-only'),
      baselineChecks: checks.length - localChecks,
      localChecks,
      requirementExtraction: literal(cov.requirementExtraction, 'caller-supplied-nonexhaustive'),
      evidenceAuthentication: literal(cov.evidenceAuthentication, 'caller-supplied'),
    }),
    provider: Object.freeze({
      name: literal(p.name, 'typesafe'),
      sdkVersion: literal(p.sdkVersion, '0.6.0'),
      requestedModel: literal(p.requestedModel, REQUESTED_MODEL),
      returnedModel: literal(p.returnedModel, REQUESTED_MODEL),
      metadata: metadata(p.metadata, true),
      usage: usage(p.usage),
      costEstimate: literal(p.costEstimate, null),
    }),
    timing,
    checks,
  });
  if (utf8Bytes(JSON.stringify(result)) > 256 * 1024) throw new InvalidValue();
  return result;
}
export function reconstructInternalJudgment(value: unknown): Validation<InternalJudgment> {
  return boundary(() => judgment(value), 'invalid_input', 'input');
}
export function createJudgment(input: JudgmentConstruction): Validation<InternalJudgment> {
  return boundary(
    () => {
      const e = reconstructEvaluationOutcome(
        { ok: true, value: input.evaluation },
        input.plan,
        input.evaluation.metadata.origin,
      );
      if (!e.ok || !e.value.ok) throw new InvalidValue();
      const checks = input.plan.checks.map((c) => {
        const f = feedbackFor(c.templateId);
        const a = e.value.ok ? e.value.value.answers[c.wireId] : undefined;
        if (!f.ok || !a) throw new InvalidValue();
        return { ...c, answer: a, feedback: f.value };
      });
      const localChecks = input.input.brief.localQuestions.length;
      return judgment({
        schemaVersion: 'hunchcraft.v0',
        kind: 'judgment',
        status: 'completed',
        requestId: input.input.requestId,
        sessionId: input.sessionId,
        scopeId: input.input.scopeId,
        context: input.input.context,
        sourceIdentity: input.sourceIdentity,
        checkSetId: CHECK_SET_ID,
        policyVersion: EXECUTION_POLICY_VERSION,
        freshness: input.freshness,
        coverage: {
          basis: 'supplied-material-only',
          baselineChecks: checks.length - localChecks,
          localChecks,
          requirementExtraction: 'caller-supplied-nonexhaustive',
          evidenceAuthentication: 'caller-supplied',
        },
        provider: {
          name: 'typesafe',
          sdkVersion: '0.6.0',
          requestedModel: REQUESTED_MODEL,
          returnedModel: REQUESTED_MODEL,
          metadata: e.value.value.metadata,
          usage: e.value.value.usage,
          costEstimate: null,
        },
        timing: input.timing,
        checks,
      });
    },
    'internal_failure',
    'internal',
  );
}
export function validateJudgmentBinding(
  result: InternalJudgment,
  input: Brief,
  plan: CompiledPlan,
): Validation<InternalJudgment> {
  const rebuilt = reconstructInternalJudgment(result);
  if (!rebuilt.ok) return rebuilt;
  const r = rebuilt.value;
  if (
    r.requestId !== input.requestId ||
    r.scopeId !== input.scopeId ||
    JSON.stringify(r.context) !== JSON.stringify(input.context) ||
    r.checks.length !== plan.checks.length
  )
    return invalid('source_mismatch', 'freshness');
  for (let i = 0; i < r.checks.length; i++) {
    const c = r.checks[i];
    const expected = plan.checks[i];
    if (!c || !expected) return invalid('source_mismatch', 'freshness');
    const { answer: ignoredAnswer, feedback: ignoredFeedback, ...compiled } = c;
    if (JSON.stringify(compiled) !== JSON.stringify(expected))
      return invalid('source_mismatch', 'freshness');
    // Revalidation above retains answers, while association compares all compiled fields.
    void ignoredAnswer;
    void ignoredFeedback;
  }
  return rebuilt;
}
export function completedJudgmentEnvelope(
  result: InternalJudgment,
): Validation<CompletedJudgmentEnvelope> {
  return boundary(
    () => {
      const r = judgment(result);
      if (r.provider.metadata.origin !== 'provider-http') throw new InvalidValue();
      return Object.freeze({
        ...r,
        provider: Object.freeze({
          name: r.provider.name,
          sdkVersion: r.provider.sdkVersion,
          requestedModel: r.provider.requestedModel,
          returnedModel: r.provider.returnedModel,
          requestId: r.provider.metadata.requestId,
          attempts: 1,
          usage: r.provider.usage,
          costEstimate: null,
        }),
      });
    },
    'invalid_input',
    'input',
  );
}
export function parseCompletedJudgment(input: string | Uint8Array): Validation<InternalJudgment> {
  const parsed = parseStrictJson(input, {
    maxBytes: 256 * 1024,
    maxDepth: 16,
    allowNumericKeys: true,
    numbers: 'finite',
    integerKeys: ['inputTokens', 'outputTokens', 'attempts', 'baselineChecks', 'localChecks'],
  });
  if (!parsed.ok) return invalid('invalid_input', 'input');
  return boundary(
    () => {
      const v = record(parsed.value, rootFields);
      const p = record(v.provider, [
        'name',
        'sdkVersion',
        'requestedModel',
        'returnedModel',
        'requestId',
        'attempts',
        'usage',
        'costEstimate',
      ]);
      literal(p.attempts, 1);
      // v is an owned property reconstruction, not the raw caller object.
      return judgment({
        ...v,
        provider: {
          name: p.name,
          sdkVersion: p.sdkVersion,
          requestedModel: p.requestedModel,
          returnedModel: p.returnedModel,
          metadata: {
            origin: 'provider-http',
            attempts: 1,
            requestId: p.requestId,
            httpStatus: null,
          },
          usage: p.usage,
          costEstimate: p.costEstimate,
        },
      });
    },
    'invalid_input',
    'input',
  );
}
export interface PreparedDelivery {
  readonly byteLength: number;
  copyBytes(): Uint8Array;
}
class OwnedDelivery implements PreparedDelivery {
  readonly #bytes: Uint8Array;
  readonly byteLength: number;
  constructor(bytes: Uint8Array) {
    this.#bytes = Uint8Array.prototype.slice.call(bytes);
    this.byteLength = this.#bytes.byteLength;
    Object.freeze(this);
  }
  copyBytes(): Uint8Array {
    return new Uint8Array(this.#bytes);
  }
  static recognizes(value: unknown): value is OwnedDelivery {
    return typeof value === 'object' && value !== null && #bytes in value;
  }
}
Object.freeze(OwnedDelivery.prototype);
export function isPreparedDelivery(value: unknown): value is PreparedDelivery {
  return OwnedDelivery.recognizes(value);
}
export function prepareBytes(bytes: Uint8Array): Validation<PreparedDelivery> {
  return boundary(
    () => {
      if (
        !(bytes instanceof Uint8Array) ||
        Object.getPrototypeOf(bytes) !== Uint8Array.prototype ||
        bytes.byteLength === 0 ||
        bytes.byteLength > 256 * 1024 ||
        bytes[bytes.byteLength - 1] !== 10
      )
        throw new InvalidValue();
      if (
        Reflect.ownKeys(bytes).some(
          (key) => typeof key !== 'string' || !/^(?:0|[1-9]\d*)$/.test(key),
        )
      )
        throw new InvalidValue();
      const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      if (decoded.charCodeAt(0) === 0xfeff) throw new InvalidValue();
      return new OwnedDelivery(bytes);
    },
    'output_too_large',
    'output',
  );
}
