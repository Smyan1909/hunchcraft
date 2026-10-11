# Jev provider and portable CLI: research and proposed requirements

**Research snapshot: 2026-10-11. Status: documentation only.** No provider, CLI,
worker, shipped consultation skill, or host integration exists in Hunchcraft.
This document proposes requirements and a team plan; it does not accept a final
protocol, select a host/first feature, authorize runtime work, or report experiments.
The latest user instruction authorizes detailed planning and evaluation research,
superseding older discussion-only planning restrictions in
[shared context](../agent-context.md) and [discussion notes](../design-discussion.md),
but not authorizing implementation or live API calls.

Repository inspection found TypeScript 6.0.3, strict ESM/NodeNext foundations,
one package, no runtime dependencies, and no `bin` declaration. Read the
[architecture](../architecture.md), [foundation ADR](../decisions/0001-typescript-foundation.md),
[extension ADR](../decisions/0002-existing-agent-extension.md), all six layer READMEs,
contributor guidance, and TypeScript, architecture, async, and TypeSafe skills.
The initial working tree was clean. Ownership for this research is this file only.

## 1. Findings and capability/status matrix

| Capability                                                              | Evidence/status                                                                          | Boundary for Hunchcraft                                                        |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Typed semantic judgments                                                | Documented HTTP and JavaScript SDK: Choice, Score, Noul [S2–S5]                          | Evaluate supplied text; not correctness verification or approval               |
| Several independent questions over one state                            | Documented provider parallel evaluation [S3, S8]                                         | Batch bounded independent checks; no host background capability implied        |
| Explicit version selection                                              | `jev-1.13.0` documented; moving aliases also available [S4]                              | Propose pinned model; record requested and returned IDs                        |
| Cancellation                                                            | SDK per-call `AbortSignal`, including pending retries [S5, S6]                           | Local cancellation; remote inference/billing cancellation is not established   |
| Whole-operation deadline                                                | Not provided by SDK [S5, S6]                                                             | Application must own total deadline and discard late results                   |
| Token accounting                                                        | Response `usage.input_tokens`, `usage.output_tokens` [S3, S5]                            | Usage is not a charge receipt; failed attempts can have unknown usage          |
| Repository retrieval or evidence authentication                         | Not a Jev capability                                                                     | Caller supplies actual content; deterministic checks validate known references |
| Portable one-shot consultation                                          | Plausible Node executable design, not implemented [S12, S13]                             | Caller awaits a finite process; host shell permissions still apply             |
| Skill-guided invocation                                                 | TypeSafe ships development guidance [S9]; Hunchcraft consultation skill is only proposed | Installing guidance neither installs our CLI nor grants network permission     |
| Foreground submit/poll/get worker                                       | Optional Hunchcraft design, not a TypeSafe job endpoint                                  | Defer until a concrete host needs an owned longer-lived process                |
| Universal automatic hooks, private reasoning access, in-flight delivery | Not established, not assumed                                                             | Separate integration research must verify each host's actual surface           |
| No training on customer material                                        | Primary documentation/policies make scoped commitments [S4, S10]                         | Do not translate this into no storage, no telemetry, or no subprocessors       |
| Default zero data retention                                             | Not established; enterprise ZDR is advertised [S10]                                      | Confirm account-specific terms before sending sensitive material               |
| Hunchcraft runtime/platform/value verification                          | None in this task                                                                        | Source review and document formatting only                                     |

## 2. Exact provider contract observed

### HTTP transport

The [HTTP reference][S3] specifies:

- `POST https://api.typesafe.ai/v1/systemone` with
  `Authorization: Bearer <API_KEY>` and `Content-Type: application/json`.
- JSON body: `state` (string, object, or array), required `model` string, and
  `questions`, a map from caller-chosen IDs to typed questions.
- Every question has `type` and `instructions` (string/object/array).
  Noul optionally has `criteria` with `true`/`false` descriptions; Choice requires
  a map of option labels to descriptions (including `null`); Score requires an
  ordered array of descriptions. Question IDs route answers but are **not sent
  to the underlying model**. Complete meaning must appear in instructions/state.
- Response: `model`, `answers` under the same question IDs, and `usage` with
  integer `input_tokens` and `output_tokens`.
- Noul answer: `{ "type": "noul", "noul": number }`, yes probability in `[0, 1]`.
  There is no separate provider confidence field.
- Choice answer: `type`, selected `choice`, all option `probabilities`, and
  `confidence` in `[0, 1]`. The selected option is a highest-probability option.
- Score answer: `type`, probability-weighted `score`, `legend` keyed by zero-based
  level strings, `probabilities` for those levels, and `confidence` in `[0, 1]`.
  The score can be between levels; it is not normalized automatically to `[0, 1]`.
- Documented errors include 401 (authentication), 422 (request validation),
  429 (rate limit), and 529 (overload). The error body has no single stable detailed
  schema established on this page. Never depend on arbitrary error prose.
- `GET /v1/models` requires authentication and returns a wire object
  `{ "models": [ { "name": string, "description": string, "release_date": string } ] }`.
  It currently lists aliases; absence from that list does not disprove acceptance
  of a documented versioned ID [S4]. No remote submit/poll/get contract was found
  in the reviewed API/SDK; those names below describe local design ideas only.

### Limits, model pinning, and price snapshot

The [models page][S4] currently lists Jev 1.13 as **`jev-1.13.0`**:

| Published property    | Snapshot value                                                | Implication                                                           |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Total request context | 64k tokens: state plus all questions combined                 | Include instructions and criteria, not just state, in budgeting       |
| Per-question context  | 32k tokens: state plus longest question                       | Passing the total limit alone is insufficient                         |
| Choice options        | Maximum 255 [S3]                                              | Local candidate cap should be lower for the proposed slice            |
| Score levels          | At least two recommended; API accepts up to ten [S3]          | Validate 2–10 locally, even though SDK only checks the minimum        |
| Rate limits           | 100K tokens/second and 80 requests/second                     | Explicitly dynamic; not a fixed entitlement or our concurrency target |
| Input                 | Text/structured textual state, no image/audio/video inference | Do not upload binaries or silently preprocess arbitrary files         |
| Price                 | USD $42/Btok = $0.042/Mtok of input; output tokens free       | Dated public price, not a constant for future billing/reporting       |
| Aliases               | `jev-latest` and `jev-preview` both resolve to `jev-1.13.0`   | Aliases move; preview is not currently a different build              |

