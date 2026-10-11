# Tests

Add behavior tests alongside a module as `*.test.ts`, or under this directory for
cross-module, contract, and integration tests. Vitest discovers both locations.

M1a core plus M1b/M2 behavior and contract suites now exist. The empty-suite
allowance has been removed. Package entry points are also checked by
`npm run check:package`; no functional root export, CLI/bin or shipped fake-success
mode has been introduced. All M1b/M2 findings are resolved/rechecked; the offline
milestone is implemented, reviewed and locally verified. The orchestrator's integrated
`npm run check` passed on **Windows/Node 24.18.1/npm 12.2.0** with **345 tests across
13 files**, types/lint/architecture, build and actual export/declaration loading.
`npm pack --dry-run` passed with **95 files**, excluding dummy keys/test fakes;
SDK code is not bundled. Final docs verification/Git synchronization remain. No Linux/
Node 22 local run or new-code CI result is asserted; `3eef99a` CI is baseline only.

## Suite map

- `core/strict-json.test.ts`, `brief.test.ts`, `checks.test.ts`, `identity.test.ts`:
  strict parsing, closed briefs, mandatory check compilation and canonical identity.
- `core/result.test.ts`: all-or-nothing external Noul/Score answers, exact IDs/keys/
  legends/distributions, usage and progress, closed judgments/static feedback,
  bindings, completed envelopes and private-copy prepared bytes. Forged branded
  exceptions/accessors cannot supply trusted failure payloads.
- `core/consent.test.ts`: disclosure scope, content categories, path boundaries,
  root/session/UUID values, expiry and terminal reconstruction. Supplied observations
  prove neither source provenance nor filesystem authenticity.
- `application/consult.test.ts`: controlled clock/deferred races, deadline and
  cancellation precedence, admission bounds/duplicates/session isolation, guard and
  progress validation, owned preparation, exact completion acknowledgments and
  one bounded cleanup grace. False `not-admitted` acknowledgments after confirmed
  admission remain unconfirmed cleanup; unresolved state is not advertised as released.
- `application/verify.test.ts`: explicit internal/completed-JSON reconstruction,
  complete current compilation/identity/session/time matching and final consent
  rechecks, with no provider call, preparation or state write. This tests consistency
  and applicability to the supplied snapshot, not authenticated model origin.
- `providers/typesafe/configuration.test.ts`, `transport.test.ts`, `provider.test.ts`:
  selected configuration conflicts, disabled logging, actual locked SDK request
  translation, one fixed-origin dispatch/retries zero, redirect refusal, both signals,
  capped decoded response chunks and strict UTF-8/JSON before SDK parsing, sanitized
  failures, validated usage and late-body/cancel handling. Reviewed regressions cover
  timer cancellation/listener removal throws on success, rejection, abort and elapsed
  deadline paths, plus metadata exception handling. Settlement stays finite; cleanup
  faults cannot replace primary failure or leak raw data, but removal/reclamation
  is best effort when an injected dependency fails.
- `contracts/typesafe-import.test.ts`: actual installed SDK import and source factory
  remain inactive under throwing credential/network/timer guards.
- `contracts/typesafe-consultation.test.ts`: real SDK through fake HTTP across M1b
  consult, completion projection and read-only verify; configuration failure after
  admission, retained attempt/usage observations and late-response suppression.
- `helpers/consultation-fakes.ts`: test-only consent, controlled clocks/deferreds,
  provider replies and preparation. This is not production storage or a CLI fallback.

The [layer READMEs](../src/application/README.md) and
[frozen handoff](../docs/implementation-notes/m1b-m2.md) explain lifecycle contracts;
the [TypeSafe README](../src/providers/typesafe/README.md) records the locked SDK audit.

## Fixtures and evidence limits

`fixtures/briefs/csv13.json` copies the canonical synthetic CSV example;
`minimal6.json` derives the six-check omitted-requirement case exactly as specified.
`fixtures/checks/` contains complete expanded expected records authored separately
from the compiler using the frozen manifest/text registry. Tests compare every
field and compact serialized order, including prefix, criteria and context paths.
Identity tests independently assemble expected canonical bytes from those fixtures
and compute SHA-256 with Node crypto **only in tests**. Golden fixture changes need
independent review, not automatic snapshot acceptance. No paid/model answers or
private repository evidence are fixtures; tests prove mechanical routes, not that
Jev detects the synthetic defects or saves compute.

Default tests are offline: test-only fixture providers or real
`@typesafe-ai/sdk@0.6.0` with injected fake HTTP and dummy credentials. Fixture origin
is `test-fixture`; `provider-http` metadata from fake HTTP describes local boundary
observations, not packets sent, charged attempts or provider-authenticated results.
Fixture-origin judgments cannot be projected as production completed envelopes.
No private fixtures, paid answers or fake fixtures are shipped as a runtime mode;
the inspected 95-file dry-run payload excludes this test directory and dummy keys.
`@typesafe-ai/sdk@0.6.0` remains a declared runtime dependency, not bundled SDK files.

Known usage may survive another response failure; missing usage and cost remain
unknown, never fabricated zero. Offline tests do not establish semantic quality,
live service latency, cost or savings. Live inference/evaluation is not authorized.
Next, M3 starts with offline Windows ACL/root-identity feasibility before secure
state and CLI/skill wiring; credentials come later through human environment
provisioning, not chat, arguments, skills or logs. Any future live experiments need
their own approval and separate quality, whole-task latency/cost and stale/unused
result measurements.
