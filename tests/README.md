# Tests

Add behavior tests alongside a module as `*.test.ts`, or under this directory for
cross-module, contract, and integration tests. Vitest discovers both locations.

The foundation intentionally has no placeholder behavior tests. Package entry
points are checked by `npm run check:package`. Disable `passWithNoTests` in
`vitest.config.ts` when adding the first behavior test.

Use injected fake providers and controllable promises for orchestration tests.
Exercise out-of-order completion, changed state, cancellation, timeouts,
concurrency limits, and shutdown. Default tests must work offline without API keys.
Keep optional live-provider experiments separate and measure decision quality,
end-to-end latency, cost, and the rate of stale or unused results.
