# Stateless CLI integration

`runCli` accepts injected input, output, provider and a caller-owned Operation.
It accepts exactly `--help`, `validate` or `consult`. It does not open files or
read credentials. Help and validation never evaluate the provider. Consultation
uses the unchanged application and production-only completed-result projection.

Input subscriptions copy at most 48 KiB of byte chunks and stop at EOF, failure,
cancellation or deadline. Core performs strict UTF-8/JSON validation and complete
check compilation. Output JSON is reconstructed and bounded before delivery.
The injected `OutputSink.deliver(text, signal)` runs under one original
`Operation.wait('output')`. Successful exit requires acknowledgment of all bytes,
observed output-child exit 0 and a fresh checkpoint. Once delivery is attempted,
there is no replacement envelope. Terminal failures start no stdout. Terminal
stderr diagnostics are deliberately omitted because inherited stderr can also
block. Cleanup is explicit on every path; deadline/cancellation remain primary
even if child termination or disposal fails.

## Output runtime decision

The initial callback `fs.write` mechanism failed the real blocked-output test:
an outstanding filesystem worker prevented parent termination. POSIX Writable
output alone was not portable because Node documents synchronous stream output
for other descriptor/platform combinations.

The approved replacement confines descriptor writes to one killable invocation-owned
child. Parent buffering/validation happens before spawn/send; each is fenced by
the same Operation. A strict IPC protocol requires one output packet and an exact
byte-count acknowledgment plus child exit 0. Premature disconnect, invalid/duplicate
acknowledgment, send/spawn failures and unexpected exits fail without replacement
output. Normal disconnect after acknowledgment is not a failure. Late callbacks
are observed but cannot restart work or select success after termination.

A separate-process pipe filler keeps the original regression enabled and independent
of artificial workers in the CLI. See [composition](../../composition/README.md) and
[the accepted design](../../../docs/system-design.md). Local macOS checks do not
prove all Windows/Linux descriptor combinations or packed installation. Failed
kill, abrupt parent death and hard real-time reclamation remain limitations.

Composition observes its own injected timer cancellation because borrowed
`Operation.dispose(): void` records cancellation errors without returning them.
Its wrapper surfaces this concrete cleanup failure to the CLI without changing
the read-only S1 contract. External CLI cleanup throws are also handled.
