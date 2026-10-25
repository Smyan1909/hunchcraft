# Composition

Explicit factories and executable entry points that wire application use cases,
concrete providers, and host integrations. This is the only layer permitted to
import all other layers. Read and validate environment or CLI configuration here.

S2 adds inert `node.ts` factories for clock, input subscriptions, child output
and the retained TypeSafe provider. `cli.ts` is the foreground startup entry: it installs
SIGINT/SIGTERM cancellation, creates one Operation before stdin, runs the command,
disposes listeners and selects executable termination. Configuration reads only
the four selected TypeSafe environment values, lazily after valid consultation
input. Endpoint/model conflicts fail; logging is off; retries remain disabled.
Help/validation need no credentials or network. No session or OS helper exists.
The Node clock rounds fractional timer delays upward and rechecks the original
due time after early notifications; it never creates a new operation deadline.

`output-child.ts` owns one killable Node child per output attempt. It forks the
packaged ESM `output-worker.js` using absolute `process.execPath`, empty `execArgv`,
no inherited environment, no shell and no detached mode. Windows may receive only
a validated absolute `SystemRoot`; Node adds its own IPC bootstrap values. Credentials,
endpoint/model overrides and `NODE_OPTIONS` never enter the child environment.
The child gets ignored stdin/stderr, inherited stdout and one IPC channel.

The private worker validates one closed output message, performs synchronous fd 1
short-write loops, sends an exact byte acknowledgment and exits after the send
callback. The parent requires both acknowledgment and observed exit 0 while the
original Operation is live. It never writes stdout/stderr itself, even in catch
paths. Deadline, cancellation and failure kill/disconnect the live owned child
without waiting on a terminated Operation or adding cleanup grace. No restart,
replacement envelope or diagnostic child is permitted.

This invocation-local child is not a daemon, session service or provider worker.
Normal success has no live output child. Forced parent death, failed kill and hard
real-time reclamation are not guaranteed. See the [CLI lifecycle](../integrations/cli/README.md).
The package-root API remains empty and inert; no composition subpath export is added.
Cross-platform packed-artifact verification remains S3 work.

Add a package subpath export only for an agreed public integration. Keep the
root package entry host-independent. Importing a library must not start workers,
make requests, or read credentials; initialize and dispose through explicit calls.
