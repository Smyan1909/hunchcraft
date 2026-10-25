# Tests

## S3 actual packed-artifact checks

`npm run check:packed` builds, creates a real tarball in a temporary path with
spaces/Unicode, inspects its actual tar entries and installs that tarball into a
separate temporary consumer. It uses npm's cache only (`--offline`), empty npmrc
files, no credentials/preloads, no lifecycle scripts and no development dependencies.
Run `npm ci` first to populate the locked SDK cache. A cache miss fails rather than
silently enabling registry access or upgrading the SDK. Installation requests the
exact locked SDK tarball URL (not registry version metadata, which `npm ci` need
not cache). The installed SDK 0.6.0
payload must match the checkout's locked `npm ci` installation exactly.

The check verifies executable bin/worker files, source/declaration maps and mapped
sources; it rejects retired modules, private tests/helpers and known dummy-key
markers. Every installed package file is compared to the real archive. The installed
package-root import runs under credential/network/timer/process guards. npm's actual
generated POSIX symlink or Windows `.cmd` shim exercises help, validation,
including the public example read from the installed package,
Unicode/CRLF, missing key, invalid UTF-8/oversize input and invalid arguments. Result
JSON is checked against the installed closed v1 parser. EPIPE and event-controlled
POSIX interruption exercise installed output/termination without provider calls.
Windows `kill` emulation is not terminal Ctrl+C verification.

On Unix, real blocked-output/stderr regressions use an actual test-only FIFO,
created by `/usr/bin/mkfifo` with a setup timeout. Node-created stdio socketpairs
can regain writable room after transient EAGAIN. The fixture holds an unread FIFO
reader open, handles partial writes and fills until even a one-byte write returns
EAGAIN. A checked, test-only libuv `setBlocking` capability restores blocking mode
before the CLI is spawned. Setup must produce independent IPC evidence and exit
successfully under its watchdog. Interruption additionally probes EAGAIN on the
actual worker fd and announces over an independent descriptor, not its output IPC.
No arbitrary sleep, enlarged buffer or relaxed exit/deadline assertion is used.
The original 15-second Operation and 22-second process watchdog remain unchanged.
Windows retains its previously exercised pending-write fixture; no Unix EAGAIN
or terminal Ctrl+C claim is made for Windows. All FIFO descriptors/processes and
temporary paths are invocation-owned and cleaned up explicitly.

The test parent now creates and owns each fixture directory before starting the
wrapper. Its unchanged 22-second failure watchdog terminates the complete owned
Unix process group (test-only detached wrapper) or Windows tree (`taskkill /T /F`)
while the observed leader is live, awaits process close under a separate bounded
cleanup budget and removes the directory outside the killed wrapper. A deliberate
hung-wrapper/CLI/worker fixture retains an open FIFO (an open file on Windows),
omits normal cleanup, and arms a short test-only watchdog only after descendant
readiness. The regression asserts timeout failure, reclamation of all three PIDs
and removal of the parent-owned directory. This does not change the production
15-second deadline or add runtime cleanup grace. Split interruption notifications
are accumulated; a controlled chunk regression verifies one signal after complete
worker evidence, not a partial marker.

`npm run check` includes this artifact check after built-entry checks. CI configures
Ubuntu, Windows and macOS with Node 22/24 (six cells); configured cells are not
evidence that remote jobs passed. Watchdogs observe process close, handle stdio
errors and terminate owned subprocesses; temporary archives/consumers are removed
in `finally`. On macOS, the realpath of `os.tmpdir()` uses the approved local temp root.

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
unknown. No semantic quality, live latency or savings is claimed. S2 owns process/I/O
tests; S3 owns packed executable/platform evidence. See shared context for actual
local and remote results, including the historical Linux fixture failure and repair.
See [application lifecycle](../src/application/README.md), the
[TypeSafe boundary](../src/providers/typesafe/README.md) and
[stateless plan](../docs/implementation-plan.md).
