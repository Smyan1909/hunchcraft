# Ports

Small interfaces required by an implemented application use case: decision
providers, observation sources, clocks, and result sinks as needed. Depend on
core and other ports only. Define Hunchcraft-owned contracts, not SDK aliases.

Use constructor or function arguments for injection; no service locator or
dependency injection framework is needed.

M1b defines three internal, SDK-free ports:

- `clock.ts`: explicit wall/monotonic readings and cancellable callback scheduling.
- `decision-provider.ts`: one evaluation with an exactly-once pre-dispatch guard,
  operation signal/deadline and validated monotonic progress snapshots.
- `session-consent.ts`: read, atomic admission, owned check and finalization. The
  adapter must fence unresolved admission/completion writes by invocation UUID;
  acknowledgment cannot mean merely that no record was visible. Admission is
  permanently consumed, one active per session, zero waiting queue. Post-completion
  delivery-unknown must never release a newer owner's slot.

M2 implements the decision-provider port through the locked SDK with injected
transport. Concrete clock/environment wiring is still planned. The session-consent
port describes historical M1b source, not a storage prerequisite for the new CLI.
The [current plan](../../docs/implementation-plan.md) retires it from the stateless
runtime and reviews the dispatch guard as invocation-local cancellation/time control.
The [handoff](../../docs/implementation-notes/m1b-m2.md) records legacy contracts.
