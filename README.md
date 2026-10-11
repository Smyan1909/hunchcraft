# Hunchcraft

Fast hunches. Deliberate agents.

Hunchcraft explores whether System One judgments can improve existing coding agents
such as OpenCode, Codex, and Claude Code, through explicit consultation and automatic
or background evaluations. The initial decision model is TypesafeAI's **Jev**, which
returns typed judgments and probabilities, not code or generated explanations.

The accepted direction is **CLI-first, portable foreground consultation**, followed
by opt-in host adapters—not a custom agent harness, host fork, or main-model
replacement. A human must consent to a scoped session/repository before selected
original-request material and source excerpts are shared with Jev. No first native
host adapter has been selected or runtime-tested.

**Status:** the internal **M1a offline core is implemented and code-reviewed** under
the frozen planning contract at `5f1af21`. It parses and validates briefs, compiles
mandatory checks, and constructs canonical identity representations. Independent
review, boundary-test follow-up, and final local verification are complete.
There is no functional public API, working CLI, Jev provider, shipped consultation
skill, host adapter, background loop, or measured improvement. The proposed v0
design is not fully implemented; design commands remain unreleased, not runnable instructions.

## Read the plan

For developers and reviewers, start here:

1. [System design](docs/system-design.md): canonical proposed v0 command, brief,
   checks, consent, and lifecycle contract.
2. [Implementation plan](docs/implementation-plan.md): dependency-ordered slices,
   review handoffs, and authorization gates.
3. [Evaluation plan](docs/evaluation-plan.md): proposed controls and measurement;
   no trials have run.
4. Research: [host integration](docs/research/agent-integration.md) and
   [Jev/CLI](docs/research/jev-cli.md), plus evaluation sources in the evaluation plan.
   Primary documentation and source were inspected on **2026-10-11**; this is not
   runtime compatibility or benchmark evidence.

Planning review and the M1a milestone are complete. Next is **M1b** internal
consultation/verification with injected consent, hashing,
clock, and fake provider—not a production fake-success mode. Offline M1–M3 work is
authorized; exact schemas and limits are reviewed implementation choices, not
values individually chosen by the user. Live/paid calls, datasets, host runs, and
releases need separate approval; no live or evaluation budget is authorized.

See [architecture](docs/architecture.md) for accepted boundaries and
[design discussion](docs/design-discussion.md) for the reasoning and remaining risks.
[ADR 0003](docs/decisions/0003-cli-first-bounded-consultation.md) records the reviewed
CLI-first offline implementation direction, not semantic validation or live-call approval.

## Development

For development, use Node.js 22.13+ on the 22.x line or Node 24.x, and npm.
CI targets the latest releases on those two lines. The package's runtime floor is
22.12.0; the locked development tools require 22.13.0 on Node 22. Node 26+ is allowed
by the tooling's declared engines but is not a CI target.

```sh
npm ci
npm run check
```

| Command                     | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `npm run build`             | Clean and compile ESM JavaScript, declarations, and source maps |
| `npm run typecheck`         | Check source, tests, and TypeScript configuration files         |
| `npm run lint`              | Type-aware linting, including unhandled promise detection       |
| `npm run lint:architecture` | Enforce dependency direction and isolation                      |
| `npm run format`            | Format maintained source and documentation                      |
| `npm test`                  | Run meaningful offline core behavior and regression tests       |
| `npm run test:watch`        | Watch tests during development                                  |
| `npm run check:package`     | Build and load actual ESM package exports                       |
| `npm run check`             | Run all local quality checks                                    |
| `npm pack --dry-run`        | Inspect the package payload without publishing                  |

There are no runtime dependencies or functional package-root exports yet. M1a adds
meaningful Vitest behavior tests and removes the temporary `passWithNoTests`
allowance. Final `npm run check` passed locally on Windows/Node 24.18.1, including
**98 tests across four files**, type/lint/architecture checks, build, and package-entry
validation. Independent review and boundary-test recheck passed. Inspect GitHub Actions
for current remote CI results; local checks are not Linux or Node 22 execution evidence.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## Project map

```text
src/
  core/          Pure domain values and decision policies
  ports/         Hunchcraft-owned interfaces for external capabilities
  application/   Use cases and asynchronous orchestration
  providers/     External capability adapters (planned Jev and local state)
  integrations/  CLI and coding-agent boundaries (planned)
  composition/   Explicit wiring and runtime entry points
  index.ts       Reserved host-independent public API (no functional exports yet)
tests/           Cross-module and contract tests
scripts/         Development and package checks
docs/            Architecture, research, and decision records
.agents/skills/  TypeSafe guidance and focused Hunchcraft development skills
.opencode/agents/ Project-specific orchestrator and specialists
AGENTS.md        Short operational guidance for coding agents
```

Start with [the architecture](docs/architecture.md) and
[the foundation decision record](docs/decisions/0001-typescript-foundation.md).
The [foundation research notes](docs/engineering-practices.md) explain the tooling
sources and choices. The [core README](src/core/README.md) maps the implemented
internal modules: `strict-json.ts`, `brief.ts`, `checks.ts`, and `identity.ts`.
Other layer descriptions remain boundaries, not implemented features. Offline
fixtures prove mechanical contracts, not Jev judgment quality or performance.

## Working with coding agents

Read [AGENTS.md](AGENTS.md). Skills live in `.agents/skills/`; if your agent does
not discover them automatically, read the relevant `SKILL.md` directly. Start
OpenCode in this directory and restart it after skill changes.

OpenCode starts with the **orchestrator**, supported by developer, reviewer,
architect, evaluator, and marketer subagents. See [the team guide](docs/opencode-agents.md)
for usage and [shared project context](docs/agent-context.md) for where to continue.

## License

[MIT](LICENSE). The installed TypeSafe skill retains its upstream license and
content; project-authored skills are maintained separately.
