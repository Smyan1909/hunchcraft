---
name: hunchcraft-typescript
description: Implements and reviews sustainable TypeScript in Hunchcraft. Use for source changes, strict typing, tests, linting, dependency upgrades, ESM package exports, builds, and contributor tooling.
---

# Hunchcraft TypeScript

Read `CONTRIBUTING.md`, `package.json`, and the affected configuration before editing.
Use the architecture skill for boundary changes and the async skill for lifecycle work.

## Implementation

- Use strict TypeScript, descriptive types, narrow unions, and explicit public
  return types. Infer local values where readable; avoid unnecessarily clever generics.
- Prefer immutable inputs and deterministic helpers. Separate domain policy from I/O.
- Use `unknown` for external data and validate at entry. Do not hide problems with
  `any`, broad assertions, or non-null assertions.
- Use `.js` relative import specifiers under NodeNext and explicit `import type`.
  Avoid path aliases requiring consumers to reproduce a bundler setup.
- Handle all promises, especially background ones. Bound work and provide explicit
  lifecycle rather than process-global workers or listeners.
- Explain non-obvious decisions and error semantics. Avoid narration of obvious code.

## Tooling and dependencies

Use npm and keep the lockfile synchronized. Runtime code must not import development
dependencies at runtime. Add dependencies only for demonstrated needs; check peers,
Node engine support, and adapter loading behavior before upgrades. Currently
TypeScript 6.0.3 matches typescript-eslint's `<6.1.0` constraint.

Keep formatting in Prettier and correctness in typed ESLint. Maintain Windows/Linux
portable scripts. The compiler emits ESM, declaration files, and maps to `dist/`;
ship source when shipping source/declaration maps.

## Test and review

1. Test observable behavior and meaningful edge cases with Vitest and offline fakes.
   Use deferred promises for races rather than real sleeps. Avoid implementation
   snapshots, trivial scaffold tests, and arbitrary coverage targets.
2. Disable temporary `passWithNoTests` when adding the first behavior test.
3. Run `npm run check`; it includes format, typecheck, typed lint, architecture,
   tests, build, and real built-export loading.
4. Inspect `npm pack --dry-run` for export or packaging changes. Check that declared
   exports exist and importing does not require credentials or start background work.
5. Review API clarity, boundary direction, error propagation, documentation, and
   reproducible install. State verification actually performed.
