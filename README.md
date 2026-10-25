# Hunchcraft

Fast hunches. Deliberate agents.

Hunchcraft explores whether TypesafeAI's **Jev** judgments can help existing coding
agents make better decisions. The agent proposes; Jev returns typed judgments and
probabilities; the agent remains responsible for implementation and verification.
Improved quality, lower cost and faster completion are hypotheses, not measured results.

## Direction: a small, portable CLI

The initial product is **stateless foreground consultation**:

1. Supply a compact proposal, original request and selected evidence through stdin.
2. Read `TYPESAFE_API_KEY` from the environment.
3. Validate, consult once, return typed advisory output and exit.

No required session setup, consent files, Windows ACL helpers, repository scan,
persistent background process or host adapter. One invocation-owned Node output child
isolates blocked stdout without additional setup. The key is the only service-specific setup;
installation, supported Node.js, valid input and provider/network access still apply.
Target macOS/Linux/Windows on Node-supported hardware, with support claims tied to tests.

Explicit `consult` invocation authorizes disclosure of the supplied material under
documented usage. An agent must operate within a human-authorized workflow. Key
presence alone never triggers work or grants permission to transmit arbitrary content.
No local Hunchcraft persistence does not imply provider zero retention.

## Current status

**Implemented (S1):** strict `brief.v1`/`result.v1` contracts, mandatory check compilation,
stateless consultation and the retained TypeSafe SDK boundary. Session, consent,
identity and durable verification modules are retired, without synthetic adapters.
Developer full offline checks passed **334 tests in 11 files** on macOS/Node 24.22.1;
independent review accepted S1 and rechecked added concurrency/mutation tests.

**Implemented (S2):** help, stdin validation/consultation, npm bin mapping and explicit
Node composition with lazy credentials. One killable output child keeps blocked stdout
out of the parent; terminal stderr diagnostics are omitted. Developer and independent
reviewer full checks passed **429 tests/16 files** on macOS/Node 24.22.1, including real
blocked-pipe tests; pack dry-run passed with **116 files**. Actual packed-install and
remaining platform checks are S3 work.

No functional root API, shipped consultation skill, host adapter, live inference,
evaluation runner or measured benefit exists.

The 2026-10-25 planning retake replaces the former secure-storage-first roadmap.
Commands run from a built checkout; packaged installation instructions follow in S3.
No live/evaluation budget is authorized for development agents.

## Read the plan

- [System design](docs/system-design.md): the small proposed runtime contract.
- [Implementation plan](docs/implementation-plan.md): three offline slices—migration,
  CLI/composition, package readiness and usage.
- [Evaluation plan](docs/evaluation-plan.md): optional, separately approved evidence work.
- [Architecture](docs/architecture.md) and [ADR 0004](docs/decisions/0004-stateless-portable-consultation.md).
- [Legacy specification](docs/system-design-legacy.md): historical implemented contracts,
  not instructions to build persistent sessions. Earlier plans remain in Git at `cde4ef8`.

Next: verify the actual packed artifact and document concise user setup and usage.
Public APIs, skills, host adapters, persistence and background execution are optional,
not prerequisites. Live calls, host trials, releases and publication need separate approval.

## Development

Use Node.js 22.13+ on the 22.x line or Node 24.x, and npm. The package runtime floor
is 22.12.0. CI currently targets Node 22/24 on Linux/Windows; macOS execution evidence
includes local Node 24 process tests. S1 milestone `5b228a7` passed remote CI; this is
not evidence for the subsequent S2 source or all descriptor/platform combinations.

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