The page writes “k” rather than giving an exact integer/tokenizer convention.
No maximum question count, body-byte limit, public JavaScript tokenizer/preflight
token-count endpoint, guaranteed latency/SLA, retry idempotency/billing guarantee,
or remote cancellation endpoint was established in the sources reviewed.
These are **unknowns**, not assertions that no such service exists.

Propose pinning `jev-1.13.0` for the initial experiment and pinning the SDK separately.
Persist requested model and actual response model; treat an unexpected model under
a pinned request as a contract failure, not an automatic fallback to an alias.
Do not require model listing on every call or during offline doctor. Revalidate
availability before approved live evaluation, and require review for model changes.

Cost estimates should use an explicit, dated rate source and account currency/rate,
not bake this price into generated reports. At this snapshot, an illustrative
10,000 input tokens would be $0.00042, **not** a Hunchcraft measurement or invoice.
For a known rate, `input_tokens × rate_per_million / 1_000_000` estimates the
successful request's input charge. Taxes, credits, account-specific prices, failed
attempts, retries, and provider accounting can differ. Unknown usage/cost remains
`null`/unknown rather than zero. Whole-loop cost includes the proposing LLM,
retrieval, feedback consumption, and rework, not only Jev.

### SDK package, published declarations, and documentation discrepancies

The JavaScript guide [S2], changelog [S7], npm registry [S14], and published ESM
declarations [S15] agree on **`@typesafe-ai/sdk` version `0.6.0`**. The changelog
dates it 2026-09-15. It requires Node `>=20`, declares MIT and `sideEffects: false`,
and publishes root import/require exports:

- ESM runtime `./dist/index.mjs`, types `./dist/index.d.mts`.
- CommonJS runtime `./dist/index.cjs`, types `./dist/index.d.cts`.
- Exports `./package.json`; do not depend on unexported SDK source paths.
- Registry metadata has no runtime dependency list. Upstream development-tool
  versions do not require upgrading Hunchcraft's TypeScript 6.0.3.

There is no installed SDK in this foundation. **Published** declarations were
read via a versioned CDN and tagged upstream source, not installed, compiled,
executed, or authenticated against a provider. A future implementation must inspect
the actual locked installed declarations/artifact and verify compatibility with TS6.

Observed signature:

```ts
systemOne<const Q extends Questions>(
  request: SystemOneRequest<Q>,
  options?: RequestOptions,
): APIPromise<SystemOneResult<Q>>;
```

`TypeSafeClient`, `choice`, `score`, and `noul` are named root exports.
`APIPromise.withResponse()` returns `{ data, response, requestId }`; `requestId`
comes from `x-typesafe-request-id` and may be absent. `asResponse()` hands body
ownership to the caller: do not subsequently also await the parsed result.
The SDK buffers response delivery under the per-attempt timeout before handoff,
but parsing/validation/consumption afterwards are caller-owned [S6, S15].

**Do not resolve these differences by blind casts or copying examples:**

1. An earlier read of the models-page JavaScript example used `models.models`,
   whereas 0.6.0 `client.models.list(options?)` returns `APIPromise<ModelCard[]>`:
   the SDK unwraps the HTTP object. Independent planning review subsequently found
   the live example corrected to iterate the returned array. Treat the discrepancy
   as historical, not a current API conflict. SDK source still validates only that
   `wire.models` is an array, not each card [S6, S15]. Use the locked signature if
   this feature is later added; it is unnecessary for first consultation.
2. SDK `EntryType` includes `null`; SDK question instructions are optional/nullable;
   Score descriptions can be `null`. HTTP prose describes non-null state/instructions
   and requires instructions. Use the documented **intersection** for a first slice:
   meaningful non-null state and explicit instructions, descriptive Score levels.
   Do not claim HTTP acceptance of every SDK-permitted value without verification.
3. SDK input validation checks nonempty questions and Score array/minimum length;
   it does not comprehensively enforce HTTP bounds/types. Evaluation parsing uses
   a generic type assertion over parsed data, not runtime schema validation [S6].
   Typed inference is convenient but not a trustworthy external-data validator.
4. Historical Python/cookbook snippets use older APIs/model names/env variables.
   For example, citation-check code uses `TYPESAFE_ENDPOINT`; this is **not** the
   current JavaScript base-URL environment name. Version-specific examples and
   cookbook labels such as “verified” are not our interface or authority policy.

### Configuration, retries, timeouts, and cancellation

| JavaScript option        | SDK environment fallback | SDK default                     |
| ------------------------ | ------------------------ | ------------------------------- |
| `apiKey`                 | `TYPESAFE_API_KEY`       | Required at client construction |
| `baseURL` (exact casing) | `TYPESAFE_BASE_URL`      | `https://api.typesafe.ai`       |
| `defaultModel`           | `TYPESAFE_DEFAULT_MODEL` | `jev-latest`                    |
| `logLevel`               | `TYPESAFE_LOG_LEVEL`     | `warn`                          |
| `timeout`                | None documented          | 10,000 ms **per attempt**       |
| `retry.maxRetries`       | None documented          | 2 retries after initial attempt |

Explicit options take precedence. Missing/blank environment strings are ignored;
environment values are trimmed. Explicit `apiKey` is a constructor argument for
internal injection, **not permission to expose a CLI key flag**. The source holds
the key in a private field and reads environment fallbacks during construction.
Construct only after authorized activation; a library import must not construct
the client or read credentials. There is no client `close`/`dispose` contract in
the reviewed public declarations; Hunchcraft owns controllers, timers, listeners,
and any custom transport lifecycle it introduces.

Default retries cover 408, 429, 500–599 (including 529), connection errors, and
timeouts. Defaults: 500 ms initial exponential backoff, 5,000 ms backoff maximum,
0.25 randomly subtracted jitter, respect `Retry-After`/`retry-after-ms` up to
60,000 ms; longer server delays fall back to backoff. Per-call options can override
`signal`, `timeout`, `retry`, and headers [S5, S6]. A single request can therefore
greatly exceed the default ten seconds. “SDK handles retries” is not a deadline.

Propose **zero automatic retries initially**. If later justified, allow at most one
retry, only within the same total deadline/token-attempt reservation; no layered
application × SDK retries. Never retry invalid credentials/input, canceled,
superseded, or stale work. Avoid retries after ambiguous timeout/connection failure
unless explicitly approved: the server may have processed/charged the first attempt.
Do not treat a request ID as a documented idempotency key.

