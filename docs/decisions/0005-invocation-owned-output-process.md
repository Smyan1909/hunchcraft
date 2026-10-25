# ADR 0005: Invocation-owned output-process isolation

- Status: Accepted and implemented offline in S2
- Date: 2026-10-25

## Context

The stateless CLI must bound input, provider work and output under one original
15-second Operation. Node standard-stream writes can block synchronously on some
platform/descriptor combinations. Callback `fs.write` was also insufficient: the
real full-pipe regression on macOS/Node 24.22.1 selected the deadline but an outstanding
filesystem worker prevented process termination within the 22-second test watchdog.
POSIX-only Writable behavior would not establish portable termination.

## Decision

Confine stdout writes to one invocation-owned Node child. This is part of the packaged
foreground runtime, not a persistent daemon, OS-specific helper or additional setup.
Parent code never writes stdout or stderr, including catch-path diagnostics.

The parent validates and buffers bounded output, then fences spawn/send under the
original Operation. It forks the packaged ESM worker with the existing absolute
Node executable, no shell, no inherited preloads and a minimal explicit environment
(validated `SystemRoot` only on Windows). Credentials are not inherited by the worker.
The worker receives exactly one bounded output message, independently validates its
shape and UTF-8 byte bound (256 KiB including newline), and loops over descriptor
writes. Success requires exact byte-count acknowledgment, successful IPC send,
observed worker exit 0 and a fresh original-Operation checkpoint.

Failure or lifetime termination fences continuations, force-kills a still-owned live
child through Node's supported termination API and disconnects IPC. No dead-Operation
path waits for child acknowledgment or exit. No replacement output, restart, additional
deadline or cleanup grace is introduced. Normal completion waits for child exit under
the same Operation. The provider alone owns its existing at-most-one-second cleanup grace.
Terminal stderr diagnostics are deliberately omitted rather than risk blocking the parent.

## Consequences and evidence

One short-lived subprocess adds startup/IPC overhead, but keeps blocking output out of
the parent. It introduces no service-specific setup beyond `TYPESAFE_API_KEY`.
Only supplied results/help cross IPC; the worker imports no provider or credential code.
Consumers must wait for exit 0 and validate complete JSON. An acknowledgment does not
prove that another program consumed advice.

Developer and independent reviewer full macOS/Node 24.22.1 checks passed 429 tests
across 16 files, including the original blocked-pipe regression and blocked stderr,
interruption, partial/short writes, IPC faults, EPIPE, child reaping and preload exclusion.
Pack dry-run includes the worker and excludes test helpers. These are offline checks,
not Windows/Linux execution, actual packed-install or live-provider evidence.

OS scheduling/forced termination is not a hard real-time guarantee. Failed kill,
abrupt parent death or externally delivered SIGKILL can prevent full reclamation.
No persistent recovery mechanism is added for those cases.

## Reconsider when

Actual platform tests expose a termination or packaging defect, or measured subprocess
overhead materially harms the concrete use case. Do not remove isolation based only
on a green asynchronous-pipe test on one OS.

See [system design](../system-design.md), [architecture](../architecture.md) and
[CLI integration](../../src/integrations/cli/README.md).
