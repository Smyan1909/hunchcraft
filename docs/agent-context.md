# Hunchcraft: shared bootstrap context

This file is loaded by the project OpenCode configuration for all agents. Keep it
short and current after meaningful milestones. Repository files and the latest
user instruction take precedence over stale status notes.

## Mission and choices

- Explore whether fast System One judgments can enhance existing coding agents
  through explicit consultation and automatic/background evaluations, and eventually
  generic agents. Not every judgment must be asynchronous.
- Extend unchanged hosts through supported plugins or a skill plus CLI; no custom
  harness, host fork, fundamental host rework, or main-model replacement. See
  [ADR 0002](decisions/0002-existing-agent-extension.md). Host and surface remain open.
- Pursue LLM proposal/decomposition paired with Jev evaluation, not just background
  review. Reduced main-model deliberation or cost is a hypothesis, not a result.
- Early proposals may use plausible mechanisms with explicit unknowns; strengthen
  evidence as decisions become concrete. This is not implementation proof or permission
  to assume unsupported capabilities. Known source conflicts remain distinct from gaps.
- The high-level responsibility split is agreed: Hunchcraft reusable criteria,
  contextual user/repo standards, LLM proposal material and optional neutral questions,
  mechanical instantiation of known subjects, and Jev evaluation. Concrete rubric,
  schema, algorithm, check selection, and signal authority remain open.
- Initial decision model: TypesafeAI's Jev. It returns Choice, Score, and Noul
  answers and probabilities; Hunchcraft code owns scheduling and actions.
- TypeScript ESM, one npm package, strict typing, human-readable decoupling, npm
  lockfile, and MIT license are accepted choices.
- Project repository: <https://github.com/Smyan1909/hunchcraft>.

## Current implementation

The foundation provides tooling, layer boundaries, contributor/architecture docs,
project skills, and the OpenCode agent team. No functional public capabilities,
host adapters, Jev provider, background loop, or benchmarks are implemented yet.

`src/` separates core, ports, application, providers, integrations, and composition.
Do not mistake layer READMEs or design constraints for implemented features.
TypeScript 6.0.3 is pinned for current typescript-eslint compatibility. CI is
configured for Node 22/24 on Windows/Linux. Default tests are offline; the empty
suite is temporarily allowed until the first behavior test.

The foundation passed `npm run check` and `npm pack --dry-run` locally on Windows
with Node 24.18.1. CI configuration is not evidence of completed remote CI runs.
Inspect git status before assuming files are committed or pushed.

The discussion-documentation milestone passed independent technical review and
`npm run format:check`. No implementation, live model experiment, or host runtime
verification was performed for that milestone.

The initial GitHub publication snapshot passed `npm run check` and
`npm pack --dry-run` on Windows with Node 24.18.1, plus independent repository and
credential/artifact review. Tests still contain no behavior cases. Development uses
Node 22.13+ on 22.x or Node 24.x; the package runtime floor remains 22.12.0. Inspect
GitHub Actions for remote CI outcomes rather than assuming they passed.

## Current discussion and next questions

Continue collaborative technical exploration before implementation/evaluation or
benchmark planning; obtain explicit user approval of a plan before carrying it out.
Keep [design discussion notes](design-discussion.md) current as conclusions emerge.
The example under discussion is a repo-grounded provisional component outline from
the LLM, judged by Jev against the original request and evidence, with signals
returned for agent use. A single-plan critique need not enumerate alternatives.

Current exploration distinguishes source contradiction, missing evidence, and model
uncertainty; considers request-to-proposal coverage, component justification, and
focused relationship checks; and asks how question/evidence bindings can make typed
feedback useful without fabricated explanations. None is an accepted rubric or policy.
The conceptual model is coherent; next move to targeted feasibility rather than another
broad theory layer. Verify a supported host observation/await/delivery opportunity and
clarify feedback influence, coverage limits, privacy/data-sharing, and bounded failure
before an implementation-ready plan. Extracting requirements remains semantic work;
optional checks must not be the only route to flagging proposer omissions. Implicit
domain obligations and unfamiliar-task coverage remain open. Do not select a host or
first slice prematurely. A "decision brief" and bounded
propose/judge/targeted-expand remain exploratory, not an accepted schema or algorithm.
No thresholds, queues, API/protocol, or authority policy are decided. Short output is
not compute evidence; skills alone do not run workers or expose private reasoning.

## Team handoffs

The orchestrator owns goals, scope, coordination, and completion. Architect designs,
developer implements, reviewer independently inspects code/platform health,
evaluator measures experimental value, and marketer maintains accurate writing
and outreach. Specialists do not recursively delegate. One default coordination
level avoids runaway chains and unclear ownership.

Every delegated task supplies the goal, current design, owned files, acceptance
criteria, required checks, and expected output. Parallel research is useful;
parallel writers need disjoint file ownership. Preserve other work in the shared
worktree. Report evidence, open issues, and checks actually run. User-facing
decisions and scope questions return through the orchestrator.

Use `AGENTS.md` to select skills and checks. Read `docs/architecture.md`, relevant
layer READMEs, and ADRs before structural changes. The user has explicitly authorized
ongoing commits and pushes of reviewed, verified project milestones to
`Smyan1909/hunchcraft`; keep GitHub synchronized as discussion documentation evolves.
Inspect status, diff, recent history, intended files, and credentials before each
commit. No releases, npm publication, PR creation, or external outreach are authorized
by this request; those still require explicit approval.