Own one operation controller and monotonic deadline spanning input receipt,
validation, transport/backoff, response validation, and delivery. Pass its signal
to the SDK; if the outer deadline fired, classify the result as timeout even when
SDK reports `APIUserAbortError`. Check the deadline and cancellation state after
parsing and immediately before emitting/consuming. An outer promise race must
also abort and handle the losing promise, not leave an unobserved request running.
Synchronous parsing cannot be preempted by a timer; byte/depth bounds keep it small
and post-parse time checks prevent late delivery. Graceful shutdown is bounded.
Cancellation can prevent local use/retries; **it does not guarantee remote work
or charges stopped**. No live cancellation behavior was tested.

## 3. Credential, permission, privacy, and transport requirements

### Activation and credential handling (proposed)

- Separate installing the CLI, installing guidance, enabling a session, possessing
  a key, authorizing repository-data disclosure, and granting host shell/network
  permission. None implies the others. Require an authorized person to confirm
  provider, data scope, finite budget, and session scope before network use.
- Offline by default: help/version, local input validation, and `doctor` do not
  construct a provider, fetch models, check credit balance, resolve DNS, or send a
  test prompt. Report “credential present/missing” only, never “valid” without an
  authorized network check. Any later `doctor --network` concept requires explicit
  permission and disclosure of endpoint, request, and possible billing.
- Doctor's optional local environment-presence check is an explicit diagnostic
  exception, not provider credential resolution or activation. Help/import/local
  validation should not read credentials at all; doctor must not copy, retain,
  format, or expose the value while checking presence.
- Read `TYPESAFE_API_KEY` only during explicit executable activation or accept an
  explicitly injected in-memory credential in a library factory. Require nonblank
  key without ever echoing it. No `--api-key`, positional key, JSON key field,
  URL credential, log key suffix, shell-history example with a literal key, or
  credential in repository config. Do not auto-load project `.env` files.
- Prefer credentials provided by an approved secret manager/launcher through the
  process environment. Do not ask the agent to paste a key into chat or write it
  to a command line. Environment is not a secure vault: process inspection,
  inherited children, crash dumps, and host tool capture are residual risks.
  Restrict credential inheritance to the intended process, never dump `process.env`.
- Reject secret-bearing configuration fields/arguments without reproducing their
  values in errors. Secret detection on input is defense in depth, not proof that
  repository text is secret-free. Minimize selected content and require disclosure
  permission rather than promising perfect automated scrubbing.

### Endpoint and logging security (proposed)

The SDK concatenates `baseURL` and `/v1/systemone`, strips trailing slashes, and
sends bearer credentials to that destination; tagged construction code does not
implement an endpoint allowlist [S6]. Do not blindly inherit `TYPESAFE_BASE_URL`.
Propose an explicit fixed HTTPS origin `https://api.typesafe.ai` for the first slice;
reject a conflicting override safely rather than silently redirecting secrets.
No userinfo, query/fragment credentials, arbitrary headers, TLS bypass, or browser
mode. For any later enterprise/proxy endpoint, require operator-owned allowlisting,
separate confirmation and credential scope, and tested redirect policy. Use a
transport that rejects redirects for authenticated requests; never assume keys
and prompts cannot leak because a destination string started with HTTPS.
Injected fake transport should support offline tests without enabling insecure
production endpoint flags. Proxy/custom-fetch TLS and trust behavior remains to
be reviewed if that concrete need arises.

SDK `debug` includes bodies, and default `info`/`debug` use console methods that
can contaminate stdout. Header redaction preserves the last four secret characters
for some known headers and does not scrub arbitrary headers/bodies [S6]. Propose
explicit `logLevel: "off"`, overriding `TYPESAFE_LOG_LEVEL`; implement only a
Hunchcraft allowlisted diagnostic sink. Never serialize raw SDK error objects:
`APIError.body`, `headers`, `cause`, stack, and even `message` can contain server
text or input echoes. Emit fixed error codes/messages plus bounded sanitized status
and request ID. Strip control/ANSI characters and cap all diagnostic strings;
do not log key prefixes/suffixes, absolute private paths, URLs with secrets, prompts,
state, questions, source excerpts, or response bodies. Scrubbing is a backstop,
not a reason to enable raw logging.

### Primary privacy/legal findings, not legal advice

The legal landing page [S10] links the following primary policies. Dates below
are each page's **Last updated** date, not the web renderer's publication timestamp.

| Source                             | Verified statement                                                                                                                                                                                                                                        | What it does not establish                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Models and legal landing [S4, S10] | Requests/responses are not used to train Jev; enterprise ZDR offered                                                                                                                                                                                      | Default ZDR, an enabled enterprise agreement, or a fixed retention period                                                |
| Privacy Policy, 2025-11-19 [S16]   | Collects prompts/data/instructions/Input; will not train or fine-tune AI/ML on Input; services hosted in US; retention as reasonably necessary for services/business purposes                                                                             | No storage; no international transfer; no service-provider or legally compelled disclosure                               |
| MCA, 2026-09-23, §§4.1–4.3 [S17]   | No Customer Data in weight-training datasets without prior consent; permits processing for service/fees and perpetual processing for telemetry generation, abuse monitoring, legal compliance; telemetry includes logs, hashes, summaries/classifications | That no hashes/logs/derived telemetry are retained, or that no-training is an unconditional substitute for account terms |
| DPA, 2026-04-24 [S18]              | Customer/controller and TypeSafe/processor roles; documented instructions; subprocessors; transfer safeguards; retention as necessary given purpose/law                                                                                                   | A numerical API-request retention window or blanket permission to disclose third-party repository data                   |
| AUP, 2026-09-23 [S19]              | Restrictions on harmful/illegal use and security probing; compliance monitoring and reporting provisions                                                                                                                                                  | Approval for adversarial live probing or sending harmful fixtures as part of ordinary evaluation                         |
| Site Terms, 2026-09-19 [S20]       | Website terms distinguish separately contracted services; warn against confidential Site submissions                                                                                                                                                      | API-specific confidentiality from a website contact/playground flow                                                      |

