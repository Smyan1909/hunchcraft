# Core

Pure parsing and decision policy, with no SDK types, I/O, credentials or startup work.
The S1 stateless contract is implemented internally; no package-root API or CLI exists yet.

- `strict-json.ts` performs bounded fatal UTF-8 decoding, duplicate decoded-key
  rejection, scalar/depth validation and exact decimal safe-integer checks.
- `brief.ts` accepts exactly `{schemaVersion:"hunchcraft.brief.v1",brief}`.
  Legacy v0, request/session/scope/context fields and unknown fields are rejected.
  Inner grammar, quote/reference checks, entity/text limits and lexical locator
  policy are retained. Frozen original request and excerpts are not normalized.
  Evidence provenance is caller-supplied, not authenticated or a complete secret scan.
- `checks.ts` retains literal `component-outline.v0` questions, compiler order and
  complete bindings, with `hunchcraft.policy.v1` execution policy. Input/state/questions
  remain capped at 48/32/16 KiB and 16 checks. Never silently trim mandatory checks.
- `result.ts` reconstructs every Noul and Score answer, legend/distribution, usage,
  origin and monotonic progress. It retains static feedback and exact compiled-check
  binding. Closed `hunchcraft.result.v1` variants cover validation (6–16 checks),
  production completion and fixed sanitized failure observations. Fixture origin
  cannot be projected as production completion. Unknown usage/cost is not zero.
  `parseResultEnvelope` validates wire shape, not provider authenticity.
- `value.ts` inspects only own data properties; it rejects accessors, extra fields
  and unexpected prototypes without invoking unknown serializers.

Classified exceptions retain frozen constructor-validated private-brand payloads.
Use `classifiedFailure(unknown)`, not `instanceof` followed by reading an unknown
exception property. Prepared delivery bytes are private copies, newline-inclusive
and limited to 256 KiB; byte preparation alone does not validate a result envelope.

Consent, identity and durable freshness modules are retired under
[ADR 0004](../../docs/decisions/0004-stateless-portable-consultation.md).
Consumers track the supplied snapshot, discard advice after relevant changes, and
run ordinary verification. Positive judgments do not authorize actions, certify
correctness or justify skipping necessary tests. See the
[stateless contract](../../docs/system-design.md).
