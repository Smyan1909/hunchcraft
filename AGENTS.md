# Hunchcraft: agent guidance

Hunchcraft explores LLM proposal/decomposition paired with TypesafeAI's Jev
System One judgments for existing coding agents, not only asynchronous review.
The accepted initial product is now a stateless, OS-independent foreground CLI
configured through `TYPESAFE_API_KEY`. M1a core, M1b session-based consult/verify and
M2 TypeSafe boundary are implemented/verified offline at `cde4ef8`. The revised
stateless path, CLI/bin and production composition are not implemented. No functional
public API, shipped consultation skill or host adapter exists. See ADR 0004.

## Start here

- Read `README.md`, `docs/architecture.md`, and the relevant layer README.
- Use Node.js 22.13+ on the 22.x line or Node 24.x and npm. Run `npm ci` for a locked install.
- Read `CONTRIBUTING.md` for coding, testing, and review conventions.

## OpenCode team

OpenCode defaults to `orchestrator`; it can delegate to `developer`, `reviewer`,
`architect`, `evaluator`, and `marketer`. Read `docs/agent-context.md` for shared
mission/status and `docs/opencode-agents.md` for roles and usage. For substantial
work, use the relevant specialists with clear goals, file ownership, and checks.
Keep shared context current after milestones; specialists return cross-role
decisions to the orchestrator rather than recursively delegating.

## Skills

Load applicable skills before designing or changing the relevant area. If skill
discovery is unavailable, read the listed `SKILL.md` directly.

| Task                                                            | Skill                                                |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| TypeSafe/Jev questions, providers, experiments, or architecture | `.agents/skills/typesafe-ai/SKILL.md`                |
| Boundaries, public API, dependencies, or host adapters          | `.agents/skills/hunchcraft-architecture/SKILL.md`    |
| Scheduling, freshness, cancellation, lifecycle, or async tests  | `.agents/skills/hunchcraft-async-decisions/SKILL.md` |
| TypeScript implementation, tooling, tests, packaging, or review | `.agents/skills/hunchcraft-typescript/SKILL.md`      |

Read relevant live TypeSafe documentation before integrations. Preserve the
upstream TypeSafe skill; put project-specific rules in our own docs and skills.

## Architecture and code

- Dependencies point inward: `application -> ports -> core`. Providers depend on
  core/ports; integrations depend on core/ports/application. Only composition
  wires concrete providers to hosts. Sibling adapters remain independent.
- Keep core pure and inner-layer contracts free of third-party SDK types. Use
  explicit injection; add abstractions only for concrete use cases.
- Keep modules cohesive, names descriptive, and APIs small. Use `.js` relative
  imports and `import type`; validate unknown external data at boundaries.
- Importing the package must not start work or access credentials. Initialize and
  dispose explicitly. Handle all background promise rejections.
- Results describe only supplied state; consumers discard advice after relevant
  changes. Define deadlines and cancellation. For the initial stateless CLI, one
  invocation has one dispatch and no queue; do not add persistent sessions or global caps.
- Check installed types and current host docs before assuming extension support.
  A skill is guidance; background execution needs an actual runtime mechanism.

## Verification and completion

- Run `npm run check` after code or tooling changes. For documentation-only work,
  run `npm run format:check` and check paths and instructions.
- Add meaningful tests for behavior and regressions; default tests are offline.
  Core, consent, application and real-SDK/fake-HTTP contract suites now exist;
  `passWithNoTests` is removed. All M1b/M2 findings are fixed/rechecked. Orchestrator
  `npm run check` passed: 345 tests/13 files, types/lint/architecture, build and actual
  exports/declarations on Windows/Node 24.18.1/npm 12.2.0; `npm pack --dry-run`
  passed with 95 files, excluding dummy keys/test fakes. No Linux/Node 22 local run
  or new-code CI result is asserted; prior `3eef99a` CI is baseline evidence only.
- For package/export changes, inspect `npm pack --dry-run` as well.
- Keep `package-lock.json` synchronized. TypeScript is pinned to 6.0.3 for current
  typescript-eslint compatibility; check peer support before upgrading.
  `@typesafe-ai/sdk@0.6.0` is the sole runtime dependency; SDK types stay in providers.
- Next is reviewed stateless contract/application migration, then CLI/bin and package
  readiness. The 2026-10-25 planning retake supersedes mandatory OS ACL/root-identity,
  secure-storage and session work; historical docs are not current instructions.
- Explicit consult authorizes disclosure of supplied input under a human-authorized
  workflow. Key presence never triggers scanning or inference. No live/evaluation
  budget is authorized for development agents. Credentials belong in human-managed
  environment values, never chat/argv/skills/logs. No required skill/host adapter.
- Update nearby docs and add an ADR for significant design choices. Report checks
  actually run and distinguish implemented behavior from future design.
- Commit, push, publish, or create a PR only when explicitly requested.