Do not flatten policy differences: Privacy explicitly promises no training on
Input; MCA addresses Customer Data including Output with a prior-consent exception.
Account Orders/separate agreements may control. The MCA's DPA cross-link uses a
different path from the legal landing page; the reviewed DPA is the landing-page
document [S18]. Confirm applicable agreements rather than infer their equivalence.
The Trust Center subprocessor URL [S21] returned only a page shell; **no subprocessor
names, locations, security certifications, or detailed retention schedule were
verified**. Seek written account-specific retention/ZDR, deletion/backups, regional
processing, and subprocessor terms if required. ZDR does not by itself prove that
all account metadata or derived telemetry disappears.

MCA §§2.2–2.4 permits customer application integration but restricts making the
service available as a standalone service and credential sharing; §2.3 also limits
distillation/competing uses. The SDK's MIT license is not the hosted service license.
A purpose-built Hunchcraft consultation client using each user's own account is a
design candidate, **not a legal determination** that a generic API proxy/reseller
is permitted. Confirm distribution/evaluation scope with an authorized account
owner/provider before live use or publication of experiments. Do not share a
maintainer's key or design a public authenticated proxy. Review MCA §5 Input rights,
§9 inaccurate Output/independent evaluation, §16.12 export restrictions, and AUP
for the planned data/tasks. Host permission is not legal consent on behalf of a
repository owner or data subject.

## 4. Portable synchronous consultation first (proposed, not selected)

“Synchronous” means **one foreground invocation waits for its result**, not a
blocking SDK or `spawnSync` in a host event loop. JavaScript transport stays async.
The architectural recommendation is a small one-shot consultation path before a
daemon/job framework. It can provide a reference surface without claiming every
agent supports it. The integration researcher owns host observation, tool await,
permission, and result-delivery findings; this document does not choose hooks.

### Executable and distribution requirements

- Keep one package and strict TS6. Proposed compiled executable location is
  `dist/composition/cli.js`, with an explicit `bin` map and a first-line
  `#!/usr/bin/env node`. This path/name is illustrative, not an existing export.
  Use `.js` relative imports, `import type`, Node-compatible ESM, and emitted JS;
  do not require a TypeScript runner, bundler aliases, or Unix shell scripts.
- Separate an executable bootstrap from an importable, explicitly invoked runner.
  The root library and provider factories must stay import-time inert, with no
  credential reads/network/listeners/workers. Package `sideEffects: false` is not
  a security guarantee or permission to make importing an executable start work.
- npm documents Unix bin links and Windows command shims [S13]. Human shell use
  must document quoting and host execution-policy differences. Programmatic Node
  callers should launch an approved Node executable with the **resolved compiled
  entry path and an argument array**, `shell: false`, rather than assume a Windows
  `.cmd` shim works through `execFile` [S12]. An explicit executable subpath, if
  needed to resolve this path, requires packaging review; do not invent one now.
- No `npx latest`/download-on-each-consultation assumption. Installation is separate,
  operator-approved, versioned, and may involve network access. Do not add install
  hooks that activate a provider, capture credentials, or alter host configuration.
- A future Hunchcraft **consultation** skill would document how to prepare bounded
  artifacts, invoke an already installed version, and interpret errors/signals.
  This differs from the upstream **TypeSafe development** skill that teaches API
  integration. Install each intentionally; no skill itself is a worker or auto-hook.
  Skill packaging/target paths belong to the shared distribution/host plan.

### Input/output and exit behavior requirements

Proposed command sketches, **not runnable/published commands or final syntax**:

```text
hunchcraft consult --input - --output -
hunchcraft consult --input "path with spaces/brief.json" --output -
hunchcraft validate --input -
hunchcraft doctor
```

Accept one explicit input source: bounded UTF-8 JSON from stdin **or** an explicit
local JSON file path. Do not embed prompts/JSON in argv, fetch URLs, evaluate JS,
execute shell strings, scan the repo automatically, or resolve arbitrary evidence
paths as instructions. EOF terminates stdin; reject trailing documents and malformed
encoding. Define BOM/CRLF handling and duplicate-key rejection in the final parser
contract; do not silently let duplicate IDs overwrite checks. TTY stdin with no
explicit input should fail/help, not wait indefinitely for a private prompt.

Distinguish a local path to the input document from an evidence handle _inside_
it. First slice should carry actual excerpts in JSON; embedded handles do not
grant filesystem access. Any later referenced-file mode needs explicit root/path
allowlisting, symlink/realpath containment, regular-file checks, and bounded reads
from opened snapshots, not a time-of-check/time-of-use assumption. Private absolute
paths must not enter diagnostics/provider state by default. An explicitly requested
file output needs no-clobber/atomic-write semantics and failure cleanup; stdout-only
first is simpler. No hidden prompt/response cache in the repository.

Machine mode should produce **exactly one bounded JSON envelope plus newline** on
stdout for an ordinary terminal outcome, including errors. No progress text, SDK
logs, banners, markdown, automatic retries notices, or mixed JSON/human output.
Use stderr only for sanitized bounded diagnostics. A proposed explicit human
renderer may exist separately; it must not fabricate explanations. Handle stdout
backpressure, partial writes, EPIPE, stdin errors, and interrupted processes. Do not
promise an envelope if the process is killed, cannot start, or output is broken.
Prefer graceful flushing/`exitCode` over an abrupt exit that truncates JSON.

Caller-side spawn requirements: concurrently drain stdout/stderr with byte caps;
close stdin after the document; observe `error`, stream failures, and `close` (not
just `exit`, since streams may still be open); enforce a process deadline; cancel
on host/session termination; parse JSON as `unknown`; verify version/request/session
identity and error-vs-judgment shape; never pass arbitrary child stderr through as
trusted model guidance. Do not use shell interpolation or spawn detached children.
Normalize case-insensitive Windows environment keys and deliberately select inherited
environment fields. Killing a process is not proof it/remote inference stopped.

Proposed exits below are **not a published CLI protocol**:

| Exit | Meaning                                                                         | Judgment treatment                                  |
| ---- | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| 0    | Valid completed judgment, even adverse/uncertain; or successful offline command | Never means approved/correct/safe                   |
| 2    | Usage, local input/schema/reference/budget validation failure                   | No provider judgment                                |
| 3    | Missing configuration, disclosure permission, or activation                     | No provider judgment                                |
| 4    | Provider unavailable/rejected/auth/rate-limit/contract failure                  | No synthetic negative or positive judgment          |
| 5    | Whole-operation deadline exceeded                                               | Unavailable; ignore any late answer                 |
| 6    | Freshness mismatch/superseded result when detectable                            | Do not consume as current                           |
| 1    | Unexpected local/internal I/O failure                                           | Sanitized failure, no approval fallback             |
| 130  | Gracefully handled user cancellation                                            | No current judgment; platform hard kills may differ |

