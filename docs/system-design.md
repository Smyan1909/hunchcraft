# System design: stateless portable consultation

**Revised 2026-10-25. S1/S2 implemented and reviewed offline; not released.** The user accepted
a stateless CLI with an environment-provisioned key and requested a simpler plan.
[ADR 0004](decisions/0004-stateless-portable-consultation.md) records that decision.
The behavior below is the implemented S1/S2 contract, not live-call authorization
or proof of all-platform support or semantic usefulness. S3 packed installation is
verified locally; corrected remote platform coverage remains pending.

## 1. Purpose and boundary

An existing coding agent or human supplies a compact proposal and selected evidence.
Hunchcraft validates it, asks Jev bounded questions, returns typed advisory judgments,
and exits. It does not run a coding agent, inspect a repository, or execute advice.

The key is the only service-specific setup requirement. Execution also requires the
installed CLI, supported Node.js, valid input, network access and a usable provider
account. Target macOS, Linux and Windows on hardware supported by Node.js. Test actual
platforms before claiming support. This is not offline inference or universal hardware support.

## 2. CLI

```text
hunchcraft --help
hunchcraft validate < brief.json
hunchcraft consult < brief.json
```

These commands and [usage documentation](usage.md) are implemented. S3 actual packed
installation is verified locally on macOS/Node 22/24; corrected remote CI remains pending.

| Command    | Behavior                                                         | Credentials/network                    |
| ---------- | ---------------------------------------------------------------- | -------------------------------------- |
| `--help`   | Explain usage, disclosure and limits                             | Neither                                |
| `validate` | Parse and compile the supplied brief; return a validation result | Neither                                |
| `consult`  | Validate, configure, evaluate once, return judgments             | `TYPESAFE_API_KEY` and provider access |

Read one bounded JSON document from stdin, ending at EOF. Do not accept source or keys
in arguments. Reject unknown commands/options and extra positional arguments. No file
flags, repo configuration, initialization wizard or interactive prompt is required.
Use JSON stdout for validation, judgment or sanitized failure results. Help is text.
Terminal stderr diagnostics are deliberately omitted: inherited stderr can block too.
Failures never include input, credentials, SDK prose or stacks.
Terminal lifetime failures are an exception: stdout may be empty or incomplete.
Only consume output after a successful process close and complete JSON validation.

The planned exit classes are: `0` valid/completed, `2` invalid input/arguments or check
overflow, `3` missing/conflicting configuration, `4` provider failure, `5` deadline,
`130` local interruption, and `1` local I/O/internal failure. Semantic adverse answers
still exit `0`: they are judgments, not a failed command or permission decision.

## 3. Disclosure and credentials

Explicitly invoking `consult` authorizes transmission of its supplied input under the
documented disclosure. A coding agent must operate within a human-authorized workflow.
The CLI cannot authenticate whether an invocation expresses the human's intent.
It does not solve malicious same-user processes or inherited credential misuse.

Key presence alone must never trigger scanning, inference or automatic disclosure.
Help, import and validation do not read credential values or initialize the provider.
Read the key lazily for `consult`. Do not write it to disk, echo it, accept it in argv,
or embed it in instructions. Do not implement a key vault or credential broker.

Transmit only compiled questions and the supplied inner brief state. Preserve the
original request and selected excerpts. Treat source and optional questions as data,
not instructions. Caller-selected evidence may still contain secrets: lexical checks
are not a complete secret detector. The caller must select material they may disclose.
Provider processing/retention and ordinary SDK protocol/runtime metadata still apply.
Stateless means no Hunchcraft-managed persistence, not provider zero retention.

## 4. Input and check reuse

S1 implements this closed outer envelope:

```text
{ "schemaVersion": "hunchcraft.brief.v1", "brief": <BriefState> }
```

Remove `scopeId`, `requestId` and `context` from the public input. They existed for
session admission/correlation and are not required for this one-shot path. Reject the
old v0 envelope rather than silently fabricate session fields or reinterpret it.

