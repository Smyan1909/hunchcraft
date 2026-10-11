# Hunchcraft: shared bootstrap context

Loaded by project OpenCode for all development agents. Keep this short and current.
Repository evidence and the latest user instruction supersede stale status or
authorization wording, including older exploration-only notes.

## Mission and accepted choices

- Fast hunches. Deliberate agents. Explore LLM proposal/decomposition paired with
  TypesafeAI's Jev judgments, not only review of completed work. Savings are a
  hypothesis, not a result; short visible output is not compute evidence.
- **CLI first:** portable explicit foreground consultation, then opt-in host-specific
  adapters. No native host is selected or runtime-verified. Extend unchanged hosts;
  no custom harness, fork, fundamental host rework, or main-model replacement.
  [ADR 0002](decisions/0002-existing-agent-extension.md) preserves that boundary.
- **Human scoped session/repo consent:** selected original-request material and actual
  source excerpts may be disclosed to Jev under minimized, documented disclosure.
  A key, skill, or agent assertion is not consent; actual live transmission is gated.
- Hunchcraft owns reusable criteria; user/repo conventions supply contextual standards;
  the LLM supplies proposals and optional neutral questions; code instantiates known
  subjects; Jev judges. Early plausible mechanisms may retain explicit unknowns.
  Contradiction, missing evidence, model uncertainty, and service failure stay distinct.
- Jev supports Choice, Score, and Noul; proposed v0 uses Noul and Score only. Judgments
  are advisory, not explanations, correctness certification, or action permission.
- TypeScript ESM, one npm package, strict types, inward dependencies, npm lockfile,
  and MIT remain accepted. See [ADR 0001](decisions/0001-typescript-foundation.md).

## Reading order and current status

1. [System design](system-design.md): canonical **proposed v0** contract.
2. [Implementation plan](implementation-plan.md): slices, handoffs, readiness gates.
3. [Evaluation plan](evaluation-plan.md): proposed controls and future execution gates.
4. Research: [host integration](research/agent-integration.md),
   [Jev/CLI](research/jev-cli.md), and evaluation sources in the evaluation plan.

The planning packet is reconciled and independently reviewed. M1 grammar, literal
templates, bindings, and canonicalization are frozen for offline implementation;
see [ADR 0003](decisions/0003-cli-first-bounded-consultation.md). Commands and limits
remain unreleased, not runnable features or settings individually picked by the user.
Do not create competing contracts from research sketches. M3 secure-state feasibility
and all live/evaluation gates remain unresolved.

**M1b/M2 are complete offline: implemented, reviewed and locally verified**, atop `3eef99a`
and planning revision `5f1af21`. [Core](../src/core/README.md) adds closed results,
consent and owned values; [application](../src/application/README.md) implements
injected consult/verify; [M2](../src/providers/typesafe/README.md) uses the real locked
SDK through fake HTTP. See the [frozen handoff](implementation-notes/m1b-m2.md).
All findings are resolved/rechecked: M1b false acknowledgments/private-brand exceptions,
M2 timer/listener disposal settlement and metadata exception handling. The orchestrator
owns final documentation verification and Git synchronization; inspect history for the
milestone commit rather than assuming a previous session's hash.
No functional public API, CLI/bin, secure local-state storage, production composition,
shipped consultation skill, host adapter, background loop, live inference, evaluation
runner or measured outcome exists. Research is docs/source/types, not host execution.

`src/` separates core, ports, application, providers, integrations, and composition.
Local-state storage remains proposed. Inner contracts stay SDK-free; concrete wiring
belongs in composition. `@typesafe-ai/sdk@0.6.0` is the sole runtime dependency;
TypeScript 6.0.3 stays pinned. Imports are inert; offline suites use fixture providers
or real-SDK/fake-HTTP boundaries, never production fake success. `provider-http`
metadata through fake HTTP is not network/billing evidence; missing usage/cost stays
unknown, not zero. `passWithNoTests` is removed. Development: Node 22.13+ on 22.x or
Node 24.x; runtime floor 22.12.0. Orchestrator integrated `npm run check` passed on
Windows/Node 24.18.1/npm 12.2.0: **345 tests/13 files**, types/lint/architecture
(19 modules/81 dependencies), build and actual exports/declarations. Pack dry-run
passed: **95 files**, no dummy keys/test fakes; SDK declared, not bundled. No Linux/
Node 22 local run or new-code CI result is asserted; `3eef99a` CI is baseline only.
CI targets Node 22/24 on Windows/Linux. Inspect Git/Actions after synchronization.

## Delivery phases and authorization

The latest user requires **M1b and M2 before starting the CLI**; both offline source
slices are now reviewed/locally verified. Next is M3 offline feasibility. Credentials
come later via human environment provisioning, never pasted into chat/argv/skills/logs.

- **D0 complete:** reviewed planning milestone `5f1af21`; M1 contract frozen.
- **M1a complete:** internal core implemented, independently reviewed and locally
  verified. Offline fixtures establish mechanics, not semantic quality or savings.
- **M1b/M2 complete offline:** bounded consult/verify,
  progress/guard/cleanup and strict TypeSafe configuration/transport/answers; no live use.
- **M3 next:** offline Windows ACL/root-identity feasibility, then
  secure local-state admission, CLI/bin/package composition and shipped skill. Platform
  feasibility must precede production wiring; do not weaken privacy to claim support.
- **Later, separately approved:** named-host smoke, live judgment calibration,
  controlled end-to-end evaluation, optional background adapter, broader distribution.

**No live/evaluation budget is authorized.** Paid/live Jev or main-model calls,
private-data transmission, host runtime launches, dataset acquisition, benchmarks,
automation expansion, releases, npm publication, PRs, and outreach require their
own approval. Offline fakes prove contract mechanics, not semantic quality or savings.
Coverage of implicit obligations/unfamiliar tasks, account terms/retention, total
spend enforcement, and actual host consumption remain open live/evaluation gates.

## Team handoffs

Development collaborators are not runtime agents; skills do not run workers or expose
private reasoning. Chain: architect → evaluator design → developer → reviewer →
developer fixes → reviewer recheck → evaluator where measured → marketer → orchestrator.
Reuse reviewed inputs for small slices; specialists never recursively delegate.

Assignments supply goal, reviewed revision, exact files, acceptance tests, allowed
operations, checks, and expected output. Serialize shared contracts/configuration;
parallel writers need disjoint ownership. Preserve concurrent work; return scope
and authority/data-sharing decisions to the orchestrator.

Use `AGENTS.md`, [architecture](architecture.md), layer READMEs, ADRs, and applicable
skills. Report checks actually run and distinguish source evidence from measurement.
The orchestrator owns ongoing authorized **reviewed, verified code/docs commits and
pushes** to `Smyan1909/hunchcraft`; inspect status, diff, recent history, intended files,
and credentials before committing. Specialists do not commit/push or publish.
