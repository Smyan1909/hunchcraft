# Architecture

## Purpose and accepted direction

Hunchcraft lets an unchanged coding agent or human submit a compact proposal and
selected evidence to Jev for typed advisory judgments. It does not generate code,
replace the main model or run a custom coding-agent loop.

The accepted initial delivery is a **stateless, portable foreground CLI**. The key
comes from `TYPESAFE_API_KEY`; there is no required OS helper, session storage, repo
scan or host adapter. Explicit consultation authorizes disclosure of supplied input
within a human-authorized workflow. Key presence alone never starts work.

See [system design](system-design.md), [implementation plan](implementation-plan.md)
and [ADR 0004](decisions/0004-stateless-portable-consultation.md). Output isolation is
recorded in [ADR 0005](decisions/0005-invocation-owned-output-process.md). The
[legacy design](system-design-legacy.md) explains already implemented session-based
contracts, not future requirements. ADRs [0001](decisions/0001-typescript-foundation.md)
and [0002](decisions/0002-existing-agent-extension.md) retain the package and unchanged-host boundaries.

## Dependency direction

```text
composition -> integrations -> application -> ports -> core
composition -> providers ------------------> ports -> core
```

Arrows mean allowed imports; layers may also import further inward. Concrete wiring
belongs only in composition. Sibling providers/integrations remain independent.

| Layer                | Responsibility                                                             |
| -------------------- | -------------------------------------------------------------------------- |
| `core`               | Pure parsing, brief/check policy, typed answer/result validation           |
| `ports`              | Only injected capabilities required by a concrete use case; SDK-free types |
| `application`        | One-shot consultation, time/cancellation and outcome orchestration         |
| `providers/typesafe` | SDK translation, bounded transport, external-data validation               |
| `integrations/cli`   | Arguments, bounded stdin/stdout, exit behavior                             |
| `composition`        | Explicit Node clock/fetch/env wiring and executable startup                |

Keep the single TypeScript ESM npm package. Relative imports use `.js` and types use
`import type`. Keep inner layers free of third-party SDK types. Importing package
entry points must not read credentials, launch work or access the network.
Do not add a generic session framework, service locator or interface for hypothetical use.

## Implemented baseline and S1 migration

At `cde4ef8`, M1a core, M1b injected session-based consultation/verification and M2
TypeSafe provider are implemented and verified offline. See the layer READMEs and
[historical handoff](implementation-notes/m1b-m2.md). Recorded acceptance: 345 tests
in 13 files, full checks and a 95-file pack dry-run on Windows/Node 24. These are
historical observations, not live or newly measured results.

S1 implements stateless v1 brief/result envelopes and one-shot consultation, retaining
strict JSON, inner grammar, compiler goldens, typed answers and unchanged provider code.
Consent/session/verify/root-identity modules and their obsolete tests are retired.
The caller supplies and owns one Operation from before stdin through eventual output;
consultation borrows it and claims at most one dispatch for its lifetime. S1 is
independently reviewed and tested offline. S2 adds CLI/bin and explicit Node composition,
with lazy credential access and one invocation-owned output child. Parent code performs
no descriptor writes; exact output acknowledgment and child exit 0 are required under
the original Operation. Terminal diagnostics are omitted. Package-root imports still
export no functional API. S3 verifies actual packed installation/shims and ships public
usage/example. Local macOS Node 22/24 checks pass; corrected remote CI remains pending.

## Runtime boundary

Each invocation has bounded input, one possible provider dispatch, zero retries,
cancellation/deadline handling and bounded output. There is no shared queue/counter,
replay prevention, persisted result, revocation ledger or global spend guarantee.
No Hunchcraft-managed disk state does not imply provider zero retention.

Results apply to supplied material only. Consumers discard advice after relevant
request/proposal/evidence changes and still run normal verification. Advice never
authorizes actions or removal of necessary tests. Credentials are not a proof of
human intent, and this design does not isolate hostile same-user processes.

Target Node-supported macOS/Linux/Windows without platform-specific runtime helpers.
Test the actual executable and packed artifact on observed OS/Node combinations.
Portable code is an intention; configured CI is not proof a matrix cell passed.

## Optional extensions and evidence

A shipped consultation skill or public library API can follow a concrete need. Neither
is required to finish the initial CLI. Background/native adapters, persistence and MCP
are deferred, not assumed inevitable. Any adapter must use supported host surfaces,
retain source applicability and own actual lifecycle/delivery. A skill is guidance,
not a worker, and notifications are not proof the model consumed advice.

Quality/cost savings remain hypotheses. [Evaluation plan](evaluation-plan.md) proposes
small separately approved studies after offline correctness. No live/paid calls, host
launches, datasets or publication follow automatically from implementation.
