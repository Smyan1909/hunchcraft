# Ports

Small SDK-free capabilities required by implemented use cases. Depend inward on
core/ports only; inject explicitly, without a service locator or generic framework.

- `clock.ts` supplies wall/monotonic readings and cancellable callback scheduling.
  Scheduling must not call back synchronously; cancellation is idempotent.
- `decision-provider.ts` supplies one evaluation over the compiled plan/state with
  a caller Operation signal, remaining deadline, exactly-once pre-dispatch guard
  and complete validated monotonic progress snapshots. The guard is invocation-local
  time/cancellation/dispatch control, not session admission. Returned unions still
  require runtime reconstruction at consumption.

The TypeSafe adapter implements this provider contract with the locked SDK and
injected transport. Concrete environment/fetch/clock composition follows in S2.
The retired session-consent port has no replacement: no synthetic production
consent, persistence, shared cap or durable verify is needed for this path.
See [ADR 0004](../../docs/decisions/0004-stateless-portable-consultation.md).
