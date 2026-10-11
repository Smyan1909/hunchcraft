# M1b/M2: bounded offline implementation handoff

**Date:** 2026-10-11. **Baseline inspected:** clean `3eef99a`, implementing M1a
against planning revision `5f1af21`. The reported 98-test M1a verification is prior
milestone evidence, not a test run performed for this note.

**Assignment:** implement both M1b and M2 efficiently offline; defer M3 actual CLI,
secure storage and credential wiring. This handoff is design, not implementation.
The latest user instruction authorizes the two source slices and M2 dependency
operations; no further permission to begin those slices is needed. No paid/live
Jev calls, private transmission, host launch, publication or evaluation run follows.

Read the [canonical specification](../system-design.md), especially sections 4,
5, 8, 9 and 15, and the [implementation plan](../implementation-plan.md). This note
selects internal implementation contracts where those documents leave details open;
it does **not** replace the v0 protocol. M1a grammar, templates, order, bounds and
identity bytes remain unchanged. Reviewer acceptance freezes the internal contracts
below for the two implementers; the orchestrator owns that integration gate.

Retain the canonical bounds: input **48 KiB**, shared state **32 KiB**, **16 checks**,
wire questions **16 KiB** combined/**4 KiB** each, operation **15,000 ms**, attempt
at most **10,000 ms** and remaining time, cleanup **1,000 ms**, retries **0**.

## 1. Recommended vertical slice and evidence

Carry one small component proposal through compile, scope check, atomic admission,
one guarded evaluation, complete answer validation, static feedback, output
preparation, completion commit and offline verification. The observable use is a
source-bound advisory signal before implementation: uncovered outcomes, supplied
contradictions, missing support and planning fit stay separate. Noul represents a
condition; Score represents a degree on the existing three descriptive levels.
Neither generates code, explanations, permission or a correctness certificate.

Context ranking, candidate selection and progress/speculative checks remain credible
later slices. They need different candidates/state and evaluation; do not introduce
Choice or a background loop to complete this assignment. Retaining all mandatory
checks, including the two global checks with empty extracted requirements, is the
smallest testable path through the already reviewed artifact.

### Evidence categories

- **Observed repository:** four pure modules, `Brief`, `CompiledPlan`,
  `parseStrictJson`, `parseBrief`, `compileChecks`, `identityRepresentation` and
  `identityBytes`; no functional root exports, runtime SDK dependency or CLI.
  All six layer READMEs, contributor instructions and ADRs 0001–0003 were read.
- **Live documentation refreshed read-only on 2026-10-11:** HTTP
  `POST https://api.typesafe.ai/v1/systemone`, response model/answers/usage,
  Noul/Score semantics, SDK explicit options and per-attempt cancellation/timeout.
  SDK docs link version **0.6.0**; model docs list **`jev-1.13.0`**. See sources below.
- **Not observed:** installed SDK compatibility, authenticated service behavior,
  secure storage, any host runtime, semantic quality, spend or savings. The M2
  implementer must inspect the actual locked artifact/types before using the SDK.
- **Design choices here:** explicit function injection, one invocation-owned
  lifecycle, UUID-owned pending finalization, strict domain reconstruction and an
  owned prepared-byte wrapper. These are not newly observed upstream capabilities.
- **Hypothesis:** early bounded advice reduces rework enough to offset preparation,
  retrieval, consultation and consumption cost. The evaluator's separate case audit
  owns semantic expectations; offline tests below establish mechanics only.

No host API is introduced or selected. A later unchanged host must await/drain an
ordinary foreground process result and check close/exit plus freshness. Source
research is not proof of host observation, delivery or model uptake.

## 2. Exact future file ownership and implementation order

These are handoff paths for future writers, not files created by this assignment.
Do not introduce barrels or package-root exports.

1. **M1b core:** `src/core/result.ts`, `src/core/consent.ts`: domain/errors,
   answer/result reconstruction, static feedback, scope/session pure rules.
2. **M1b ports:** `src/ports/decision-provider.ts`, `src/ports/session-consent.ts`,
   `src/ports/clock.ts`: SDK-free contracts below.
3. **M1b application:** `src/application/operation.ts`, `src/application/consult.ts`,
   `src/application/verify.ts`: owned deadlines/races, consultation and applicability.
4. **M2 provider:** `src/providers/typesafe/provider.ts`,
   `src/providers/typesafe/transport.ts`, `src/providers/typesafe/configuration.ts`:
   SDK translation, guarded/capped HTTP and configuration validation.

**M1b tests:** `tests/core/result.test.ts`, `tests/core/consent.test.ts`,
`tests/application/consult.test.ts`, `tests/application/verify.test.ts`,
`tests/helpers/consultation-fakes.ts`. Own controlled clocks/deferreds, test-only
consent/provider/preparation and independent assertions.

**M2 tests:** `tests/providers/typesafe/provider.test.ts`,
`tests/providers/typesafe/transport.test.ts`,
`tests/providers/typesafe/configuration.test.ts`,
`tests/contracts/typesafe-import.test.ts`. Own real locked SDK through fake fetch,
inert imports and boundary failures.

**Serialized tooling owner, M2:** `package.json`, `package-lock.json`: exact
`@typesafe-ai/sdk@0.6.0` pin after artifact audit; no TS upgrade, bin or export changes.

Nearby layer READMEs may be assigned to the source owner for implemented-status
updates. Do not edit M1a source/goldens or shared test helpers without reallocating
ownership. A small helper stays local unless two implemented users need it; do not
build a schema, scheduler, provider or dependency-injection framework.

Freeze steps 1–2 before parallel application/M2 writing. M2 artifact audit and
provider-local configuration/transport work can then proceed while M1b tests finish;
end-to-end M2/application tests use the reviewed M1b contracts. Secure local state
does not precede isolated fake HTTP, but **must** precede production wiring in M3.

## 3. Core contracts: closed values, not trusted TypeScript assertions

All interfaces below have readonly fields and owned, recursively frozen ordinary
objects/arrays. Strings are preserved. Examples are signatures/type proposals, not
production implementations. Import existing `Brief`, `Context`, `BriefState`,
`CompiledPlan`, `CompiledCheck` and `Question` by type from M1a; do not duplicate them.
Implement result and consent without a cycle: `consent.ts` may import domain/error/
time values from `result.ts`; `result.ts` must not import consent. Pass epoch values
explicitly to result validation rather than importing session policy into it.

### Errors in `core/result.ts`

Define `ErrorCode`, `ErrorStage`, `ErrorStatus`, `Failure`, `ErrorOutcome`, and
`Validation<T>` here. `Validation<T>` is `{ok:true,value:T} | {ok:false,error:Failure}`.
`Failure` is exactly `{code,message,stage,status,exitCode}` internally; external
`error` remains `{code,message,stage}`. Message/code/status/exit associations are
closed, using the section 15 literal catalog and section 4 exits. No caller-supplied
message or raw SDK object is retained. `ErrorOutcome` is
`{schemaVersion:"hunchcraft.v0",kind:"error",status:ErrorStatus,requestId:string|null,
sessionId:string|null,error:Failure,provider:{usage:Usage|null,metadata:EvaluationMetadata}|null}`.
IDs are nullable until validated; it has no answers, checks, feedback, probabilities
or approval field. Renderer projects Failure into the three public error fields.

Recommended functions:

```ts
failure(code: ErrorCode, stage: ErrorStage): Failure;
reconstructFailure(value: unknown): Validation<Failure>;
```

Use one `ClassifiedFailure extends Error` here with a readonly validated `failure`
property and fixed message, for the required rejecting beforeDispatch callback.
Recognize it locally by class identity, never arbitrary thrown object's code/message.
No SDK aliases or raw causes. Normal port failures still use the value union.

Preserve `CoreFailure` and existing M1a APIs. Application maps those two codes into
the new catalog rather than widening M1a types. Catalog exits: input/compile 2;
consent/configuration 3; provider/response 4; deadline 5; applicability 6; cancellation
130; local/invariant/output 1. `clock_inconsistent` is exit 6 in verify and exit 1
for an invalid consultation clock; pass stage `freshness` or `internal` accordingly.
`local_io` during normal execution is exit 1. A cleanup failure is separately
reported without replacing an already latched timeout/cancellation/provider cause.
Statuses are invalid for input/compile, unavailable for consent/configuration,
provider-failure for provider/response, timeout for deadline, stale for applicability,
cancelled for cancellation, failed for local/invariant/output; clock inconsistency
uses stale/freshness or failed/internal. Stage must be a catalog-permitted literal.

### Evaluation/result values in `core/result.ts`

```ts
type Usage = Readonly<{ inputTokens: number; outputTokens: number }>;
type EvaluationMetadata = Readonly<{
  origin: 'test-fixture' | 'provider-http';
  attempts: 0 | 1;
  requestId: string | null;
  httpStatus: number | null;
}>;
type EvaluationResult = Readonly<{
  answers: Readonly<Record<string, Answer>>;
  usage: Usage;
  metadata: EvaluationMetadata;
}>;
type EvaluationOutcome =
  | Readonly<{ ok: true; value: EvaluationResult }>
  | Readonly<{
      ok: false;
      error: Failure;
      usage: Usage | null;
      metadata: EvaluationMetadata;
    }>;
```

`Answer` is the closed Noul/Score union in section 8.4, with literal Score keys
`"0"`, `"1"`, `"2"` in `legend` and `probabilities`. Do not use an arbitrary
number-keyed map, add Noul confidence or derive an approval percentage. Metadata
property order is the section 15 order above. Successful usage is mandatory;
independently validated usage can survive rejection of another response field.
Unknown usage is null, **never** fabricated zero. Fixture success usage is explicitly
synthetic; `origin:test-fixture`, attempts 0, null request ID/status are required.
Provider success requires attempts 1; failure permits 0 or 1. An HTTP-origin reply
through fake fetch is transport-boundary evidence, not a real network/billing claim.

Select request-ID grammar `[A-Za-z0-9_-]{1,128}`; invalid header values become null
without echo, not trimmed/substituted strings. HTTP status is null or integer
100–599; a successful transport snapshot, when present, must be 200–299. All numeric
values are finite, nonnegative where applicable, and never negative zero. Counts
and token usage are safe integers. These metadata bounds make section 14's bounded
ASCII requirement concrete; they are not a server ID format guarantee.

Define `Feedback` from the exact section 7.3/9.4 registry and `JudgmentCheck` as
`CompiledCheck` plus `answer,feedback` in that order. `InternalJudgment` has the
section 9.2 fields in declared order, with this **internal-only** provider shape:

```text
{name:"typesafe",sdkVersion:"0.6.0",requestedModel:"jev-1.13.0",
 returnedModel:"jev-1.13.0",metadata:EvaluationMetadata,usage:Usage,costEstimate:null}
```

It retains common schemaVersion/kind/status, request/session/scope/context, identity,
coverage, freshness, timing and checks. Status `completed` names a ready/committed
judgment, not observed stdout success. Metadata retains provenance rather than
making fixture results masquerade as section 9.2 production envelopes.

Recommended cohesive functions:

```ts
validateProviderResponse(value: unknown, plan: CompiledPlan,
  metadata: EvaluationMetadata): Validation<EvaluationResult>;
reconstructEvaluationOutcome(value: unknown, plan: CompiledPlan,
  origin: EvaluationMetadata['origin']): Validation<EvaluationOutcome>;
feedbackFor(templateId: string): Validation<Feedback>;
createJudgment(input: JudgmentConstruction): Validation<InternalJudgment>;
reconstructInternalJudgment(value: unknown): Validation<InternalJudgment>;
parseCompletedJudgment(input: string | Uint8Array): Validation<InternalJudgment>;
completedJudgmentEnvelope(result: InternalJudgment): Validation<CompletedJudgmentEnvelope>;
validateJudgmentBinding(result: InternalJudgment, input: Brief,
  plan: CompiledPlan): Validation<InternalJudgment>;
prepareBytes(bytes: Uint8Array): Validation<PreparedDelivery>;
```

`JudgmentConstruction` explicitly contains `input:Brief, plan:CompiledPlan,
evaluation:EvaluationResult, sessionId:string, sourceIdentity:SourceIdentity,
freshness:Freshness, timing:Timing`; coverage and feedback are derived, never
supplied as assertions. `SourceIdentity`, `Freshness`, `Timing`, `Coverage` and
`CompletedJudgmentEnvelope` use the exact section 9.2 field names/values.

The first validator requires exact root `model,answers,usage`, exact answer IDs and
matching primitives. It validates sent legend text, sum tolerance **1e-6**, weighted
Score tolerance **1e-5**, ranges and usage. Rebuild probability keys in level order,
answers in compiled order. No normalization/rounding/clamping or partial success.
Application reconstructs even a typed port response as unknown; malformed port
outcomes become `internal_failure`, while malformed provider bodies become
`provider_response_contract`. Failure metadata is reconstructed too; hostile thrown
values become fixed internal failures with only already validated progress retained.
Validate the metadata argument too. Bounds on reconstructed internal result depth,
text/arrays/refs follow the corresponding brief/check limits; compact rebuilt JSON
must fit 256 KiB before it is accepted. No raw-object serializer runs before those
checks. This is a size check on owned data, not a fixture serialization feature.

Structural result reconstruction checks **all** root/nested fields, supported
versions/model, ID formats, 6–16 checks, distinct contiguous ordinal wire IDs,
compiled-record and question shapes, static feedback, coverage counts, timestamps,
timings, answers and provider metadata. It bounds containers/text before copying.
`validateJudgmentBinding` separately compares the complete rebuilt check/binding/
question/order/feedback against the current compilation and context. Structural
forgery and unsupported versions/models are invalid input (2); a structurally valid
but different subject/request/identity is stale (6). A changed current compilation
cannot reuse an old result. Neither check authenticates a purported result.

`parseCompletedJudgment` strictly parses **only** the closed section 9.2 production
JSON envelope, maximum **256 KiB**, depth 16; it is not a generic envelope parser.
It translates flattened provider attempts/requestId into internal metadata with
origin `provider-http` and httpStatus null (the wire does not report that status).
This labels the claimed wire origin, not an authenticated observation of HTTP.
`completedJudgmentEnvelope` rejects fixture origin, flattens metadata into the
exact public provider shape and excludes internal fields. This reusable projection
lets M3 render JSON/human without renaming the M1b domain or accepting fake success.
M1b tests may use this projection with explicitly labeled fake-HTTP fixtures; do
not serialize fixture-origin results as production transcripts.

Reuse M1a `parseStrictJson` with `{maxBytes:256*1024,maxDepth:16,
allowNumericKeys:true,numbers:'finite',integerKeys:['input_tokens','output_tokens',
'inputTokens','outputTokens','attempts','baselineChecks','localChecks']}` as relevant
to each wire parser. Enabling numeric keys in the tokenizer is **not** permission
in other objects: closed reconstruction admits them only in Score maps. Duplicate
decoded keys, prototype keys, UTF-8/BOM/scalars, negative zero and integer-token
checks remain enforced. Do not stringify an arbitrary JS object and parse that
to validate it: that invokes getters/toJSON and erases fields/nonfinite values.
Unknown-object reconstruction inspects own data properties, rejects accessors,
symbols, unexpected prototypes, cycles and excessive depth/width, then copies known
fields. Ordinary and null-prototype JSON records are acceptable. Catch boundary
inspection failures without reading/stringifying the thrown value. In-process
malicious proxies/nonterminating getters are outside the cooperating-caller model;
bounded execution is not sandboxing arbitrary JavaScript supplied as a dependency.

### Prepared bytes: actual immutability, not a readonly typed-array cast

```ts
interface PreparedDelivery {
  readonly byteLength: number;
  copyBytes(): Uint8Array;
}
```

`prepareBytes` validates type/size, copies once into private owned storage and
freezes the wrapper; `copyBytes` returns a fresh copy. Maximum is **256 KiB including
the final newline**. Do not freeze a nonempty Uint8Array (it can throw), expose the
retained buffer, or trust `Readonly<Uint8Array>` to prevent mutation. A validated
wrapper produced here is the only preparation value accepted by application;
use a module-private implementation class with private owned bytes to recognize it,
not arbitrary caller methods or a global mutable registry. Zero
or oversized/invalid sequences fail before completion commit. Rendering owns format
and final newline; the application never regenerates bytes after commitment.
Expose `isPreparedDelivery(value:unknown):value is PreparedDelivery` as the local
class-identity check needed by application; this is recognition, not executing
untrusted copyBytes methods.

### Scope/session values in `core/consent.ts`

Define `Scope` exactly as section 5.1 and `RootFileIdentity` exactly as section 5.3.
Scope parsing is strict, 16 KiB, required content categories, no duplicate categories
or roots, at most eight roots. Reuse `isValidLocator` plus the special root `.`;
same sensitive-segment denials and case-sensitive segment-boundary matching. No
scope auto-enablement or filtering of disallowed material.

Define `RepoObservation {rootPath,rootFileIdentity,cwdWithinRoot:boolean}` and
`ConsentSnapshot {sessionId,scope,repo,salt,createdAtMs,expiresAtMs,generation,
maxCalls,attemptsUsed,revoked,activeInvocationId}`. `repo` retains rootPath/rootFileIdentity;
salt is 32 lowercase hex (128 random bits), generation a nonnegative safe integer,
timestamps safe epoch milliseconds with canonical ISO representability, attemptsUsed
0–maxCalls; maxCalls is integer 1–10, lifetime 60,000–1,800,000 ms. Session ID is
32 lowercase hex; invocationId is a canonical lowercase RFC 4122 version-4 UUID.
Root path/salt stay local; root path is nonblank/scalar-valid, at most 4 KiB, and
platform-absolute as observed by the adapter. BigInt identity strings follow the
section 5.3 decimal grammar; this internal contract adds a 32-character bound per
identity field before copying or comparison. This is structural validation, not realpath I/O.
The M3 adapter, not core, observes realpath/cwd/file identity. A typed observation
is injected evidence, not a filesystem authenticity claim.

```ts
parseScope(input: string | Uint8Array): Validation<Scope>;
reconstructConsentSnapshot(value: unknown): Validation<ConsentSnapshot>;
checkScope(input: Brief, scope: Scope): Validation<Scope>;
checkConsent(snapshot: ConsentSnapshot, expected: ConsentExpectation,
  nowMs: number): Validation<ConsentSnapshot>;
repoBindingBytes(snapshot: ConsentSnapshot): Uint8Array;
completionTimes(snapshot: ConsentSnapshot, nowMs: number): Validation<Freshness>;
```

`ConsentExpectation` explicitly holds sessionId, scopeId, current repo observation
and nullable expected generation. No generation change is silently adopted once
admitted. Pure checks distinguish missing/revoked/expired/mismatch; validate bounds,
scope/nonempty categories, synthetic-evidence allowance, root identity/cwd, and time.
`repoBindingBytes` uses compact `{rootPath,rootFileIdentity,salt}` in exact order.
Hashing stays injected. Completion times are canonical ISO UTC strings with expiry
exactly `min(session.expiresAtMs, completedAtMs+60_000)` and no expiry skew extension.
Persisted attempt matching and atomic count/duplicate/active enforcement belong in
the session port implementation, not a pure function pretending to reserve a slot.

## 4. Minimal ports and direct injections

### `ports/clock.ts`

```ts
interface Clock {
  monotonicMs(): number;
  wallTimeMs(): number;
  schedule(delayMs: number, callback: () => void): () => void;
}
type OperationStart = Readonly<{ monotonicMs: number; wallTimeMs: number }>;
```

Schedule returns an idempotent cancellation function, never a timer promise with an
unobserved rejection; it must not call synchronously on registration. Clock values
are finite, monotonic readings nonnegative/nondecreasing, wall readings valid safe
epoch milliseconds. Use controlled callbacks in tests; real timers/clock live in
M3 composition. No Date.now/performance.now/setTimeout in core or application;
pure ISO parsing/formatting with explicitly supplied epoch values is allowed.

Direct hash injection: `sha256(bytes:Uint8Array):Promise<string>` returns 64 lowercase
hex. Pass owned identity/repo-binding bytes; validate output and race the promise.
Tests use Node crypto independently outside inner layers. No hash-port class or
Node crypto import in core/ports/application is needed. UUID is supplied per call,
not generated by inner code; no production composition helper is needed for M1b.

`application/operation.ts` exports one small internal factory
`createOperation(clock:Clock,startedAt:OperationStart,signal:AbortSignal)` returning
`{signal,remainingMs,checkpoint,wait,dispose}`. `checkpoint(stage:ErrorStage)` returns
`Validation<OperationStart>` using the current sample or latched Failure;
`wait<T>(stage:ErrorStage,start:(signal:AbortSignal)=>Promise<T>)` returns
`Promise<Validation<T>>`; `dispose():void` is idempotent. Factory precondition errors
are normalized by the entry function. Consult owns the separate cleanup controller/
one grace and terminal intent, not a generic task registry hidden in this helper.
`remainingMs():number` reports max(0, deadline minus current monotonic reading);
all reads go through clock validation. `checkpoint` latches a failure and aborts on
invalid time, caller cancel or deadline. Consult's guard/progress/final checks use
the same latch for known consent/provider failures; expose
`fail(error:Failure):void` on this helper for that concrete requirement. `wait`
preserves ClassifiedFailure values, maps other throws to internal_failure, and
checks time/terminal state before invoking start and after settlement. Its wrapper
is distinct from an inner port's Validation union; flatten deliberately at the
call site, never mistake a denied store value for successful work.

### `ports/decision-provider.ts`

```ts
interface EvaluationControl {
  readonly signal: AbortSignal;
  remainingMs(): number;
  beforeDispatch(): Promise<void>;
  onProgress(value: unknown): void;
}
interface DecisionProvider {
  readonly origin: EvaluationMetadata['origin'];
  evaluate(
    plan: CompiledPlan,
    state: BriefState,
    control: EvaluationControl,
  ): Promise<EvaluationOutcome>;
}
```

`onProgress` carries exactly `{metadata,usage:Usage|null}`. It is necessary to retain
known dispatch count/status/usage when evaluate never settles or throws. Validate
each snapshot, reject decreasing attempts, origin changes and inconsistent final
metadata. Ignore late callbacks after the terminal latch. Initial metadata uses
the injected provider origin with attempts 0 and null ID/status/usage. No callback
can claim actual paid usage; the provider supplies locally observed transport data.
Malformed progress or a repeated guard latches internal failure even if the provider
swallows the callback/guard error and later reports success. Progress uses complete
snapshots: already known IDs/status/usage cannot change or disappear; final outcome
may add newly validated observations but cannot contradict earlier ones.

The provider invokes the guard exactly once **if reaching dispatch**, never during
SDK construction/configuration failure. Mark the guard entered before its first
await; a second/concurrent call is an invariant failure, not a repeated check or
shared successful promise. On successful evaluation application requires one
successful guard call. The test fixture calls it immediately before its simulated
dispatch but keeps HTTP attempts 0. M2 additionally has a fetch-wrapper one-shot
flag; no code path can issue a second underlying fetch even if the SDK misbehaves.
Guard denial uses a Hunchcraft-owned failure wrapper carrying only validated
`Failure`; application catches it without SDK types. All other thrown unknowns are
sanitized. The guard rechecks reservation, live scope/root/generation, signal and
remaining deadline; M2 rechecks signal/time after awaiting it and before invoking
fetch. That tiny last check-to-dispatch race cannot be eliminated here.

### `ports/session-consent.ts`

Only operations used by these slices; no enable/list/delete/watch/framework API:

```ts
type StoreControl = Readonly<{
  signal: AbortSignal;
  remainingMs: () => number;
}>;
interface SessionConsent {
  read(
    sessionId: string,
    control: StoreControl,
    requestId?: string,
  ): Promise<Validation<SessionRead>>;
  admit(input: AdmissionInput, control: StoreControl): Promise<Validation<Reservation>>;
  check(input: Reservation, control: StoreControl): Promise<Validation<SessionRead>>;
  finalize(
    input: FinalizationInput,
    control: StoreControl,
  ): Promise<Validation<FinalizationReceipt>>;
}
```

`SessionRead={consent:ConsentSnapshot,attempt:RecordedAttempt|null}`.
`RecordedAttempt` lives in core/consent and contains requestId, invocationId,
sourceDigest, state (`active` or a terminal state below), completedAtMs and
resultExpiresAtMs. The pair is null except for completed/delivery-unknown, where
both are valid milliseconds. Omitted requestId requests consent only and attempt
null; a supplied requestId performs read-only attempt lookup. No raw result cache.

`AdmissionInput` explicitly contains sessionId, requestId, invocationId, scopeId,
sourceDigest, repoBinding, repo observation, expectedGeneration, checkSetId,
policyVersion and requestedModel. `Reservation` retains that closed immutable input
and the admitted consent snapshot; do not leak fs handles or store lock methods.
Store reads/checks are revalidated as unknown by application. Admission atomically
rechecks live consent, root/scope/policy, duplicates, active slot and cap; increments
and permanently consumes admission, persists ownership, then returns. One active
per session; zero consultation waiting queue. Tests share one store across callers.
Use exact `Reservation={admission:AdmissionInput,consent:ConsentSnapshot}`. Keep
AdmissionInput/Reservation/RecordedAttempt/SessionRead/FinalizationInput/Receipt as
core consent domain values, exported by type for the port. Add narrowly named
`reconstructSessionRead`, `reconstructReservation` and `reconstructFinalizationReceipt`
in core/consent rather than a generic validator framework. Response acknowledgment
identity is checked separately against the expected arguments. Known input values
are rebuilt into owned arguments before crossing a dependency boundary.

`FinalizationInput` contains sessionId/requestId/invocationId/sourceDigest and
`terminal`, one of:

```text
{state:"completed",completedAtMs,resultExpiresAtMs}
{state:"delivery-unknown",completedAtMs,resultExpiresAtMs}
{state:"unavailable"|"failed"|"timeout"|"cancelled",completedAtMs:null,resultExpiresAtMs:null}
```

`FinalizationReceipt` is the exact same owner/source/terminal data plus
`disposition:"persisted"|"not-admitted"`. Persisted completion acknowledgment
requires a matching durable admission and exact timestamp pair. No count refund.
Finalization changes only this UUID's attempt; it must never release another owner's
slot. It is idempotent for the same transition, not automatic retry by application.
Completion releases the active slot in the same transaction. A later
delivery-unknown transition preserves timestamps/count, cannot affect a newer active
UUID, and is the only downgrade of completed state. Verify accepts completed only.

**Pending admission/commit ownership is part of this small port contract.** Register
an invocation when admit is called, before asynchronous work. Finalize may be called
while that invocation's admit or completion write is unresolved. The adapter must
serialize/fence the pending transition: an acknowledgment means no later settlement
can recreate an active slot or overwrite its terminal disposition. If admission
eventually committed, retain its consumed count; if it definitely did not, return
not-admitted without inventing a completed attempt. `not-admitted` is not an
acknowledgment merely that no record was visible at one instant.
If a pending completion write definitely fails without commitment, never record
delivery-unknown with timestamps as though it completed. Resolve the terminal intent
as a classified local failure (no ready acknowledgment); retain conservative active
blocking unless an owned noncompleted terminalization can be confirmed within the
same grace. Tests distinguish definitive no-commit from possible completed commit.

For tests, the store owns at most one pending admission and one terminal intent per
invocation. A controlled late reservation must receive its already requested terminal
disposition rather than trigger a fire-and-forget `.finally(release)`. An unresolved
write/fence cannot yield a successful acknowledgment. For M3, interprocess uncertain
outcomes must fail closed: retain/block the conservative slot where commitment is
possible, with revoke/new-session human recovery and no lease stealing/replay.
The precise filesystem mechanism remains its feasibility gate. A port cannot force
arbitrary ignoring-abort I/O to settle or guarantee resource reclamation; finite
return plus an honestly unresolved, blocked reservation is preferable to false
release. Do not add a durable queue or recovery worker to hide that limitation.

Read/revocation checks are allowed while a consultation owns a slot. M3 revoke
remains idempotent and marker-based even with a stuck main lock; it need not be added
to this port until its session command is implemented. A fixture's revoke control
lives in tests only. Check/finalize must not reject merely because their own session
is busy; otherwise consultation deadlocks on its own reservation.
`check` requires the UUID's matching recorded admission/source, but permits its own
completed state for postcommit consent checks. It must not require that UUID to
still occupy the active slot after completion, nor reject because a newer UUID is
now active. During dispatch/preparation application additionally requires that the
attempt is still active. The check return includes this reservation's recorded
attempt alongside consent. It does not terminalize or release anything.

## 5. Application sequence, deadlines and delivery ownership

Recommended entry signatures:

```ts
consult(input: ConsultInput, dependencies: ConsultDependencies): Promise<M1bConsultationOutcome>;
verify(input: VerifyInput, dependencies: VerifyDependencies): Promise<VerificationOutcome>;
```

`ConsultInput` is `{brief:Brief,inputBytes:number,sessionId:string,
repo:RepoObservation,invocationId:string,startedAt:OperationStart,signal:AbortSignal}`.
The brief **must** be an owned `parseBrief` result, not a structural cast. This is an
internal precondition like compileChecks, not a public unknown-input parser. Check
basic invocation IDs/counts/clock values before dependencies; violated trusted
preconditions return sanitized internal failure, never provider dispatch.

`ConsultDependencies` is `{provider:DecisionProvider,sessions:SessionConsent,
clock:Clock,sha256,prepareDelivery}`. `prepareDelivery(result:InternalJudgment)`
returns `Promise<Validation<PreparedDelivery>>`, has **no I/O**, and receives the
frozen result. M1b supplies only a test implementation. Future M3 supplies the
JSON/human renderer, using the same domain and pure envelope projection.

`M1bConsultationOutcome` is a closed discriminated union:

```text
{status:"ready",result:InternalJudgment,prepared:PreparedDelivery,
 completion:FinalizationReceipt,cleanup:{status:"confirmed",error:null}}
{status:"error",outcome:ErrorOutcome,
 cleanup:{status:"not-required"|"confirmed"|"unconfirmed",error:Failure|null}}
```

Ready requires confirmed completion. It is **not** terminal CLI delivery success.
Error cleanup metadata contains no judgment, even if a bounded in-memory judgment
was computed earlier. This distinguishes pending/ambiguous local state from
no-admission/provider failure without broadening public error envelopes.

### Ordered algorithm

1. Caller captures startedAt **before** M1a parse/input work. Application does not
   invent a late command start: its deadline is startedAt.monotonicMs + **15,000 ms**.
   M1b tests capture then parse and pass the pair explicitly. M3 runner will start
   the same deadline before arguments/input reading and keep it through emission.
2. `operation.ts` creates one local abort controller, forwards caller cancellation,
   schedules only the remaining deadline, and exposes a checkpoint and bounded
   wait helper to consult/verify. No shared registry/supervisor. Already aborted or
   exhausted input produces no compilation/admission/evaluation. inputMs is start
   to application entry, including caller input/parse; compileMs includes compilation
   and source hashing; admissionMs includes read/scope check/repoBinding hash/admit;
   providerMs is evaluate duration; validationMs is application answer/result reconstruction.
   totalMs is start to result construction; fields need not sum because final
   checks/preparation/commit are also work. Never relabel final output/close as totalMs.
3. Compile unchanged M1a checks, hash exact identity bytes. Read/reconstruct current
   consent, apply scope/root/time rules, compute separate repoBinding with injected
   hash. Admit once with that observed generation/source. No provider construction
   in application and no real storage/hash/time configuration inside inner code.
4. Invoke provider once with guard/progress/control. Validate full result and progress
   consistency on return. Checkpoint after every await and bounded synchronous parse/
   reconstruction/compilation, not just timer notification. Provider-return success
   without a successful guard, multiple guards or metadata forgery fails closed.
5. Final session check; construct all checks/feedback, identity, coverage and time
   fields. Complete full output preparation and owned byte-copy/size validation.
   Check cancellation/deadline/current consent and wall time **again** after
   preparation. Do not select a new completedAt pair that differs from prepared
   bytes. If preparation crossed expiry or made those timestamps inconsistent,
   fail, not regenerate/retry the consultation. Completion plus 60 seconds is capped
   by session expiry. The adapter checks consent/expiry again under completion commit.
6. Finalize completed and exact pair once; validate acknowledgment against owner,
   source and pair. Recheck session consent/attempt and checkpoint after acknowledgment.
   Only return ready if the full prepared result and commit remain usable.
   Cancellation/deadline/revocation after
   a possible completion commit requires delivery-unknown finalization, not a
   noncompleted overwrite. Completion commit ambiguity is treated the same way.
7. On precompletion failure, request appropriate unavailable/failed/timeout/cancelled
   finalization whenever admit was invoked, **even if its result has not arrived**.
   Keep permanent admission counts. On all paths dispose owned timers/listeners,
   close guard/progress intake and abort outstanding local work. Never await a
   losing dependency without a bound, or let its late answer become a ready result.

### Races, precedence and cleanup

Every external asynchronous operation is invoked inside the owned wait helper,
including hash, read, admit, guard check, evaluate, preparation and finalization.
Attach both fulfillment/rejection observers **when starting it**, then race its
settlement against the invocation signal/deadline. Normalize synchronous throws.
Observers and their derived promises must not throw/reject unhandled. Abort the
losing operation, but do not await it in an unbounded finally. Late read/hash/provider/
preparation values are discarded; a late admit/commit result is observed by the
same pending-finalization owner. It never starts inference or a new cleanup timer.

First observed terminal cause wins; if several are true at one checkpoint, choose
cancellation, deadline, revoked/expired consent, then normal local/provider outcome.
A ready value/commit does not latch successful delivery. When a promise resolves
after the deadline but before its scheduled timer ran, elapsed checkpoint still
times out. Provider attempt timeout at 10,000 ms without outer timeout is
`provider_connection`/4; whole deadline is `operation_deadline`/5 regardless of
the SDK's abort exception. Cancellation is always local, not stopped remote billing.

Cleanup gets **one total 1,000 ms grace**, measured from the failed invocation's
cleanup start, with a fresh controller independent of the already aborted work
signal. It cannot dispatch, render a judgment or retry inference. If a completed
write is pending, feed its owner a delivery-unknown terminal intent; do not run
conflicting terminal writes in parallel. There is at most one ordinary finalization
plus one necessary delivery-unknown transition, never an unlimited retry loop.
Normalize/classify cleanup failures; timeout/unconfirmed return within the grace,
with observed losing promises and no claim of durable release. A definitely hung
adapter may retain one unresolved invocation; no caller waits for it indefinitely.
Tests prove bounded return/late suppression and known slot outcomes, not impossible
reclamation of arbitrary never-settling external code.
Admission returning a definite denial needs no finalization; a thrown, malformed,
late or unresolved admit has ambiguous disposition and needs the UUID-owned intent.
No admission/guard/evaluate is retried. A postcompletion metadata downgrade never
refunds count and does not require an occupied active slot.

### M3 delivery responsibility reserved now, not implemented now

M1b ends after ready commit with prepared bytes; tests assert zero actual output.
M3 runner owns emission and successful close semantics under its original outer
deadline. Before first byte, recheck signal/time/live consent. If not allowed, mark
that completed attempt delivery-unknown; with zero bytes a bounded error may be
prepared instead. After **any** byte, never replace/append a second envelope.

M3 uses `completion` owner/source/pair to call `sessions.finalize(delivery-unknown)`
on EPIPE, partial flush, deadline/cancel or other delivery failure; cleanup grace is
bounded. The active slot was already released at completion: this transition must
not reacquire/release a newer invocation. Failed persistence is a local failure,
not durable delivery-unknown. First terminal cause stays latched; absent one, a
metadata failure uses exit 1. No successful delivery acknowledgment is persisted:
successful close is the external caller's independent condition. A crash can leave
completed metadata despite unknown delivery. Do not hold the active reservation
waiting for a future verify/consumption acknowledgment or implement a release retry
that can deadlock the workflow. Verification is read-only, never session consumption.

## 6. Offline verification and trust limits

`VerifyInput` contains current `brief:Brief,inputBytes:number,sessionId,repo,
startedAt,signal` and `result`, explicitly one of:

```text
{format:"internal",value:unknown}
{format:"completed-json",bytes:string|Uint8Array}
```

No auto-detection/fallback between shapes. M1b primarily verifies a prior internal
result via full reconstruction. `completed-json` exercises the reusable strict
production-envelope parser for M3; human text is invalid. `VerifyDependencies` is
`{sessions,clock,sha256}` only. No provider, preparation, admit or finalize dependency
call, counter write or inference can occur. `VerificationOutcome` is the exact
section 9.3 applicable-to-supplied-snapshot data, or `ErrorOutcome` without judgment.

Use section 4's single `read(sessionId,control,requestId)` to obtain the consent and
matching recorded attempt; validate exact bounded SessionRead/RecordedAttempt
fields. No second read API or raw evidence/questions/judgments cache is needed.

After strict reconstruction, recompute unchanged current compilation/digests,
scope and current repo/session checks. Require equal current/result requestId,
scopeId, context, complete bindings, versions, both digests, and a recorded
**completed** admission for that request/source. Active, failed, missing or
delivery-unknown attempts are source_mismatch/6, not reusable successes.
Stored completion/expiry must exactly equal the result strings' parsed milliseconds;
valid changed pairs are stale. Malformed persisted data is local_io/1, not trusted
consent. Missing/revoked/expired consent is unavailable/3. Result expiry and valid
snapshot differences are stale/6. Root/scope mismatch is scope_mismatch/3.

Time rules are precisely section 9.2: canonical millisecond ISO UTC round trips,
completedAt no more than 1,000 ms before session creation, current wall time no more
than 1,000 ms before creation/completion, completion no later than session expiry,
and expiry exactly min(session expiry, completion+60,000). At/after either expiry
is expired; skew never adds lifetime. Within an invocation, reject nonfinite or
decreasing monotonic readings and wall rollback exceeding 1,000 ms between observed
checkpoints; no comparison is claimed between unobserved processes. These explicit
clock checks fail closed, but machine clock trust remains necessary: a rollback
within the observable bounds can extend apparent age. No MAC/signature, persistent
monotonic clock or authentication is implied. A structurally valid forgery with
changed answers and matching metadata can evade authenticity checks; v0 verifies
consistency/applicability, not provider origin authenticity.

Recheck current consent/time after verification work before returning success.
Return only sourceIdentity and the three fixed limitations in section 9.3, not the
answers again. The supplied current brief is the freshness boundary; relevant host
edits omitted from it remain invisible. No request bookkeeping is in source hash:
requestId/sessionId/scopeId are independently matched to the local attempt; context
goal/revision **is** in source identity. Do not change M1a's hash preimage to repair
an association check. Content-equal new request IDs never adopt/replay old judgments.

## 7. M2: actual SDK boundary exercised only through fake HTTP

Recommended provider-local signatures (SDK/Fetch/Response types stay here):

```ts
validateTypeSafeConfiguration(value: unknown): Validation<TypeSafeConfiguration>;
createTypeSafeProvider(dependencies: TypeSafeProviderDependencies): DecisionProvider;
createGuardedFetch(input: GuardedFetchInput): Fetch;
```

`TypeSafeConfiguration` holds the explicit nonblank apiKey and fixed endpoint/model/
logging/retry policy. Never serialize/log it. `TypeSafeProviderDependencies` contains
`configuration:()=>Promise<Validation<TypeSafeConfiguration>>` and required
`fetch:Fetch,clock:Clock` for deterministic adapter-local waits/cleanup. There is no
default global fetch/clock in this slice. Configuration is
called lazily inside evaluate **after admission**; creation/import is inert. M2
tests inject only dummy credentials and fake fetch. No concrete environment reader,
client startup, root export, bin, live launcher or host configuration change.

Configuration validation accepts a deliberately selected configuration snapshot,
not arbitrary SDK options. Empty/whitespace key gives missing_key. Reject nonblank
base URL/model conflicts; explicitly force logging off (ignore log-level override
with fixed non-secret diagnostic). Windows case-insensitive environment extraction
is M3 composition's job; M2 tests the selected values and never read credentials.
No `.env` load, arbitrary headers, endpoint flags or alternate credential sources.
The unknown configuration snapshot is exactly
`{apiKey:string|undefined,baseURL:string|undefined,defaultModel:string|undefined,
logLevel:string|undefined}` with all four own data fields. Reconstruction produces
`{apiKey,baseURL:"https://api.typesafe.ai",defaultModel:"jev-1.13.0",logLevel:"off",
maxRetries:0,loggingOverrideIgnored:boolean}`. Trim configuration strings only,
never state text; empty overrides mean absent. The ignored flag permits a fixed
diagnostic, never echoes its value. Missing/bad fields give sanitized configuration
failure, not arbitrary SDK construction. M3 later selects these four environment
values under its casing/credential policy.

`GuardedFetchInput` is provider-local `{fetch:Fetch,clock:Clock,
configuration:TypeSafeConfiguration,body:string,control:EvaluationControl}`; body
is the provider-built allowlisted compact request. It closes over bounded progress
and failure markers per evaluate, not a shared mutable client registry. Use clock
scheduling for signal/deadline/body cleanup races; SDK-native per-attempt timers
are also checked with controlled test timers. No clock/SDK type leaks inward.

Inside each admitted evaluate, construct SDK0.6.0 from root exports with explicit
apiKey, baseURL, defaultModel, logLevel off, retry maxRetries 0, capped guarded fetch
and timeout at most min(10,000,remainingMs). Fresh allowlisted outbound
`{state,model,questions}` contains only M1a projected state and compiled question
map; never spread a whole input/plan/session envelope. State retains original task,
excerpts and IDs/relative locators but excludes request/session/scope/context,
root path/salt/digests, counters and timestamps. SDK construction failure consumes
admission but has guard count 0/HTTP attempts 0.

Guarded fetch validates the actual SDK-produced URL/method/headers/body against
the expected fixed request, refuses unexpected data, awaits beforeDispatch inside
the wrapper, rechecks signal/time, then invokes underlying fetch exactly once with
`redirect:'error'`. Audit the locked SDK's actual automatic header set; allow its
fixed non-secret protocol headers, never caller overrides. Set/report attempts 1
when the underlying function is invoked, even if it synchronously throws; before
that, attempts 0. This is the number of transport dispatch invocations. Offline
fake-HTTP records explicitly say underlying fetch was fake; it proves neither a
packet left nor a charged attempt. Never retry 401/403/422/429/529 or connection/
timeout/redirect/contract failures, even though upstream docs recommend SDK retries.

Race configuration/fetch/header/body/SDK parse against control signal and remaining
time, not just the final SDK promise. The guarded fetch must also observe and race
the actual SDK-provided `init.signal`, which is distinct from `control.signal` and
carries the SDK attempt timeout. Both signals apply throughout the guard, fetch,
and body receipt and are rechecked immediately before underlying dispatch. An
attempt abort yields `provider_connection` unless application cancellation/deadline
has already latched; it must not permit a late guard to dispatch. Test ignored-abort
fetch/body with attempts 1 and a guard settling after attempt abort with attempts 0,
bounded failure, no late result/dispatch, and handled losing promises.
Stream-count decoded response for success and
errors, maximum 256 KiB, reject every 3xx, and close/cancel body on overflow/abort.
Do not rely on Content-Length, unlimited tee, or SDK buffering. Observe read/cancel
losers, including cancel that rejects or never settles, without waiting forever.
If fetch resolves late after cancellation with a body, close it under the already
owned cleanup bound and never return it to SDK; no late judgment/progress.

For successful bodies, strict parse capped raw UTF-8 **before** SDK parsing, with
the section 3 parser options. Retain only bounded raw bytes/parsed values, reconstruct
a bounded Response for SDK handoff, then use `systemOne(...).withResponse()` and
runtime core validation (SDK generic inference is not validation). Audit how many
bounded copies the locked SDK makes; release references after settlement. Capture
status and validated `x-typesafe-request-id` from the transport, not raw error data.
Independently validate usage from a strict parsed reply before rejecting model or
another answer field. Non-JSON/malformed/oversized/duplicate bodies cannot yield
trusted usage. Non-2xx bodies may be parsed solely for independently valid usage;
arbitrary server error prose never becomes a Hunchcraft failure message.

Use transport-owned fixed failure markers so SDK wrapping cannot erase
redirect/overflow/guard denial classification. HTTP status yields provider_http,
transport/attempt timeout provider_connection, response shape provider_response_contract;
whole-operation cancellation/deadline precedence belongs to application. Catch SDK
objects as unknown and never copy message/body/header/cause/stack. Dispose controllers,
timers/readers/listeners per evaluate; the documented SDK has no client disposal
method to call. Do not add a provider-wide worker or long-lived client lifecycle.

## 8. Acceptance checklist and developer/reviewer gates

Use deferred promises/controlled clocks, not sleep tests. Keep all M1a 98 tests and
independently reviewed golden oracles unchanged. New fixture numbers are synthetic.

### M1b core/application

1. Six/13-check proposals reach the fake with unchanged state/checks and all static
   feedback/raw answers in canonical order; no generated explanation or filtering.
2. Noul/Score exact root/type/IDs/keys/legend/range/tolerances, negative zero,
   nonfinite/fractional usage, unknown fields and prototype/numeric-key bypasses
   fail; shuffled keys reconstruct identically. Invalid responses give no partial
   judgment. Fixture origin/attempt/status/usage invariants cannot be forged by a cast.
3. Closed internal and completed-envelope reconstruction rejects unknown root and
   nested fields, getters/toJSON tricks, malformed timestamps/counts/feedback/bindings
   and wrong primitives; wire duplicate/escaped/prototype keys stay detectable.
4. Scope content/synthetic policy/root segment/case/sensitive-path checks deny before
   admit/evaluate; missing/revoked/expired/root mismatch, duplicate ID/cap/busy deny
   before provider. Failed post-admission construction consumes count with attempts 0.
5. Two same-session calls cannot both reserve; two independent sessions can overlap
   and finish in reverse order with no identity/guard/output leakage. Read/check and
   revoke observation still work on the busy owner; finalize never releases another UUID.
6. Guard is serial/exactly once on dispatch; no guard on pre-dispatch failure,
   denial prevents simulated dispatch; double/concurrent/missing guard fails closed.
7. Cancellation already true, deadline spent in caller parsing, delayed timer callback,
   every asynchronous stage hung, synchronous bounded work crossing deadline,
   simultaneous checkpoint causes and first-event precedence produce finite errors.
   Cancellation then late rejection/success/progress never becomes unhandled/ready.
8. Pending admit resolves with reservation during cleanup: terminal intent is persisted,
   count retained and slot released only for its owner. Pending admit/commit never
   settles, settles after grace, or rejects late: bounded error plus unconfirmed
   cleanup, no false acknowledgment/dispatch/replay. No detached release promise;
   late completion cannot overwrite the pending terminal intent or revive a slot.
9. Preparation throws/rejects/hangs/returns oversized bytes or crosses consent expiry:
   no completed acknowledgment. Mutating original typed array/copy cannot change
   retained bytes. The same encoded content/pair is used for preparation and commit.
10. Completed acknowledgment crossing cancellation/deadline/revoke becomes
    delivery-unknown; pending completion plus finalization obey ownership/fencing.
    Cleanup failure/timeout cannot fabricate durable release or judgment. No actual
    stdout/CLI delivery occurs in M1b; ready returns only after confirmed completion.
11. Verify prior internal result and closed completed JSON against current brief;
    changed request/context/proposal/excerpt/clarification/standard/question/binding,
    cross-session/root, missing/active/failed/delivery-unknown attempt, forged shape,
    changed timestamp pair, exact expiry boundary and detectable rollback fail with
    the specified classifications. Verify performs reads/hashes only, no provider,
    admission/finalization or consumed-state write. Document undetectable clock/host edits.
12. Imports of new inner modules do no credentials/network/fs/timers; tests use only
    test helpers for in-memory consent/provider/time/preparation. No shipped test
    implementation or production fake-success flag/environment fallback.

### M2 boundary and integration

1. Inspect locked SDK artifact, root exports/declarations, engine/TS6 support, options,
   request header/body behavior, retry0, buffer/abort/log paths. Record exact installed
   version/integrity; typecheck actual usages rather than asserting compatibility.
2. Run real SDK against injected fake fetch only, then connect that provider to the
   M1b application using the same test store/clock/hash/preparation. Distinguish
   consumed admission, guard count, fake fetch invocation and HTTP-origin metadata.
3. Fixed destination/method/authorization/body are enforced. Poisoned configuration,
   log override, missing key, redirect, forbidden headers/body extras never expose
   key/source or trigger another dispatch. No global-fetch fallback if injection missing.
4. Valid Noul/Score preserve exact full bindings; wrong model/IDs/usage/legend/sum/
   weighted score and duplicate keys fail. Known valid usage survives an unrelated
   contract failure; missing usage on success fails; unknown charge remains null.
5. HTTP 401/403/422/429/529, synchronous fetch throw, network rejection, per-attempt
   timeout, outer deadline and abort all have exact attempts 0/1 and retry0.
   Hostile error text/headers/causes/proxies cannot appear in returned diagnostics.
6. Content-Length lies/missing, chunked/compressed decoded overflow, huge non-2xx,
   body never EOF, malformed UTF-8/depth/BOM, read rejection and cancel rejection
   remain bounded; late fetch/body/SDK rejection is handled with no late result.
7. Fake transport tests cover wrong request URL/method/body, missing/double guard,
   ignoring signal and SDK attempted second dispatch. No packet/billing/accuracy
   claim from HTTP-origin fixtures or counts. Imported factory creates no client.

Developer runs `npm run check` after source/dependency changes; M2 keeps lockfile
synchronized and inspects `npm pack --dry-run` for changed dependency/package payload.
Check offline imports through emitted modules too. Report actual Node/OS/checks;
configured Windows/Linux Node22/24 CI is not executed-matrix evidence. Independent
review must disposition race/security findings and recheck regressions. Evaluator
audits cases/accounting separately; no new evaluation runner or plan is needed here.

## 9. Alternatives, fixed choices and remaining gates

- **Lifecycle:** invocation-owned helper rather than framework; some adapter cleanup
  repeats. Reconsider only with another implemented lifecycle.
- **Pending admission:** UUID-owned finalization/fence and bounded grace rather than
  detached release/retry. A stuck store can block a session; M3 must prove durability.
- **Prepared output:** frozen wrapper/private copy rather than exposed Uint8Array.
  Costs one bounded emission copy; prevents postcommit mutation/rerender.
- **SDK versus direct HTTP:** reviewed pin/capped guarded fetch. Costs bounded extra
  buffers/audit; reconsider if SDK cannot preserve strict parsing/one dispatch/errors.
- **Verification:** reconstruction plus association rather than hash-only. More
  validation work, necessary for shape/binding/time checks but not authentication.
- **Test storage:** in-memory port implementation, not production fallback. Fast
  mechanics evidence, no cross-process/privacy proof; production substitution forbidden.

No blocking product question remains for starting M1b/M2 under these recommended
contracts. Reviewer/orchestrator must freeze internal signature choices once, not
request another design packet for each helper. If the locked artifact conflicts
with required transport behavior, or pending-finalization implementation cannot meet
the acknowledgment guarantee, return a **specific** blocker rather than relax the
contract. M3 must resolve Windows ACL/root identity/atomic write and uncertain-state
blocking before actual CLI/credential/provider composition. Human disclosure/account
terms, finite live budgets, host execution and calibrated value remain later gates.

### Sources and dependencies

- [Architecture](../architecture.md), [canonical system design](../system-design.md),
  [implementation plan](../implementation-plan.md),
  [ADR 0003](../decisions/0003-cli-first-bounded-consultation.md),
  [actual core contracts](../../src/core/README.md).
- [Existing provider research](../research/jev-cli.md): dated tagged-source/published
  artifact inspection; use for SDK/log/error details, not its superseded sketches.
- [HTTP API](https://docs.typesafe.ai/api.md),
  [models](https://docs.typesafe.ai/models.md),
  [state](https://docs.typesafe.ai/concepts/state.md),
  [Noul](https://docs.typesafe.ai/primitives/noul.md),
  [Score](https://docs.typesafe.ai/primitives/score.md),
  [confidence](https://docs.typesafe.ai/confidence.md): refreshed documentation, not
  authenticated model tests; v0 tolerances/advisory policy are Hunchcraft's choices.
- [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript.md),
  [TypeSafeClient](https://docs.typesafe.ai/sdk/javascript/api/classes/TypeSafeClient.md),
  [configuration](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md),
  [request options](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RequestOptions.md),
  [APIPromise](https://docs.typesafe.ai/sdk/javascript/api/classes/APIPromise.md):
  refreshed options/signatures; docs link [v0.6.0 client](https://github.com/typesafe-ai/typesafe-sdk-js/blob/v0.6.0/src/client.ts).
  Actual installed-type/source audit remains M2 developer work. No host or SDK
  runtime was launched, dependency installed, credential read or live request sent
  in preparing this handoff.

### Documentation-only verification

Only this new note was edited with apply_patch; the canonical specification and M1a
source were not changed. `npm run format:check` passed after patch-only formatting
fixes; `git diff --check` passed. Local link targets and future paths were checked
against the repository map/specification. No source test, SDK install, CLI/host
execution, credential operation, delegation, commit or push was performed.
