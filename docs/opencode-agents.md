# OpenCode project team

OpenCode loads `opencode.json` and `.opencode/agents/*.md` when launched from this
repository. The default agent is **orchestrator**. All six roles explicitly use
`azure/gpt-6.1-sol`, matching the model used to set up the project. Your existing
global Azure provider configuration and authentication supply access to that model.
Other contributors can change these model IDs to a provider available to them.

These are **agents developing Hunchcraft**, not a runtime specialist swarm. The
proposed product lets an unchanged coding host deliberately consult a CLI and use
advisory Jev judgments. Development skills/configured model settings neither ship
that runtime nor establish an experimental baseline or measured reasoning telemetry.

## Roles

| Agent          | Mode                 | Responsibility                                                      |
| -------------- | -------------------- | ------------------------------------------------------------------- |
| `orchestrator` | Primary and callable | Goals, prioritization, delegation, integration, completion          |
| `developer`    | Subagent             | Code, tests, tooling, working implementation and fixes              |
| `reviewer`     | Subagent             | Independent correctness, repo norms, CI/platform/package health     |
| `architect`    | Subagent             | Innovation, system design, contracts, ADRs, implementation handoffs |
| `marketer`     | Subagent             | Technical writing, positioning, evidence-based outreach             |
| `evaluator`    | Subagent             | Baselines, experiments, quality/latency/cost measurements           |

Orchestration, architecture, review, and evaluation request
`options.reasoningEffort: high`. This is a provider option passed to Azure; resolved
configuration confirms the request, while actual model support is determined by
your deployment. Developer and marketer use the model's default reasoning setting.

The orchestrator is `mode: all` so it can be both the default primary agent and
explicitly invoked. Its Task permissions expose only the five specialists; each
specialist denies recursive Task delegation. Reviewer denies source edits but may
run validation commands, which can regenerate ignored build artifacts.

## Start or resume

Quit the existing OpenCode session, open a terminal in the Hunchcraft directory,
and run:

```sh
opencode
```

Ask the orchestrator to continue from shared context, for example:

> Read shared context, system design, and the implementation/evaluation plans. Close
> the planning review gates, then implement the next reviewed offline slice per the
> system design and implementation plan, with exact ownership and independent review.

You can call specialists explicitly:

```text
@architect Review the proposed v0 contract and next offline slice boundaries.
@developer Implement the next reviewed offline slice once planning gates close.
@reviewer Review the current changes and repository health.
@evaluator Review offline fixture observables and the proposed evaluation controls.
@marketer Align onboarding with reviewed behavior and evidence; keep drafts local.
```

The shared context in `docs/agent-context.md` is automatically included by
`instructions`; root `AGENTS.md` supplies repo norms and skill selection. Agent
prompts include their own bootstrap reads and handoff expectations. This provides
persisted context rather than depending on this setup conversation being available.

## Reading and authorization

Read [system design](system-design.md) → [implementation plan](implementation-plan.md)
→ [evaluation plan](evaluation-plan.md) → supporting
[host](research/agent-integration.md) and [provider](research/jev-cli.md) research.
The packet is reconciled and independently reviewed; M1 grammar/compiler/identity are frozen;
the implementation is still foundation only. Design commands are not runnable.
Research is dated source inspection, not a host/runtime test or live measurement.

The latest user permits offline implementation after planning todos, independent
review/fixes, verification, and the orchestrator's planning milestone push. M1a adds
strict brief/compiler/identity fixtures and the first Vitest behavior tests; M1b adds
internal fake consultation, never production fake success. CLI-first consultation
and scoped human disclosure consent are accepted direction. Protocol/check/default
details are reviewed implementation proposals, not all user-picked
values. No live/evaluation budget, host execution, datasets, release, or outreach is
authorized. The orchestrator owns reviewed/verified code/docs commits and pushes.

## Typical chains

- Substantial new behavior: architect → evaluator design → developer → reviewer →
  developer fixes → reviewer recheck → evaluator where measured → marketer →
  orchestrator integration and any user gate.
- Scoped fix under a frozen contract: developer → reviewer → fixes/recheck as needed.
- Writing: marketer → technical accuracy review when needed → orchestrator.

Every arrow is an orchestrator-coordinated handoff, not recursive specialist
delegation. Resolve findings, add regressions where appropriate, and recheck affected
evidence; invoking a reviewer alone is not acceptance. Each assignment names exact
owned files, reviewed inputs, acceptance tests, allowed operations, and checks.

Choose only the roles a task needs. Research can run in parallel; overlapping file
edits are serialized. Maintain shared context after milestones and keep experiment
claims tied to measured evidence. Outreach is drafted locally unless posting is
explicitly requested.

## Inspect configuration

```sh
opencode agent list
opencode debug agent orchestrator
opencode debug agent reviewer
```

Restart OpenCode after changing agent files, skills, or project configuration.
