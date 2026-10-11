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
- Repository: <https://github.com/Smyan1909/hunchcraft>.

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

**Implementation remains foundation only:** tooling, layer boundaries, contributor
docs, development skills, and the OpenCode team. No functional public API, CLI, Jev
provider, shipped consultation skill, host adapter, background loop, evaluation runner,
or measured outcome exists. Research dated **2026-10-11** inspected documentation,
source/types, and metadata; it did not run hosts or authenticated model requests.

`src/` separates core, ports, application, providers, integrations, and composition.
Providers include proposed external local-state storage as well as Jev. Inner
contracts stay SDK-free; imports are inert; concrete wiring belongs in composition.
Default tests are offline; the empty suite is temporarily allowed. TypeScript 6.0.3
is pinned for typescript-eslint compatibility. Development: Node 22.13+ on 22.x or
Node 24.x; package runtime floor: 22.12.0. CI is configured for Node 22/24 on
Windows/Linux. Prior foundation checks passed locally on Windows/Node 24.18.1.
Planning verification: `npm run format:check`, whitespace checks, local-link inspection,
independent technical review/recheck, and M1a implementability review passed. Mermaid
figures were inspected as text, not runtime-rendered. Inspect git status and GitHub
Actions before assuming files are pushed or a current remote CI run passed.

## Delivery phases and authorization

The latest user authorizes detailed planning/research and **actual offline
implementation after current todos and planning are complete**. No redundant
permission to start an in-scope M1 slice is required once that readiness gate closes.

- **D0:** planning review, reconciliation, and M1 freeze complete; orchestrator verifies
  and pushes the planning milestone before starting source work.
- **M1a next:** strict brief parsing/validation, mandatory check compiler, pure identity
  representation, and first meaningful Vitest fixtures; remove `passWithNoTests`.
- **M1b:** internal consultation/verify with injected consent/hash/clock/fake provider;
  no production fake-success flag, hidden network, worker, or host launcher.
- **M2–M3:** reviewed offline Jev boundary, secure local-state admission, CLI/package
  and consultation guidance. Windows ACL/root identity feasibility remains an offline
  platform gate before production wiring; do not weaken privacy to claim support.
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
private reasoning. The orchestrator coordinates architect →
evaluator design → developer → reviewer → developer fixes → reviewer recheck →
evaluator where measured → marketer → orchestrator integration. Reuse reviewed inputs
for small slices; specialists return handoffs, never recursively delegate.

Every assignment supplies goal, reviewed revision, exact owned files, acceptance
tests, allowed operations, required checks, and expected output. Serialize shared
contracts/configuration; parallel writers need disjoint ownership. Preserve concurrent
work. Return scope changes and authority/data-sharing decisions to the orchestrator.

Use `AGENTS.md`, [architecture](architecture.md), layer READMEs, ADRs, and applicable
skills. Report checks actually run and distinguish source evidence from measurement.
The orchestrator owns ongoing authorized **reviewed, verified code/docs commits and
pushes** to `Smyan1909/hunchcraft`; inspect status, diff, recent history, intended files,
and credentials before committing. Specialists do not commit/push or publish.