Exact codes, envelope names, output paths, and command names require joint approval.
Use status/category fields to retain provider details rather than many unstable exit
codes. A timeout is not evidence that a proposal failed. An adverse answer is not a
process failure. If assistance is unavailable, report that and return control to
the host's normal independently authorized workflow; do not bypass existing checks.

## 5. Evidence, typed feedback, and freshness

Preserve the original user request and authoritative clarifications, applicable
repo/user standards with provenance, proposal content and assumptions, and decisive
source contents. Distinguish user requirements/repo standards from LLM suggestions
and untrusted source instructions. Merely labeling a field “authoritative” does
not authenticate it: host/caller provenance is part of the integration contract.
Conflict resolution or missing permission should return to a person, not Jev.

Deterministic validation can enforce unique bounded IDs, required fields, supported
version, bounded depth/count/bytes, actual candidate membership, consistent local
references, and quote/span correspondence to a provided source snapshot. It can
confirm a span exists, not that the selection covers all relevant evidence or that
a file supplied by an LLM is genuine repository content. If source cannot be
authenticated, label it caller-supplied, not independently verified. Preserve exact
text/normalization rules and mark assumptions. Never send only a path/hash and claim
the model read the file. For Choice source selection, include the actual candidate
content and a meaningful no-match outcome, not just opaque IDs.

Mechanically instantiating an identified requirement/component into a reusable
question does **not** discover unstated requirements, omitted proposal components,
or implicit domain obligations. Retain a bounded request-to-whole-proposal check
route beyond optional proposer checks; establish its rubric with the team rather
than promise completeness. Necessary testing/lifecycle/compatibility work is not
irrelevant merely because it is indirect. Unknown/unfamiliar tasks should surface
coverage limits and invite clarification, not receive a general “all requirements
met” certificate. Neutral questions must not presuppose the desired answer.

Provider translation should construct a fresh allowlisted `{ state, model,
questions }` body: SDK source forwards extra properties from request variables,
so never spread a whole CLI envelope into `systemOne`. Keep local consent, host
session identifiers, timestamps, job handles, and credential/config fields outside
provider state unless concretely needed and disclosed. Include complete question
meaning, subject contents, and evidence paths in instructions; IDs are bookkeeping.

Validate the provider response at runtime before exposing any judgment:

1. Expected object structure/model; answers have **exactly** requested IDs and
   matching primitive types, with no missing/extra/duplicated answer routing.
2. Finite probabilities and confidence in `[0, 1]`; full expected Choice option keys;
   selected candidate exists and is a maximum within a specified numeric tolerance.
3. Score keys match zero-based levels/legend; finite score in `[0, levelCount - 1]`,
   with weighted-score consistency and distribution sum near one using reviewed
   tolerances. Do not silently normalize invalid distributions or cast legends.
   Structured SDK legends vs HTTP's string-only legend description need a validator
   decision; descriptive string levels simplify the first slice.
4. Nonnegative safe-integer token counts, bounded model/request-ID strings, bounded
   response bytes, and fixed diagnostic codes. If using SDK buffering, inject a
   capped transport/body reader so a huge body cannot allocate unbounded memory
   before validation. Do not rely solely on `Content-Length` or timeout.
5. Any mismatch yields provider-contract failure; no partial successful judgment
   unless an explicitly approved future partial-result policy exists.

Question/template version, exact question-to-subject/evidence bindings, raw typed
values/distributions, and provenance make feedback traceable **without** generated
explanations. A renderer can say “signal for supplied pagination check” and locate
its question/excerpt; it must not claim Jev diagnosed a specific failure or proved
correctness. Source contradiction, insufficient evidence, uncertainty, and provider
failure remain separate. Confidence summarizes a distribution, not truth, evidence
completeness, or permission. Keep requirement signals separate from compensating
cleanliness preferences; no approval score or uncalibrated action threshold.

### Illustrative JSON only: neither final shared schema nor API transcript

This small draft shows a caller-owned envelope distinct from the provider body.
It is a **synthetic** CSV example, not a selected Hunchcraft feature or live response.
Field names, version syntax, rubric, and error codes remain for shared design.

```json
{
  "schemaVersion": "draft-jev-consult/1",
  "requestId": "req-demo-1",
  "context": {
    "sessionId": "session-demo",
    "goalId": "goal-csv",
    "proposalRevision": "proposal-1"
  },
  "brief": {
    "originalRequest": "Export all filtered rows as CSV.",
    "proposal": [
      {
        "id": "component-export",
        "content": "Serialize the visible table rows.",
        "assumptions": []
      }
    ],
    "evidence": [
      {
        "id": "evidence-pagination",
        "locator": "provided-example/Table.ts",
        "provenance": "caller-supplied-example",
        "content": "Table receives only the current page of filtered results."
      }
    ]
  },
  "checks": [
    {
      "id": "check-scope",
      "componentRefs": ["component-export"],
      "evidenceRefs": ["evidence-pagination"],
      "question": {
        "type": "noul",
        "instructions": "Given `evidence[0].content`, does `proposal[0].content` provide all filtered rows requested in `originalRequest`?"
      }
    }
  ]
}
```

In this illustration, provider state would be the validated `brief`, and the named
question's instructions deliberately refer to its actual contents. Model and
question map are assembled separately. Bindings validate local IDs; they are not
a claim that Jev saw `check-scope` or opened `locator`.

Illustrative synthetic success **after** provider validation (numbers invented):

```json
{
  "schemaVersion": "draft-jev-consult/1",
  "kind": "judgment",
  "status": "completed",
  "requestId": "req-demo-1",
  "context": {
    "sessionId": "session-demo",
    "goalId": "goal-csv",
    "proposalRevision": "proposal-1"
  },
  "sourceIdentity": {
    "algorithm": "sha256",
    "canonicalizationVersion": "draft/1",
    "fingerprint": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "freshness": "requires-consumer-check",
  "provider": {
    "name": "typesafe",
    "sdkVersion": "0.6.0",
    "requestedModel": "jev-1.13.0",
    "returnedModel": "jev-1.13.0",
    "requestId": null,
    "attempts": 1,
    "usage": { "inputTokens": 1000, "outputTokens": 20 },
    "costEstimate": null
  },
  "signals": [
    {
      "checkId": "check-scope",
      "componentRefs": ["component-export"],
      "evidenceRefs": ["evidence-pagination"],
      "answer": { "type": "noul", "noul": 0.08 }
    }
  ],
  "coverage": "supplied-material-only"
}
```

