# Tests

## S2 CLI

`integrations/cli/run.test.ts` uses controlled time and promises for input bounds,
deadline/cancellation, output faults, post-acknowledgment freshness,
late callbacks and cleanup. `composition/node.test.ts` uses the real installed SDK
with fake HTTP to verify lazy configuration, pinned requests and one dispatch.
Neither suite makes live requests or establishes provider usefulness.

`composition/output-child.test.ts` controls spawn/send callbacks, acknowledgments,
exit/disconnect ordering, stale events, termination, cleanup faults and fork policy.
`composition/output-worker.test.ts` verifies strict messages, Unicode/byte bounds,
synchronous short-write loops, acknowledgment and send-callback termination.

`integrations/cli/process.test.ts` compiles the executable and spawns it offline
for help, validation, missing key, invalid bytes/arguments, CRLF/Unicode, cwd paths,
EPIPE, output interruption, real child reaping, preload exclusion and real 15-second
blocked-input/output/stderr cases. It copies built CLI/worker files into a path with
spaces and Unicode. The private
`helpers/cli-process.mjs` is not packaged. Signal readiness is event-controlled;
Windows signal emulation does not establish terminal Ctrl+C behavior.

The original real blocked-output regression remains enabled with its 15-second
Operation and 22-second watchdog unchanged. Its pipe filler runs in a separate
process, receives no credentials, and is killed during cleanup. Parent descriptor
writes are replaced by the approved invocation-owned output child. Blocking stderr
must not trigger diagnostic output or a new child. Do not count injected callbacks
as platform verification; Windows/Linux and the packed-install matrix remain S3 work.

Controlled composition coverage also checks timer-disposal faults. Composition
observes its own clock cleanup and surfaces failure despite the borrowed Operation's
void disposal contract.

Default behavior/regression suites are offline. They use test-only fixture providers
or the real locked `@typesafe-ai/sdk@0.6.0` with dummy keys and injected fake HTTP.
There is no runtime fake-success mode, live model call or host launch. Run
`npm run check` on supported Node 22/24; packaging inspection is `npm pack --dry-run`.

## S1 suite map

- `core/strict-json.test.ts`, `brief.test.ts`, `checks.test.ts`: strict closed v1
  input, legacy/extra/missing-field rejection, UTF-8/scalars/duplicates, quotes,
  references, byte/entity caps, original request/excerpts and literal mandatory
  `component-outline.v0` compiler questions/bindings/order.
- `core/result.test.ts`: all-or-nothing raw Noul/Score distributions, legends,
  exact routing, usage/origin validation, static feedback, compiled binding, closed
  v1 validation/completion/failure variants and fixed messages. Fixtures cannot
  project production completion. Private-brand exception forgery/accessors are
  sanitized; prepared bytes are privately copied and bounded.
- `application/consult.test.ts`: no-session consultation, independent invocations,
  overflow/invalid input, single dispatch, monotonic progress and final outcome
  consistency, cancellation/deadline/disposal precedence, ignored abort and late
  settlement/rejection. The borrowed Operation remains live at output; its deadline
  does not reset during consultation.
- `application/operation.test.ts`: controlled deadlines/clock faults and rejection
  losers, idempotent disposal, throwing timer/listener cleanup and finite settlement.
- `providers/typesafe/configuration.test.ts`, `provider.test.ts`, `transport.test.ts`:
  meaningful configuration, pinned endpoint/model, logging off, actual SDK requests,
  one dispatch/zero retries, both abort signals, redirects refused, capped decoded
  response chunks, strict parsing before SDK parsing, sanitized failures and known
  usage on failure. Cancellation/removal faults and late bodies remain covered.
  Guard-failure fixtures now use local cancellation/deadline, not retired consent.
- `contracts/typesafe-import.test.ts`: actual installed SDK/factory import stays
  inert under throwing credential/network/timer guards.
- `contracts/typesafe-consultation.test.ts`: real SDK through fake HTTP succeeds
  without sessions, transmits only selected state/questions, projects/strictly parses
  v1 completion, preserves failed attempt/usage, handles missing keys without dispatch
  and suppresses late response after cancellation/deadline.
- `helpers/consultation-fakes.ts`: controlled clocks/promises, synthetic briefs and
  fixture provider replies only. No fake session adapter remains.

Consent/root identity, admission/receipt fencing, call caps, persisted completion
and durable verify suites were intentionally retired with their production modules
under [ADR 0004](../docs/decisions/0004-stateless-portable-consultation.md).
They are historical requirements, not weakened stateless checks.

## Fixtures and evidence limits

`fixtures/briefs/csv13.json` and `minimal6.json` retain synthetic inner brief content;
only the outer envelope migrates to v1. Independently expanded golden check fixtures
are unchanged; tests compare every field and compact serialized order. Do not update
goldens automatically to accept a compiler change.

Fake-HTTP `provider-http` observations are local boundary evidence, not proof a packet
left, a request was billed or advice was authenticated. Missing usage/cost remains
unknown. No semantic quality, live latency, savings or platform CLI verification is
claimed. S2 owns process/I/O tests; S3 owns packed executable/platform evidence.
See [application lifecycle](../src/application/README.md), the
[TypeSafe boundary](../src/providers/typesafe/README.md) and
[stateless plan](../docs/implementation-plan.md).
