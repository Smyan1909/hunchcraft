# Architecture

## Goal

Explore a decision layer that assists existing coding agents through both explicit
consultation and automatic/background evaluations; not every judgment must be
asynchronous. Pursue separation of LLM proposal/decomposition from Jev evaluation,
rather than only reviewing completed work. Jev supplies bounded typed judgments;
Hunchcraft code owns its execution, scheduling, and result-consumption policy.

Use supported plugins or a skill plus CLI without reworking fundamental host code,
requiring a custom harness or fork, or replacing the main model. This boundary is
accepted in [ADR 0002](decisions/0002-existing-agent-extension.md). The accepted
delivery direction is now CLI-first portable foreground consultation, followed by
opt-in host-specific adapters. Human scoped session/repository consent governs
selected original-request and excerpt disclosure to Jev. No native host adapter is
selected or runtime-verified. The repository implements internal core, consult/verify
and TypeSafe provider contracts for offline testing, not a public consultation
capability; reduced deliberation, cost or elapsed time is unmeasured.

## Design and delivery references

Read [system design](system-design.md) first for the canonical **proposed v0**
contract, then [implementation plan](implementation-plan.md),
[evaluation plan](evaluation-plan.md), and supporting
[host](research/agent-integration.md) / [provider](research/jev-cli.md) research.
Research records documentation/source inspection dated 2026-10-11, not runtime
validation. [Discussion](design-discussion.md) preserves the conceptual history.
[ADR 0001](decisions/0001-typescript-foundation.md) and ADR 0002 remain accepted.

The planning packet is reconciled and independently reviewed; M1 grammar/compiler/
identity rules are frozen under [ADR 0003](decisions/0003-cli-first-bounded-consultation.md).
M1a baseline `3eef99a` is independently reviewed and locally verified against planning
revision `5f1af21`. M1b/M2 source and offline tests now exist under the
[frozen handoff](implementation-notes/m1b-m2.md). M1b false-acknowledgment and
private-brand exception fixes, M2 timer/listener disposal settlement and metadata
exception handling are resolved/rechecked. The offline M1b/M2 milestone is complete:
implemented, reviewed and locally verified; final docs verification/Git synchronization
remain. Bounded offline M1–M3 work is authorized, with M1b/M2 completion required
before CLI work. Next is M3 offline Windows ACL/root-identity feasibility,
then secure storage and CLI/skill wiring; no production
fake-success flag. The wider v0 contract remains proposed and not fully implemented. Schema,
check limits, defaults, and command details are coordinated implementation choices,
not individual user-picked policies or a released API. No CLI command in the design
is runnable today. Host execution, live/paid inference, datasets, evaluation, automation
expansion, and release remain separately gated; no live/evaluation budget is approved.

### Implemented internal core: M1a

See [the core README](../src/core/README.md) for module contracts:

- `src/core/strict-json.ts`: bounded fatal UTF-8 decoding and strict JSON parsing,
  including decoded-key duplicate detection and exact safe-integer validation.
- `src/core/brief.ts`: closed brief reconstruction, bounds, reference/quote
  consistency, lexical locators, and frozen returned objects/arrays.
- `src/core/checks.ts`: mandatory checks in canonical order, bindings, shared-state
  projection, and byte/check caps without silent truncation.
- `src/core/identity.ts`: canonical text and owned UTF-8 bytes; hashing is injected
  by application, not Node crypto in core.

These modules have no package-root exports, SDK dependencies, I/O, or network calls.
Caller-supplied provenance is not authenticated; identity representation alone is
not a consent or freshness check. M1a verification is prior baseline evidence, not
the final M1b/M2 integration result. Meaningful offline Vitest suites replace the
empty-suite allowance. The orchestrator's integrated `npm run check` passed on
Windows/Node 24.18.1/npm 12.2.0: **345 tests across 13 files**, types/lint,
architecture (**19 modules/81 dependencies**), build and actual exports/declarations.
`npm pack --dry-run` passed with **95 files**, excluding dummy keys/test fakes; the
SDK is declared, not bundled. No Linux/Node 22 local run or new-code CI result is
asserted; prior `3eef99a` CI success is baseline evidence, not this integration.

### Implemented internal consultation and provider boundary: M1b/M2

- **Core:** `result.ts` reconstructs closed Noul/Score answers, failures, progress,
  judgments/bindings and completed envelopes; all raw signals and static feedback
  remain advisory, without filtering or action approval. `consent.ts` owns pure
  disclosure/session/UUID rules and repository-binding values. `value.ts` supplies
  narrow own-data inspection, not a schema framework or JavaScript sandbox.
- **Ports:** `clock.ts`, `decision-provider.ts` and `session-consent.ts` define
  SDK-free scheduling, guarded evaluation/progress and owned admission/finalization.
  Real filesystem observations, durable consent storage and interprocess fencing
  remain M3 responsibilities; an injected observation is not source authentication.
- **Application:** `operation.ts`, `consult.ts` and `verify.ts` implement injected
  clock/hash/consent/provider orchestration. Consult owns a 15-second operation bound,
  one evaluation guard, final scope/time checks, private-copy byte preparation and
  UUID-bound completion. One 1-second cleanup grace reports unconfirmed persistence
  rather than pretending a hung adapter released its slot. `ready` means prepared
  and committed, not emitted or consumed. Verify is read/hash-only and compares the
  complete current compilation, identity and recorded completed timestamps; it does
  not infer, write, authenticate provider origin or grant permission to act.