The 64-character `a` fingerprint is a **placeholder**, not a computed hash of the
input. The actual implementation must compute identities and retain the exact
validated question/template binding, not use this mock value or omit questions
from freshness calculation. Caller-visible provider metadata should also track
duration and completion/deadline, with units, in the jointly chosen format.

Illustrative timeout envelope; no `signals` or synthetic probability:

```json
{
  "schemaVersion": "draft-jev-consult/1",
  "kind": "error",
  "status": "timeout",
  "requestId": "req-demo-1",
  "error": {
    "code": "operation_deadline",
    "message": "Consultation did not complete before its deadline."
  },
  "provider": {
    "name": "typesafe",
    "attempts": 1,
    "usage": null,
    "costEstimate": null
  }
}
```

### Identity and consumption

Propose versioned canonical serialization and SHA-256 over the original request/
authorized clarifications and standards, exact proposal revision/content,
**actual** evidence snapshots and provenance, question instructions/criteria/order,
rubric version, model selection, and scope-relevant configuration. Preserve array
and Choice option order (documented order sensitivity); define object ordering
carefully rather than indiscriminately sorting away semantics. Include session/goal
identity in the local association to prevent cross-session delivery, while keeping
unneeded identifiers out of provider state. Compute hashes locally from validated
snapshots, not trusting LLM-supplied digests. Hashing is identity, not authentication,
anonymization, or proof of complete repository coverage.

A result can become stale after it completes and before the agent consumes it.
Consumers must compare current session, goal, proposal, relevant evidence, and check
identity immediately before use; elapsed age alone is insufficient. One-shot CLI
cannot observe subsequent host changes, so output should honestly say freshness
requires a consumer check. If current identity is unavailable, freshness is unknown,
not “fresh.” Cancellation alone does not prevent a late result from being emitted.

No raw prompt/evidence telemetry by default; no automatic remote Hunchcraft telemetry.
Propose opt-in local structured metrics containing counts, durations, statuses,
versions, usage, and bounded opaque associations. Avoid global stable hashes/paths/
session IDs in exported metrics: hashes can identify low-entropy content and link
sessions. Any diagnostic artifact with full prompts/results needs separate explicit
consent, private storage/access/retention, deletion, and no repository commit. Safe
metadata-only logging does not change TypeSafe's own telemetry rights.

## 6. Optional foreground worker: defer unless justified

A separate foreground owner could later support **local** submit/poll/get/cancel
operations if an unchanged host can launch/retain it and deliver results at a
supported boundary while useful work proceeds. A shell tool that waits for process
exit may simply block on a long-lived worker. This cannot be solved by asserting
that “a skill runs in the background.” Obtain the integration research first.

Proposed lifecycle requirements if justified:

- Explicit start/stop and owner; no detached/unref child or fire-and-forget shell
  process. Host sandboxes may reap children; terminals close; PIDs can be reused;
  polling files alone neither executes work nor guarantees delivery. Do not depend
  on fragile parent lifetime or introduce a hidden daemon/service manager.
- Session-private, in-memory queue/results first. A possible transport is bounded
  framed stdio owned by a parent; independent shell poll clients would need an
  explicitly secured IPC/rendezvous contract and lifecycle design. Do not casually
  add unauthenticated localhost HTTP or durable shared spool files.
- Unique opaque handles bound to session/goal/source identity; reject cross-session
  access. Intake validation/permission before enqueueing; no shared result cache
  by prompt hash; explicit terminal states and no result-on-error conflation.
- Acknowledged submission means accepted locally, not provider completion.
  Poll/get do not trigger new inference or refresh TTL; unknown/expired handles
  remain unavailable. Consume still checks freshness. Cancellation terminalizes
  local jobs and suppresses late delivery, regardless of remote completion.
- Stop intake, cancel queued/in-flight work, handle all rejections, discard late
  completions, release IPC/listeners/timers, and clear raw state/results on disposal.
  No restart replay of charged work. Define owner disconnect and idle expiry.

Suggested finite worker bounds, **only if approved later**: one in-flight request,
four waiting jobs per owner, sixteen retained terminal results, 60-second result
TTL, 120-second idle shutdown, and at most 10-minute worker lifetime. Reject queue
overflow explicitly (do not silently drop user submissions); an automatic native
hook could instead propose newest-revision replacement for that exact goal, but
that policy belongs to the shared host plan. Count queue wait in each deadline.
Impose aggregate raw-byte and token-attempt reservations, not just item counts.
These values are conservative design candidates, not measured optima.

## 7. Suggested finite first-call defaults and decisions to confirm

All values here are **proposed**, not accepted implementation constants. Hard
local validation bounds are distinct from estimates of undocumented tokenization.

| Area                   | Proposed initial default                                                                                              | Confirmation/limitation                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Activation             | No network until explicit disclosure/session authorization; offline doctor                                            | Define host/user consent proof; key presence is insufficient                |
| Model/SDK              | `jev-1.13.0`, exact SDK `0.6.0` after artifact review                                                                 | Recheck availability/types; no alias fallback                               |
| Execution              | One foreground call, one request; no loop/automatic follow-up                                                         | Shared first judgment/rubric and host path still unchosen                   |
| Retries                | 0                                                                                                                     | Any retry reserves another possible charge and shares deadline              |
| Time                   | 15,000 ms whole runner operation; SDK attempt at most 10,000 ms and remaining budget; 1,000 ms shutdown grace         | Host launch/consumption overhead also needs a caller-owned finite timeout   |
| Input                  | At most 48 KiB input document, 32 KiB serialized provider state, depth 16                                             | UTF-8 bytes, not tokens; reject oversized input, do not silently truncate   |
| Questions/candidates   | 1–16 questions; 2–32 Choice options per question; 2–10 string Score levels                                            | Lower than provider Choice maximum; no claim of exhaustive candidates       |
| Other size bounds      | At most 16 KiB all serialized questions combined, 4 KiB each; provider response 256 KiB; stdout 256 KiB; stderr 8 KiB | Enforce during streaming, including failures/chunked bodies                 |
| Token target           | Advisory 8,000 total / 6,000 state-plus-longest-question tokens                                                       | No verified tokenizer; byte caps are not proof of token count or charge cap |
| Attempt/session budget | One attempt per invocation; authorized driver reserves finite session calls, propose 10                               | CLI alone cannot police independently launched processes or other key users |
| Output/authority       | JSON only, no aggregate approval, no automatic repository action                                                      | Joint envelope/exit protocol and host fallback need agreement               |
| Logging/storage        | SDK logging off; no raw prompt logs, durable caches, detached work, or telemetry upload                               | Host stdout capture itself may retain results; disclose that separately     |

