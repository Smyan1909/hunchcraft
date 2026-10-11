# Contributing

## Start here

1. Use Node.js 22.13+ on the 22.x line or Node 24.x and run `npm ci`.
2. Read `docs/architecture.md` and the README of the layer you will change.
3. Make one cohesive change, with explicit inputs and outputs and minimal dependencies.
4. Add tests for new behavior or a fixed regression. Documentation-only changes do
   not need placeholder tests.
5. Run `npm run check`. Inspect `npm pack --dry-run` when changing package contents
   or exports.

## Code and review

- Use descriptive names, small cohesive modules, early returns, and direct imports.
  Prefer named exports; use default exports where host or tooling contracts need them.
- Keep domain policy independent of SDKs and host hooks. New capabilities should
  enter through a concrete use case, not a generic framework or speculative interface.
- Validate external input at the boundary. Treat untrusted values as `unknown`,
  and avoid `any`, non-null assertions, and casts that conceal missing validation.
- Use `.js` extensions in relative TypeScript imports so emitted ESM runs in Node.
- Document public behavior, lifecycle, error semantics, and units. Explain why a
  choice exists rather than narrating obvious code.
- Commit `package-lock.json` with dependency changes. Check tool peer compatibility
  before upgrades; currently typescript-eslint requires TypeScript below 6.1.
- Keep formatting in Prettier and correctness in ESLint. Scripts must run on Windows
  and Linux. Use Node APIs instead of platform-specific shell commands.

## Tests and experiments

Use Vitest with fake providers for default offline tests. For asynchronous code,
control completion with deferred promises or fake clocks instead of sleep-based
timing. Test stale results, cancellation, rejected requests, and shutdown as well
as the happy path. Remove `passWithNoTests` when the first behavior test is added.

Keep live Jev experiments opt-in and separate from deterministic tests. Describe
the baseline, input cases, model version, question definitions, decision quality,
latency, cost, and stale/unused result rate. A valid typed answer is not evidence
that the decision improves the coding agent.

## Design decisions

Record significant dependency, boundary, protocol, and public API decisions in
`docs/decisions/NNNN-short-title.md` with context, decision, consequences, and
reconsideration triggers. Update nearby docs when behavior changes.

## Pull requests

Explain the user-visible goal, key design choices, and checks actually run. Keep
generated output, credentials, and unrelated edits out of the diff. New agent
adapters must cite the host extension surface and version they actually target.
