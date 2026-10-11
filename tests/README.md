# Tests

Add behavior tests alongside a module as `*.test.ts`, or under this directory for
cross-module, contract, and integration tests. Vitest discovers both locations.

The M1a behavior suite under `core/` tests strict JSON, closed briefs, mandatory
check compilation and pure canonical identity representation. The empty-suite
allowance has been removed. Package entry points are also checked by
`npm run check:package`; no functional root export or CLI has been introduced.

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

Use injected fake providers and controllable promises for orchestration tests.
Exercise out-of-order completion, changed state, cancellation, timeouts,
concurrency limits, and shutdown. Default tests must work offline without API keys.
Keep optional live-provider experiments separate and measure decision quality,
end-to-end latency, cost, and the rate of stale or unused results.