A strict dollar/token ceiling cannot be guaranteed using undocumented token counts,
successful-response usage only, and independent CLI processes. If a human requires
a hard spend limit, block network until a verified tokenizer/conservative accounting
method and owner-wide reservation (or enforceable provider account cap) are agreed.
Do not advertise the advisory target as a guarantee. Even with estimates, reserve
worst-case allowed attempts before starting; unknown charged attempts cannot be
refunded locally by assuming usage was zero. Provider rate limits do not bound
all calls across an account. Increasing any bounds needs explicit review.

Required human/team decisions before implementation:

1. What first bounded judgment and evidence/rubric are in scope? What will its
   signals cause the agent to do, and what explicitly remains independent?
2. Which host permits shell/stdin/artifact input and awaits/delivers the result,
   under what permissions/time/output constraints? Native hooks remain separate.
3. Which data owner authorizes the selected repository/request disclosure? Are US
   processing, retention/telemetry, account terms, and any enterprise ZDR acceptable?
4. Is a purpose-built consultation CLI permissible under the applicable provider
   agreement? Who owns accounts, keys, experiment publication, and billing?
5. Confirm pinning, endpoint policy, no-retry/timeout defaults, session budgets,
   and whether a strict token/dollar cap is required before the first live call.
6. Jointly choose final envelope/version, evidence provenance, canonicalization,
   command/exit contract, executable resolution, skill packaging, and fallback.
7. Is foreground worker complexity warranted by a verified host opportunity, or
   should one-shot remain the entire initial runtime? No worker by default.

## 8. Proposed implementation/team plan and acceptance checks

These are future work packages **after explicit approval**. They do not delegate
work now or expand this task's file ownership. The orchestrator must assign actual
disjoint files, accepted criteria, and review gates before writers start.

| Stage/owner                                     | Proposed deliverable                                                                                                                | Gate/evidence                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Orchestrator + architect/integration researcher | Combine host findings with this provider research; agree first slice, permissions, typed artifact, authority, budgets, packaging    | Supported observation/await/delivery, no host fork or universal auto-hook; user approval and ADR                  |
| Evaluator + rubric owners                       | Bounded check definitions, coverage limits, representative labeled cases, whole-loop evaluation protocol                            | No inherited cookbook thresholds or claims of compute savings; separate domain obligations and source uncertainty |
| Developer: inner layers                         | Pure identity/validation/binding values in core; one concrete decision-provider port; bounded one-shot orchestration in application | No SDK/process/host types inward; explicit injection; no speculative worker framework                             |
| Developer: provider                             | Isolated `providers/typesafe` translation, capped transport, runtime output validation, sanitized errors, explicit controls         | Locked installed SDK/types reviewed; offline fake fetch; no accidental extra fields/env/logging                   |
| Developer: composition/CLI                      | Explicit activation, input/output, process cancellation, executable and package changes                                             | Root imports inert; offline doctor; real emitted ESM/Windows shim behavior verified                               |
| Integration specialist                          | One verified adapter or consultation instructions for an unchanged host                                                             | Host version/docs/types and actual shell/runtime test; no assumption that skills install binaries                 |
| Independent reviewer                            | Security/contracts/races/packages/docs review                                                                                       | Substantive issues fixed, affected checks rerun; verify no secrets/private fixtures                               |
| Evaluator, only with live permission            | Small finite predeclared live experiment, then host whole-loop comparison if viable                                                 | Data rights/model/questions/budgets fixed; source review alone is not verification                                |

Meaningful default **offline** tests should include:

- JSON syntax/UTF-8/duplicate keys/version/size/depth, empty/missing/extra fields,
  duplicate or dangling refs, candidate membership, malformed spans, unsupported
  nulls, field smuggling, secret-bearing args/config, and input timeout/no EOF.
- All three response types; missing/extra IDs, wrong type/model/candidate, NaN-like
  invalid values at fake boundaries, bad sums/Score keys/legends/weighted score,
  malformed/non-JSON/oversized/chunked bodies, negative/unsafe usage counts.
- 401/403/422/429/529/connection/timeout classification without raw message/body
  leakage; unknown usage/cost; retries disabled; approved retry budget/backoff
  tests if later added, including `Retry-After` beyond whole deadline.
- Controlled promises/time for deadline during fetch/body/backoff/parse handoff,
  completion-vs-cancel and reversed order, freshness changes after completion,
  session collision/isolation, late rejection, repeated disposal, no unhandled work.
- Endpoint/env poisoning, redirect refusal, logging overridden off even under SDK
  debug environment, no key suffix/body/ANSI/error-cause leakage, no credential
  read on import/help/local validation, and no provider construction/network on
  doctor (only an explicitly requested local credential-presence check).
- Emitted executable with spaces/Unicode paths, stdin EOF/error, stdout/stderr
  caps/backpressure/EPIPE, cancellation and process close, no hung resources,
  no shell injection or Windows `.cmd` direct-spawn assumption. Test Windows/Linux
  and Node 22/24, not merely typecheck hypothetical portability.
- If a worker is approved: saturation/expiry, result caps/aggregate bytes, polling
  never making provider calls, owner disconnect, cross-session handles, stale
  delivery suppression, shutdown with ignoring-abort fake, no restart replay.

Future code changes require `npm run check`, removal of temporary `passWithNoTests`
on the first behavior test, and package/export changes require inspecting
`npm pack --dry-run` plus real packed executable/import tests. Update nearby docs,
shared status, and agreed ADRs in that future ownership. No such checks or package
operations are appropriate evidence of runtime behavior in this documentation task.

### Evaluation research plan (proposed, not performed)