- **TypeSafe provider:** `configuration.ts`, `transport.ts` and `provider.ts` use
  locked `@typesafe-ai/sdk@0.6.0`, the sole runtime dependency. SDK types stay here.
  Lazy explicit configuration forces the fixed origin/model, logging off and retries
  zero; the wrapper permits one underlying request with redirects refused. Both
  application and SDK attempt signals govern guard/fetch/body receipt. Success and
  error response streams are capped at 256 KiB of decoded bytes; strict UTF-8/JSON
  checks precede SDK parsing and runtime answer reconstruction. Fixed failures retain
  validated progress/usage, never raw SDK prose, headers, causes or credentials.
  Timer/listener disposal exceptions cannot strand settlement: each removal is
  attempted and resolution occurs in `finally`. A disposal fault changes success
  to fixed `internal_failure`, preserving an already selected failure and validated
  metadata. Cleanup remains best effort when injected disposal fails, not a guarantee
  of timer removal or reclamation of ignoring-abort dependencies.

See [application](../src/application/README.md), [ports](../src/ports/README.md),
[TypeSafe](../src/providers/typesafe/README.md) and [tests](../tests/README.md).
Tests inject fixture consent/clocks/providers or the real SDK through fake HTTP.
`test-fixture` and `provider-http` provenance stay distinct; fake-HTTP observations
are not evidence of network transmission or billing. Missing usage/cost is unknown,
not zero; quality, latency benefit and savings are unmeasured. No public root API,
CLI/bin, secure storage, production composition, shipped consultation skill, host
adapter, live inference or evaluation runner exists. Credentials come later through
human environment provisioning, never chat/argv/skills/logs. Offline M1b/M2 mechanics
do not open live admission or authorize a paid call.

## Dependency direction

```text
composition -> integrations -> application -> ports -> core
composition -> providers ------------------> ports -> core
```

An arrow means "may import"; a layer may also import the inner layers shown to
its right. Providers do not depend on application. Integrations receive providers
through injected ports. Tests may inject fake capabilities; production failure must
never become a fake successful judgment. Providers adapt external capabilities,
not only Jev evaluation: the proposed `providers/local-state` owns concrete consent
storage while pure policy stays in core and orchestration stays in application.

| Layer                    | Owns                                | Must keep outside                         |
| ------------------------ | ----------------------------------- | ----------------------------------------- |
| `core`                   | Domain values and pure policies     | SDKs, I/O, process globals                |
| `ports`                  | Interfaces needed by use cases      | Concrete backend and host implementations |
| `application`            | Scheduling and consuming decisions  | Concrete providers, host hooks            |
| `providers/<backend>`    | External capability translation/I/O | Application policy, sibling adapters      |
| `integrations/<surface>` | CLI/host input and result delivery  | Provider construction, sibling adapters   |
| `composition`            | Explicit wiring and configuration   | Domain policy that belongs in core        |

`npm run lint:architecture` checks this direction, provider and integration
isolation, cycles, unresolved imports, and runtime imports of development tools.
These checks also inspect type-only imports; SDK types should not leak inward.

The single root package keeps setup simple. Split packages only when independent
release cycles, consumer dependencies, or build environments justify that cost.
Keep `src/index.ts` host-independent; add explicit package subpaths for implemented
provider or host entry points. Importing an entry point must not start background work.

## Asynchronous lifecycle design

M1b implements the internal one-shot lifecycle against injected dependencies;
default offline tests cover races, late-result suppression and owned cleanup. M3
must still implement durable admission and process output. Proposed v0 permits one
in-flight consultation per session and no waiting queue, worker or watch loop. Its
exact deadline, cancellation, identity, consent and output rules belong to
[system design](system-design.md). The broader constraints below remain design
requirements for later background adapters, not evidence of shipped automation:

1. Capture the minimum sufficient observed state, session identity, and a revision
   or fingerprint. Distinguish facts from earlier model inferences.
2. Schedule narrow judgments with bounded concurrency and queue size. Batch
   independent questions over the same state when useful; dependent questions
   require another request after their evidence becomes available.
3. Keep the main agent moving through an actual supported host extension surface.
   Investigate which callbacks the host awaits before claiming work is asynchronous.
4. Associate each result with its request and source revision. Check freshness and
   applicability immediately before consumption; an earlier result may finish last.
5. Define timeout, cancellation, replacement, and provider-failure behavior. A
   stalled assistant layer should not indefinitely stall the main agent.
6. Initialize explicitly and expose disposal. Track and handle every background
   promise; stop intake, cancel work, release listeners, and ignore late completions
   on shutdown. Keep simultaneous agent sessions isolated.
7. Record decision quality, wall-clock impact, model usage/cost, queue pressure,
   and stale/unused results. Evaluate any future thresholds on representative cases;
   proposed v0 renders all raw judgments without numeric filtering.

The [implementation plan](implementation-plan.md) sequences offline core/provider/
CLI work before separately approved host smoke and live judgment studies. The
[evaluation plan](evaluation-plan.md) compares an unchanged host, matched scaffolding
without Jev advice, and scaffolding with Jev. Later background work needs its own
verified observation/await/delivery path and approval; foreground value is not
asynchronous-value evidence.

## Agent instructions versus execution

Development skills instruct agents contributing to Hunchcraft. A shipped skill
can teach an agent how to consult a CLI, but does not itself run a worker. A plugin
and a skill plus CLI have different runtime and lifecycle contracts; investigate
supported observation, await, and result-delivery mechanisms before choosing one.
No host capabilities are established by these design notes.

Explicit consultation may wait for a judgment; background evaluation needs an actual
runtime mechanism. Automatic observation does not imply access to private reasoning
or the ability to inject signals into an in-flight model generation. An agent can
deliberately emit a compact, decision-relevant task artifact without exposing or
recovering private chain-of-thought. Instructions and tools may encourage early
consultation in an unchanged host, but cannot guarantee interception or reasoning
savings. Short visible output alone does not establish reduced internal compute.
