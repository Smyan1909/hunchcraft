# Hunchcraft: agent guidance

Hunchcraft explores LLM proposal/decomposition paired with TypesafeAI's Jev
System One judgments for existing coding agents, not only asynchronous review.
The TypeScript ESM repository now implements the internal M1a offline core;
no functional public API, CLI, Jev provider, or host adapter exists yet.

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
- Async results must retain source state identity and be checked for freshness
  before use. Bound queues/concurrency, define deadlines, and isolate sessions.
- Check installed types and current host docs before assuming extension support.
  A skill is guidance; background execution needs an actual runtime mechanism.

## Verification and completion

- Run `npm run check` after code or tooling changes. For documentation-only work,
  run `npm run format:check` and check paths and instructions.
- Add meaningful tests for behavior and regressions; default tests are offline.
  M1a adds behavior tests and removes Vitest's temporary `passWithNoTests` allowance.
  Final M1a `npm run check` passed locally on Windows/Node 24.18.1 with 98 tests,
  independent code review and boundary-test recheck. Inspect Actions for current CI.
- For package/export changes, inspect `npm pack --dry-run` as well.
- Keep `package-lock.json` synchronized. TypeScript is pinned to 6.0.3 for current
  typescript-eslint compatibility; check peer support before upgrading.
- Update nearby docs and add an ADR for significant design choices. Report checks
  actually run and distinguish implemented behavior from future design.
- Commit, push, publish, or create a PR only when explicitly requested.
