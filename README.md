# Hunchcraft

Fast hunches. Deliberate agents.

Hunchcraft explores whether System One judgments can improve existing coding agents
such as OpenCode, Codex, and Claude Code, through explicit consultation and automatic
or background evaluations. The initial decision model is TypesafeAI's **Jev**, which
returns typed judgments and probabilities, not code or generated explanations.

The scope is supported plugins or a skill plus CLI, not a custom agent harness,
host fork, or main-model replacement. The host and distribution surface remain open.
We are exploring LLM proposal/decomposition paired with Jev evaluation, not just
background review. See [the design discussion](docs/design-discussion.md) for agreed
direction, hypotheses, and open questions; planning, implementation, and benchmark
design follow collaborative technical exploration and explicit user approval.

**Status:** TypeScript project foundation. Agent integrations, decision providers,
and the background execution loop are still to be implemented.

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
| `npm test`                  | Run offline behavior tests as they are added                    |
| `npm run test:watch`        | Watch tests during development                                  |
| `npm run check:package`     | Build and load actual ESM package exports                       |
| `npm run check`             | Run all local quality checks                                    |
| `npm pack --dry-run`        | Inspect the package payload without publishing                  |

There are no runtime dependencies or functional exports yet. The test runner
temporarily accepts an empty suite; the first behavior change should add meaningful
tests and disable that setting. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Project map

```text
src/
  core/          Pure domain values and decision policies
  ports/         Hunchcraft-owned interfaces for external capabilities
  application/   Use cases and asynchronous orchestration
  providers/     Isolated decision backends (initially Jev)
  integrations/  Isolated coding-agent adapters
  composition/   Explicit wiring and runtime entry points
  index.ts       Host-independent public API
tests/           Cross-module and contract tests
scripts/         Development and package checks
docs/            Architecture, research, and decision records
.agents/skills/  TypeSafe guidance and focused Hunchcraft development skills
.opencode/agents/ Project-specific orchestrator and specialists
AGENTS.md        Short operational guidance for coding agents
```

Start with [the architecture](docs/architecture.md) and
[the foundation decision record](docs/decisions/0001-typescript-foundation.md).
The [research notes](docs/engineering-practices.md) explain the sources and choices.

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
