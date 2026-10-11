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

M1b adds internal closed result and consent boundaries:

- `result.ts`: fixed failures, all-or-nothing Noul/Score reconstruction, provenance
  and monotonic progress checks, static feedback, full judgment/binding validation,
  strict completed-envelope parsing/projection, and private-copy prepared bytes.
  Fixture origin cannot be projected as a production completed envelope.
  Classified exceptions retain frozen constructor-validated payloads; use
  `classifiedFailure(unknown)` for private-brand-safe extraction, not `instanceof`
  followed by reading an unknown exception property.
- `consent.ts`: strict disclosure scopes, bounded root/session/UUID-owned admission
  and terminal values, pure consent checks, repository-binding bytes and exact
  completion/expiry policy. Injected observations are not filesystem authentication.
- `value.ts`: shared narrow own-data-property inspection for the two new boundaries;
  rejects accessors, extra fields and unexpected prototypes without invoking unknown
  serializers. This is not a generic schema framework or JavaScript sandbox.

These modules have no package-root exports or CLI yet. They implement mechanical
contracts from [the system design](../../docs/system-design.md), not semantic
judgment quality, authenticated evidence, complete requirements, or permission to
act. M2 implements Jev transport with fake HTTP verification; concrete private
consent storage and production composition remain M3 work. Result verification
establishes consistency/applicability, not authenticity. Changes to
literals/order require contract review.
