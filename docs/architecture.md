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
selected or runtime-verified. The repository remains a foundation with no functional
decision capability; reduced deliberation, cost, or elapsed time is unmeasured.

## Design and delivery references

Read [system design](system-design.md) first for the canonical **proposed v0**
contract, then [implementation plan](implementation-plan.md),
[evaluation plan](evaluation-plan.md), and supporting
[host](research/agent-integration.md) / [provider](research/jev-cli.md) research.
Research records documentation/source inspection dated 2026-10-11, not runtime
validation. [Discussion](design-discussion.md) preserves the conceptual history.
[ADR 0001](decisions/0001-typescript-foundation.md) and ADR 0002 remain accepted.

The planning packet is reconciled and independently reviewed; M1 grammar/compiler/
identity rules are frozen for offline implementation in
[ADR 0003](decisions/0003-cli-first-bounded-consultation.md).
The latest user authorization supersedes the earlier exploration-before-planning
restriction: after planning todos, independent review/fixes, verification, and the
orchestrator's reviewed planning milestone push, bounded offline M1–M3 work may begin.
Start with M1a strict brief validation/compiler/identity fixtures and the first Vitest
behavior tests, then M1b internal fake consultation. Schema, check limits, defaults,
and command details are proposals to select/freeze through coordinated review, not
individual user-picked policies or a released API. No CLI command in the design is
runnable today. Host execution, live/paid inference, datasets, evaluation, automation
expansion, and release remain separately gated; no live/evaluation budget is approved.

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

These are design constraints, not implemented behavior. Proposed v0 is one-shot
foreground execution with one in-flight consultation per session and no waiting
queue, worker, or watch loop. Its exact deadline, cancellation, identity, consent,
and output rules belong to [system design](system-design.md). For later background
adapters, preserve these broader constraints:

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
