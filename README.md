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

**Status:** the internal **M1b consultation/verification and M2 TypeSafe provider
boundary are implemented, reviewed and locally verified: the offline M1b/M2
milestone is complete**, building on the verified M1a core
at `3eef99a` and frozen planning contract at `5f1af21`. Consultation uses injected
consent, hashing, clocks and providers; M2 exercises the locked real SDK through
fake HTTP. All M1b/M2 review findings are resolved and rechecked, including false
cleanup acknowledgments, private-brand exceptions and timer/listener disposal faults.
The orchestrator synchronizes reviewed code and documentation to GitHub;
offline completion is not a CLI release or live-service validation.

There is no functional public API, working CLI/bin, secure local-state storage,
production composition, shipped consultation skill, host adapter, background loop,
live inference, evaluation runner or measured improvement. Design commands remain
unreleased, not runnable instructions.

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

Next is **M3**: offline Windows ACL/root-identity platform feasibility
for secure state/root identity, then secure session storage, CLI/bin composition and
a shipped consultation skill. No production fake-success mode is provided. Offline
M1–M3 work is authorized; schemas and limits are reviewed implementation choices,
not values individually chosen by the user. M1b/M2 do not authorize live admission.
Live/paid calls, datasets, host runs and releases need separate approval; no live or
evaluation budget is authorized. Credentials are deferred to later human-managed
environment provisioning, not pasted into chat, arguments, skills or logs.

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
| `npm test`                  | Run offline core, application, provider and contract tests      |
| `npm run test:watch`        | Watch tests during development                                  |
| `npm run check:package`     | Build and load actual ESM package exports                       |
| `npm run check`             | Run all local quality checks                                    |
| `npm pack --dry-run`        | Inspect the package payload without publishing                  |

The sole runtime dependency is **`@typesafe-ai/sdk@0.6.0`**, pinned in the manifest
and lockfile. There are still no functional package-root exports. Meaningful offline
Vitest tests cover core, consent, consultation/verification and real-SDK/fake-HTTP
boundaries; the empty-suite allowance is removed. The orchestrator's integrated
`npm run check` passed on **Windows, Node 24.18.1, npm 12.2.0**: **345 tests across
13 files**, type/lint/architecture checks, build and actual export/declaration loading.
`npm pack --dry-run` passed with **95 files**; dummy credentials and test fakes are
excluded, and the SDK is a declared dependency, not bundled `node_modules`.
No Linux or Node 22 local run, or new-code CI result, is asserted. Prior `3eef99a`
CI success belongs to the baseline; inspect Actions after synchronization. See
[CONTRIBUTING.md](CONTRIBUTING.md) and [the test map](tests/README.md).

## Project map

```text
src/
  core/          Pure domain values and decision policies
  ports/         Hunchcraft-owned interfaces for external capabilities
  application/   Use cases and asynchronous orchestration
  providers/     Internal TypeSafe adapter; local-state storage planned
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
sources and choices. The [core](src/core/README.md), [ports](src/ports/README.md),
[application](src/application/README.md) and [TypeSafe provider](src/providers/typesafe/README.md)
READMEs map implemented internal modules. The [frozen M1b/M2 handoff](docs/implementation-notes/m1b-m2.md)
records the slice contracts, not current completion evidence. Fixture-origin results
remain distinct from `provider-http` metadata observed through fake HTTP; neither
proves live service behavior. All raw Noul/Score signals and static feedback remain
advisory, not action approval. Quality, cost and savings are unmeasured; unavailable
usage/cost is unknown, not zero.

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
