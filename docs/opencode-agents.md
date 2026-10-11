# OpenCode project team

OpenCode loads `opencode.json` and `.opencode/agents/*.md` when launched from this
repository. The default agent is **orchestrator**. All six roles explicitly use
`azure/gpt-6.1-sol`, matching the model used to set up the project. Your existing
global Azure provider configuration and authentication supply access to that model.
Other contributors can change these model IDs to a provider available to them.

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

> Read the project context, help me choose the first host and bounded Jev decision,
> and coordinate the design and evaluation plan before implementation.

You can call specialists explicitly:

```text
@architect Explore the first useful asynchronous decision workflow.
@developer Implement the accepted vertical slice and verify it.
@reviewer Review the current changes and repository health.
@evaluator Design a baseline and evaluation protocol for this workflow.
@marketer Improve the README and draft an evidence-based launch post.
```

The shared context in `docs/agent-context.md` is automatically included by
`instructions`; root `AGENTS.md` supplies repo norms and skill selection. Agent
prompts include their own bootstrap reads and handoff expectations. This provides
persisted context rather than depending on this setup conversation being available.

## Typical chains

- Scoped implementation: developer -> reviewer -> developer fixes as needed.
- New design: architect -> evaluator -> developer -> reviewer -> measured evaluation.
- Writing: marketer -> technical accuracy review when needed.

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
