# 0004: Stateless portable consultation

Status: accepted direction; detailed runtime contract proposed, not implemented

Date: 2026-10-25

## Context

The original plan made persistent human-scoped sessions a prerequisite for a CLI.
That introduced secure state roots, Windows ACL helpers, filesystem-root identity,
interprocess admission and crash recovery. M1b implements those injected contracts,
but no storage or executable has been shipped.

The user rejected OS-specific prerequisites and accepted a simpler path: use the
environment-provisioned Jev key, explicitly supply input, consult once and exit.
They requested a full planning retake to remove unnecessary scope.

## Decision

- Deliver a stateless foreground CLI first. `TYPESAFE_API_KEY` is the only
  service-specific setup requirement; installation, supported Node, valid input and
  provider/network access still apply. Target macOS/Linux/Windows, not every hardware.
- Treat explicit `consult` invocation as authorization to transmit supplied material
  under documented disclosure. Agent invocations require a human-authorized workflow.
  Key presence alone never authorizes scanning, automatic calls or arbitrary disclosure.
- Remove mandatory durable sessions, consent files, ACL/root-identity machinery,
  global attempt limits, session commands and durable verify from the initial path.
- Keep bounded strict input, original request/selected evidence, mandatory advisory
  checks, typed answer validation, zero retries, cancellation and sanitized failures.
- Migrate to versioned stateless input/result contracts. Refactor the application
  directly; do not fabricate session consent/reservations in production.
- Keep public API, shipped skill, host adapters, persistence and evaluation runners
  optional. Reintroduce a feature only for a demonstrated need and separate review.

This supersedes ADR 0003's persistent-consent/storage-before-wiring requirement and
its session-bound envelope/lifecycle direction. Retained inner grammar and literal
checks remain the starting point; v1 envelope changes require explicit review.
ADR 0001's package/runtime/layering and ADR 0002's unchanged-host boundary remain.

## Consequences

Users need no session enable step or platform helper. Hunchcraft does not persist
input, results or credentials. Provider retention and shell/host logs remain external.
The CLI cannot authenticate human intent or prevent hostile inherited-key use.

Independent invocations have no shared cap, deduplication or revocation. Re-running
after timeout/output failure can incur another charge. Cancellation is not a billing
guarantee. Consumers own changed-snapshot rejection and ordinary task verification.

The existing session-based source is not silently reclassified as stateless. Its
migration, tests and exact result shape must be reviewed before executable wiring.
No CLI implementation, live calls, host runs, paid study, commit/push or publication
is performed or authorized by this decision record itself.

## Reconsider when

- A concrete integration needs remembered authorization, shared budgets or persistence.
- Representative tasks show the retained brief costs more to prepare than it helps.
- Approved studies show harmful advice, inadequate coverage or no net value.

Do not restore the old security/storage program solely because it was once planned.
