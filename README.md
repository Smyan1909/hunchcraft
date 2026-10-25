# Hunchcraft

Fast hunches. Deliberate agents.

Hunchcraft explores whether TypesafeAI's **Jev** judgments can help existing coding
agents make better decisions. The agent proposes; Jev returns typed judgments and
probabilities; the agent remains responsible for implementation and verification.
Improved quality, lower cost and faster completion are hypotheses, not measured results.

## Direction: a small, portable CLI

The initial product is planned as **stateless foreground consultation**:

1. Supply a compact proposal, original request and selected evidence through stdin.
2. Read `TYPESAFE_API_KEY` from the environment.
3. Validate, consult once, return typed advisory output and exit.

No required session setup, consent files, Windows ACL helpers, repository scan,
background process or host adapter. The key is the only service-specific setup;
installation, supported Node.js, valid input and provider/network access still apply.
Target macOS/Linux/Windows on Node-supported hardware, with support claims tied to tests.

Explicit `consult` invocation authorizes disclosure of the supplied material under
documented usage. An agent must operate within a human-authorized workflow. Key
presence alone never triggers work or grants permission to transmit arbitrary content.
No local Hunchcraft persistence does not imply provider zero retention.

## Current status

**Implemented at `cde4ef8`:** M1a strict parsing/check compilation, M1b injected
session-based consultation/verification, and M2 TypeSafe SDK boundary, all offline.
Recorded integrated acceptance: **345 tests in 13 files**, full checks and a
**95-file pack dry-run** on Windows/Node 24.18.1/npm 12.2.0. These are historical
results, not tests performed by the 2026-10-25 planning retake or live-service evidence.

**Not implemented:** the revised stateless contracts, working CLI/bin or production
composition. No functional root API, shipped consultation skill, host adapter,
live inference, evaluation runner or measured benefit exists. The old session-based
application needs an explicit migration, not a fake consent adapter.

The 2026-10-25 planning retake replaces the former secure-storage-first roadmap.
Proposed commands are **not runnable today**. No live/evaluation budget is authorized.

## Read the plan

- [System design](docs/system-design.md): the small proposed runtime contract.
- [Implementation plan](docs/implementation-plan.md): three offline slices—migration,
  CLI/composition, package readiness and usage.
- [Evaluation plan](docs/evaluation-plan.md): optional, separately approved evidence work.
- [Architecture](docs/architecture.md) and [ADR 0004](docs/decisions/0004-stateless-portable-consultation.md).
- [Legacy specification](docs/system-design-legacy.md): historical implemented contracts,
  not instructions to build persistent sessions. Earlier plans remain in Git at `cde4ef8`.

Next: migrate the existing application offline under the independently reviewed stateless contract.
Public APIs, skills, host adapters, persistence and background execution are optional,
not prerequisites. Live calls, host trials, releases and publication need separate approval.

## Development

Use Node.js 22.13+ on the 22.x line or Node 24.x, and npm. The package runtime floor
is 22.12.0. CI currently targets Node 22/24 on Linux/Windows; macOS execution evidence
must be added before claiming tested CLI support. New-code remote CI has not been
verified by this planning pass.

```sh
npm ci
npm run check
```

| Command                     | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `npm run build`             | Compile ESM JavaScript, declarations and source maps |
| `npm run typecheck`         | Check source, tests and TS configuration             |
| `npm run lint`              | Type-aware linting                                   |
| `npm run lint:architecture` | Check dependency boundaries                          |
| `npm run format:check`      | Check maintained file formatting                     |
| `npm test`                  | Run offline tests                                    |
| `npm run check:package`     | Build and load actual package exports                |
| `npm run check`             | Run all local checks                                 |
| `npm pack --dry-run`        | Inspect package contents without publishing          |

`@typesafe-ai/sdk@0.6.0` is the sole runtime dependency. TypeScript is pinned to
6.0.3. Nothing functional is exported from the package root yet. See
[CONTRIBUTING.md](CONTRIBUTING.md) and [test map](tests/README.md).

`src/` separates pure core, SDK-free ports, application, providers, integrations
and composition. Read their layer READMEs for **implemented** contracts. Default
tests use offline fakes, never production fake success. Unknown usage/cost is not zero.

## Coding-agent contributors

Read [AGENTS.md](AGENTS.md) and [shared context](docs/agent-context.md).
Project development skills live in `.agents/skills/`. OpenCode's development
specialists are described in [team guide](docs/opencode-agents.md); they are not
Hunchcraft runtime agents. Commit, push or publish only when explicitly requested.

## License

[MIT](LICENSE). The upstream TypeSafe skill retains its own license and content.
