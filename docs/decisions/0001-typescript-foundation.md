# 0001: A single, layered TypeScript ESM package

Status: accepted

Date: 2026-10-11

## Context

Hunchcraft is an early open-source experiment in asynchronous decisions for coding
agents. It may ship host plugins, skills, or utilities; the first host and decision
have not been selected. The user chose TypeScript, readable decoupling, and MIT.

## Decision

- Use one npm package, ESM, and `tsc` with strict NodeNext resolution and explicit
  ES2022 output. Keep the package runtime floor at Node 22.12.0; development uses
  Node 22.13+ on the 22.x line or Node 24.x to satisfy locked tooling. CI targets
  the latest releases on 22 and 24.
- Separate core, ports, application, providers, integrations, and composition.
  Enforce the dependency graph with dependency-cruiser.
- Add contracts and adapters when the first vertical slice requires them; maintain
  layer README files instead of inventing placeholder implementations.
- Use type-aware ESLint, Prettier, Vitest, npm's lockfile, built-export smoke checks,
  and Windows/Linux CI. Pin compatible development tools.
- Keep the package root host-independent and import-time inert. Later integrations
  get explicit subpath exports and explicit initialization/disposal.
- Maintain a concise root `AGENTS.md` and focused project development skills,
  alongside the unchanged upstream TypeSafe skill.

## Consequences

Humans and agents share one discoverable project map and check command. Adapter
changes cannot silently leak host or provider dependencies into inner layers.
One package avoids premature workspace and release overhead. ESM-only consumers
must use imports; a requirement for CommonJS would need a tested build decision.
The early empty test suite is explicitly allowed until real behavior is added.

## Reconsider when

- Adapters need independent release cycles or incompatible runtime dependencies.
- A concrete host requires another runtime baseline or module format.
- A demonstrated browser or Bun use case needs dedicated compatibility checks.
- TypeScript 7 is supported by the linting and dependency-analysis toolchain.