Retain `BriefState` fields, reference/quote validation, literal compiler questions,
ordering and bindings from [legacy sections 6–7](system-design-legacy.md#6-brief-schema-provenance-and-strict-parsing)
and the implemented [brief](../src/core/brief.ts)/[compiler](../src/core/checks.ts).
This includes 1–3 components and at least one evidence excerpt. Changing that inner
artifact to support other tasks is a separate decision, not necessary for portability.

Retain strict UTF-8/JSON, unknown-field and duplicate-key rejection, scalar/numeric
checks and finite entity/text bounds. Initial limits remain 48 KiB input, 32 KiB
compiled state, 16 KiB compiled questions and 16 checks. Reject overflow; do not trim
away required checks. Two whole-proposal checks remain even without extracted
requirements or optional questions. Noul and Score 0–2 remain the supported primitives.

## 5. One-shot execution and failures

```text
read -> validate/compile -> configure -> evaluate once -> validate answers -> write -> exit
```

Start the whole-operation deadline before input reading. Retain the proposed 15-second
bound through output, with at most 10 seconds for the provider attempt and a bounded
cleanup grace of at most 1 second. Never wait indefinitely for EOF, fetch, a body or a
blocked output pipe. Observe rejected/late promises and suppress late success.

One caller-owned Operation spans input through output; consultation borrows it and
does not reset the deadline or dispose it. Ordinary failure JSON may start only while
the original output checkpoint succeeds. After deadline, interruption or invariant
termination, start no stdout delivery; dispose and terminate with the selected exit code.
No extra cleanup/output deadline or grace is allowed; the provider alone owns its
existing at-most-one-second grace.

Parent code never writes stdout/stderr descriptors. Fence output as attempted before
spawning/sending to one invocation-owned Node output child. After any attempt, never
emit a replacement envelope, even if delivered bytes are unknown. A live output failure
exits `1`; deadline/interruption during output exits `5`/`130`. The child validates one
bounded IPC message and handles short writes. Success requires exact byte acknowledgment,
successful send, observed child exit 0 and a fresh original-Operation checkpoint.
Failure kills/disconnects a live owned child without awaiting exit after termination,
restart or additional grace. Late callbacks cannot restart output. Controlled parent
exit belongs only to executable termination after disposal. The worker inherits no
credentials or preloads. See [ADR 0005](decisions/0005-invocation-owned-output-process.md)
for the failed callback-write evidence, minimal environment and reclamation limits.
Local macOS blocked-pipe and packed-install tests pass; corrected remote platform
coverage remains pending. Test-only FIFO saturation avoids Unix socket buffering
assumptions; no platform helper is added to production.

Retain the existing pinned `jev-1.13.0`/`https://api.typesafe.ai` policy, SDK logging off,
zero retries, one underlying dispatch, redirects refused and 256 KiB response cap.
Composition supplies explicit clock/fetch/configuration dependencies. No arbitrary
environment endpoint/model override may redirect the key. Recheck live provider docs
before implementation changes to the provider and separately approved live use.

Live documentation was read on 2026-10-25: [index](https://docs.typesafe.ai/llms.txt),
[JavaScript SDK](https://docs.typesafe.ai/sdk/javascript.md) and
[state](https://docs.typesafe.ai/concepts/state.md). The current SDK guide references
v0.7.0, while this repository locks v0.6.0. This retake does not upgrade the SDK or
adopt newer compression/image behavior; installed locked types remain implementation evidence.

The dispatch guard enforces cancellation, remaining time and one invocation's dispatch
bound. It does not check a session record. Independent processes are independent:
there is no shared queue, deduplication, call cap, revocation or hard dollar ceiling.
Retrying the CLI can create another charged request, including after ambiguous failure.
Timeout/abort does not guarantee remote cancellation or stopped billing.

Validate complete Noul/Score answers and preserve all raw judgments in compiler order.
Keep contradiction, missing evidence, uncertainty and service failure distinct. Unknown
usage remains unknown, not zero. Errors never produce synthetic successful judgments.

## 6. Results and use

S1 implements these closed `hunchcraft.result.v1` variants. Angle-bracket values below are
type placeholders, not literal JSON. No extra fields are accepted.

```text
Validation:
{schemaVersion:"hunchcraft.result.v1", kind:"validation", status:"valid",
 checkSetId:"component-outline.v0", checkCount:<integer 6..16>}

Completed:
{schemaVersion:"hunchcraft.result.v1", kind:"judgment", status:"completed",
 checkSetId:"component-outline.v0", policyVersion:"hunchcraft.policy.v1",
 provider:{name:"typesafe", sdkVersion:"0.6.0", requestedModel:"jev-1.13.0",
           returnedModel:"jev-1.13.0", requestId:<validated string or null>,
           attempts:1, usage:<Usage>, costEstimate:null},
 checks:<JudgmentCheck[] in compiler order>}

Failure:
{schemaVersion:"hunchcraft.result.v1", kind:"error", status:"failed",
 error:{code:<fixed failure code>, message:<matching sanitized fixed message>},
 provider:{attempts:<0 or 1>, requestId:<validated string or null>,
           usage:<Usage or null>, costEstimate:null}}
```

`Usage` retains `{inputTokens, outputTokens}`, each a nonnegative safe integer.
Unknown usage is null as a whole in failure results, not fabricated counters. Retain
the provider's existing success-response usage contract. `JudgmentCheck` retains the
closed `CompiledCheck` fields plus the validated
`answer` and static `feedback` defined in [result.ts](../src/core/result.ts).
Reuse its answer/usage/request-ID bounds and exact routing; fixtures must test every
variant and reject additional/missing fields. Before dispatch, failure metadata is
zero attempts/null request ID/null usage. After dispatch, retain independently valid
progress even on failure; unknown usage stays null. Only real-provider origin can
be projected as a production completed result. Test fakes remain internal.

Retain existing fixed codes for invalid input/check overflow, configuration,
provider/response failures, timeout, cancellation, local I/O/output and internal
failure. Retire consent/session/storage and stale/expiry failures from this public
contract. Keep `clock_inconsistent` only for observed in-process clock faults, not
durable freshness checks. Exit classes remain those in section 2. Version policy v1
for the changed execution contract; literal `component-outline.v0` checks are unchanged.
Update fixed messages that mention v0 or stored timestamps to describe v1/in-process
behavior. Freeze those sanitized literals consistently in parser and result tests.

Results contain no session/root binding, persisted completion receipt, TTL claim,
raw provider error or generated explanation attributed to Jev. S1 freezes regression
fixtures for these shapes before CLI wiring. Do not wrap the old
session-bound envelope as if it were the new result.

Results describe only the supplied snapshot. A hash cannot authenticate source reads
or prove current repository state. For this initial path, the consumer tracks the
submitted material and discards advice if the request, proposal or evidence changes.
There is no public `verify` command or durable freshness ledger. The CLI cannot enforce
future model compliance. A positive judgment is never correctness certification or
action permission, and never excuses removing necessary tests or skipping verification.

Buffer and validate the complete bounded output before emission; retain the 256 KiB
output cap. If emission fails after partial bytes, do not append a replacement envelope.
Exit nonzero; stderr may be empty. Consumers
wait for successful process close and validate the complete JSON before use. A write
callback is not evidence that a host consumed the result.

## 7. Explicitly outside this milestone

- Persistent sessions, grant/revoke/status commands, consent files, locks and crash recovery.
- OS ACL helpers, filesystem-root identity, automatic repository discovery and secure storage.
- Global attempt budgets, duplicate/replay suppression, caches, durable metrics and trace logs.
- Required public library API, shipped skill, installer framework or host adapter.
- Persistent background workers, watch loops, MCP, model replacement and evaluation infrastructure.
  One foreground invocation owns a short-lived output child only (ADR 0005).

These are not secretly required later. Reintroduce one only for a demonstrated need
and a separate decision. Basic usage documentation belongs with the CLI milestone.

## 8. Implementation boundary and authorization

At `cde4ef8`, the old core, injected session-based consult/verify and TypeSafe provider
were implemented and offline-tested. S1 now implements stateless application/result/input
contracts directly and retires obsolete modules. No fake consent/reservation records
are used. S2 implements CLI/bin and explicit Node composition; S3 adds actual packed-
install/shim checks and public usage/example. Corrected remote CI remains pending.

The planning retake changed documentation only. The user subsequently authorized
implementing the bounded offline slices in [implementation plan](implementation-plan.md)
and saving reviewed, verified milestones to GitHub. No live model calls, host runs,
datasets, publication or paid evaluation are authorized by this plan.
For future users, an explicit invocation governs input disclosure; for project agents,
the current no-live execution restriction remains in force.
