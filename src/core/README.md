# Core

Pure domain values and deterministic decision policies. Depend only on other core
modules. Keep provider responses, host SDK types, I/O, environment access, and
global mutable state outside this layer. Pass time and observed state explicitly.

M1a implements the internal, offline `hunchcraft.brief.v0` boundary:

- `strict-json.ts`: bounded fatal UTF-8 decoding, decoded-key duplicate detection,
  scalar/depth checks and exact decimal safe-integer validation. The small numeric
  options support later provider parsing; they do not validate provider answers.
- `brief.ts`: closed canonical reconstruction, byte/entity bounds, reference and
  exact quote consistency, and lexical locator policy. Returned objects/arrays are
  frozen; source provenance is still caller-supplied, not authenticated.
- `checks.ts`: every mandatory `component-outline.v0` question in fixed order,
  first-occurrence bindings, shared-state projection and complete wire byte caps.
  Pass only `parseBrief`-validated inputs. No optional baseline or silent truncation.
- `identity.ts`: compact canonical text and separately owned UTF-8 bytes for an
  injected hash boundary. No Node crypto, repo reads, consent or freshness claim.

These modules have no package-root exports or CLI yet. They implement mechanical
contracts from [the system design](../../docs/system-design.md), not semantic
judgment quality, authenticated evidence, complete requirements, or permission to
act. Consent, consultation/verification orchestration, answer validation and Jev
transport remain later slices. Changes to literals/order require contract review.
