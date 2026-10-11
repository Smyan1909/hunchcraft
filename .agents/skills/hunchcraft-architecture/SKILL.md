---
name: hunchcraft-architecture
description: Designs and reviews Hunchcraft module boundaries, public APIs, dependencies, and coding-agent adapters. Use when adding capabilities, moving modules, choosing an integration mechanism, or changing the dependency graph.
---

# Hunchcraft architecture

Read `docs/architecture.md`, `docs/decisions/0001-typescript-foundation.md`, and
the affected layer README from the project root.

## Design from a concrete use case

1. State the observable behavior, host/runtime, inputs, outputs, and lifecycle.
2. Put deterministic domain policy in core. Put orchestration in application.
3. Introduce only ports required by that use case. Own their types in Hunchcraft;
   keep provider and host SDK values at adapter boundaries.
4. Implement backends in `providers/<backend>` and hosts in `integrations/<host>`.
   Inject backends; sibling adapters do not import one another.
5. Wire concrete dependencies in composition through explicit factories.

## Keep review easy

- Prefer one cohesive module over a generic framework. Avoid catch-all `utils`,
  service locators, and interface-per-class boilerplate.
- Keep the root API small and host-independent. Use direct imports internally,
  and intentional public exports rather than automatic wildcard barrels.
- Add host-specific subpath exports only when a real implementation exists.
- Check the host's current extension docs and installed types. Record the supported
  version and whether hooks are awaited. Do not assume all agents expose plugins.
- Runtime startup belongs in explicit initialization, never in an import.
- Keep one package until release/dependency/runtime differences justify a split.

Record significant decisions as ADRs with consequences and reconsideration triggers.
Run `npm run lint:architecture`, then `npm run check`. If a boundary check fails,
fix placement or injection before weakening the rule. Update docs with the code.