Use the citation cookbook [S11] as evidence for **deterministic quote matching
followed by semantic relation judgment**, not for our accuracy or its “verified”
label/0.8 threshold. Its eight RFC examples use `jev-1.12` and cached published
results; not a live coding-agent or concurrency benchmark. Jev 1.13 jaggedness
[S22] documents literalness, indirection, numeric limits, distractors, adversarial
content, and option order; this page was last reviewed 2026-10-02 and contains
some older Python snippets. Treat those as risk guidance, not current JS signatures.

Before live calls, assemble approved public/synthetic fixtures and independently
labeled outcomes: source contradiction, unknown API support, omitted requirement,
implicit domain obligation, indirect necessary work, component interaction failure,
good provisional unknown, irrelevant evidence, and ambiguous/unfamiliar task.
Run input/control tests offline first. Do not use Jev itself as the ground truth.
Use holdout cases and blinded human adjudication, with question versions fixed
before scoring. Option-order/wording sensitivity comparisons and bounded repeat
runs are experimental variables with budget, not default automatic retries.
Keep harmful/security-probing fixtures offline unless the provider explicitly
permits the relevant live test under its agreements.

Measure judgment false positives/negatives (especially missed requirements),
uncertainty and evidence-sufficiency calibration, coverage omissions, useful feedback,
provider availability/contract failures, attempts, input/output usage, unknown
charges, latency distribution, and stale/unused rate. Separate service/code faults
from model errors and bad evidence/framing. Do not reward “valid JSON” as quality.

For a later verified-host comparison, hold task/host/model setup constant and compare
unassisted workflow, brief preparation without Jev (overhead/control), and consultation.
Measure task correctness/tests, rework, time to useful action and whole-task time,
LLM token usage/cost, Jev usage/cost, evidence preparation and feedback consumption,
and intervention rate. Background vs awaited consultation needs a separate host
condition, not an assumed improvement. Report billed reasoning-token metrics only
if the host/provider actually exposes them; shorter visible output does not prove
less internal compute. Publish no benefit claims until measured, reviewed, and
authorized; no evaluation was run here.

## 9. Sources reviewed and verification record

All external sources below were retrieved read-only on **2026-10-11**. Versioned
SDK source/declarations are stronger evidence for that SDK than historical snippets;
HTTP/model pages define documented server semantics; account agreements govern
legal/billing specifics. Web review is not installed-artifact, network-runtime,
live-provider, legal counsel, or host-platform verification.

- [S1: TypeSafe documentation index][S1]. Used to discover relevant current pages.
- [S2: JavaScript SDK guide][S2], [S3: HTTP API][S3], [S4: models/pricing/limits][S4].
- [S5: client configuration][S5], [request options][S5a], [retry policy][S5b].
- [S6: tagged v0.6.0 client source][S6], [types][S6a], [environment][S6b],
  [APIPromise][S6c], [models resource][S6d], [question validation][S6e],
  [errors][S6f], [logging/redaction][S6g]. Read source only, never executed.
- [S7: JavaScript changelog][S7], [S14: npm latest metadata][S14],
  [S15: versioned published ESM declarations][S15]. Snapshot latest was 0.6.0;
  CDN reading is not local installation/integrity verification of the tarball.
- [S8: state][S8], [primitives][S8a], [Noul][S8b], [confidence][S8c],
  [speculative fan-out][S8d].
- [S9: TypeSafe agent skill/distribution][S9]. Installation instructions reviewed,
  not run; no claim they install Hunchcraft.
- [S10: legal landing][S10], [S16: Privacy Policy][S16], [S17: MCA][S17],
  [S18: DPA][S18], [S19: AUP][S19], [S20: Site Terms][S20].
- [S21: Trust Center subprocessors][S21]. Page shell only; details inaccessible
  in this read, not verified.
- [S11: citation-check cookbook][S11], [S22: Jev 1.13 jaggedness][S22].
- [S12: Node 22 child-process documentation][S12] (rendered version 22.23.3):
  reviewed spawn/execFile, Windows shims, stdio, cancellation, and detached caveats.
- [S13: npm v11 package.json/bin documentation][S13] (rendered CLI 11.21.0):
  reviewed bin mapping/shebang/platform shims and package metadata.

Local verification for this task is limited to this file's formatting, source/link
review, illustrative-JSON inspection, and final scoped diff/status inspection.
No SDK install/import/run, live API/model/credential validation, scripts/source/config
change, build/test/pack, commit/publish, host runtime, or subdelegation was performed.
The final handoff records actual formatting command/results; future checks above
are requirements, not completed work.

[S1]: https://docs.typesafe.ai/llms.txt
[S2]: https://docs.typesafe.ai/sdk/javascript.md
[S3]: https://docs.typesafe.ai/api.md
[S4]: https://docs.typesafe.ai/models.md
[S5]: https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md
[S5a]: https://docs.typesafe.ai/sdk/javascript/api/interfaces/RequestOptions.md
[S5b]: https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy.md
[S6]: https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/client.ts
[S6a]: https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/types.ts
[S6b]: https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/env.ts
[S6c]: https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/api-promise.ts
[S6d]: https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/resources/models.ts
[S6e]: https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/questions.ts
[S6f]: https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/errors.ts
[S6g]: https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/v0.6.0/src/logging.ts
[S7]: https://docs.typesafe.ai/sdk/javascript/changelog.md
[S8]: https://docs.typesafe.ai/concepts/state.md
[S8a]: https://docs.typesafe.ai/primitives.md
[S8b]: https://docs.typesafe.ai/primitives/noul.md
[S8c]: https://docs.typesafe.ai/confidence.md
[S8d]: https://docs.typesafe.ai/patterns/fan-out.md
[S9]: https://docs.typesafe.ai/agent-skill.md
[S10]: https://docs.typesafe.ai/legal.md
[S11]: https://docs.typesafe.ai/cookbooks/citation_check.md
[S12]: https://nodejs.org/docs/latest-v22.x/api/child_process.html
[S13]: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin
[S14]: https://registry.npmjs.org/@typesafe-ai%2fsdk/latest
[S15]: https://unpkg.com/@typesafe-ai/sdk@0.6.0/dist/index.d.mts
[S16]: https://typesafe.ai/legal/privacy-policy
[S17]: https://typesafe.ai/legal/mca
[S18]: https://typesafe.ai/legal/data-processing
[S19]: https://typesafe.ai/legal/acceptable-use-policy
[S20]: https://typesafe.ai/legal/terms
[S21]: https://trust.typesafe.ai/subprocessors
[S22]: https://docs.typesafe.ai/model-jaggedness/jev-1.13.md
