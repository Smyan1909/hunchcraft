# Implementation plan: the smallest useful CLI

**Replanned 2026-10-25. S1/S2/S3 implemented/reviewed offline; corrected six-cell CI passed.**
The user requested portable, stateless consultation instead of the former persistent
session/OS-security milestone. [ADR 0004](decisions/0004-stateless-portable-consultation.md)
records the change. [System design](system-design.md) owns the implemented CLI contract.

## Goal

An installed CLI reads a supplied brief, validates it, consults Jev using
`TYPESAFE_API_KEY`, returns typed advice and exits. No platform helper, session setup,
repo scan or mandatory host integration is needed. Help and validation work offline.

## Existing baseline: retain work, not unnecessary requirements

`cde4ef8` completes M1a/M1b/M2 offline. The recorded Windows/Node 24 acceptance was
345 tests across 13 files, full checks and a 95-file pack dry-run. Those are historical
results, not a new test run, live validation or evidence of macOS/Linux compatibility.

| Area                                                                               | Next treatment                                                                                                                          |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/strict-json.ts`, inner `brief.ts` grammar, `checks.ts`                   | Retain strict parsing, selected evidence, mandatory questions and bounds; migrate outer input to v1                                     |
| `src/core/result.ts`                                                               | Retain answer/progress/binding/feedback validation; introduce closed stateless results and remove obsolete session-only public failures |
| `src/core/identity.ts`                                                             | Retire context-bound identity from the initial CLI; no mandatory replacement hash subsystem                                             |
| `src/application/operation.ts`                                                     | Reuse bounded lifecycle/cancellation where it fits                                                                                      |
| `src/application/consult.ts`                                                       | Refactor directly into one-shot consult without admission, persistence or completion receipts                                           |
| `src/application/verify.ts`, `src/core/consent.ts`, `src/ports/session-consent.ts` | Retire from the new runtime; remove obsolete modules/tests in a reviewed source slice once references are gone                          |
| `src/ports/clock.ts`, `decision-provider.ts`, `src/providers/typesafe/`            | Keep injection and reviewed SDK boundary; redefine dispatch guard as per-invocation time/cancellation control                           |
| CLI/composition/package                                                            | Implement next; no working bin or public API exists today                                                                               |

No production fake-session adapter. Preserve relevant regressions while removing tests
for deliberately retired behavior. Do not rewrite the compiler/SDK merely to change consent.

## Delivery: three bounded offline slices

### S1 — stateless contract and application migration

**Completed offline:** v1 envelopes/policy, borrowed invocation-wide Operation and
direct session/consent/identity/verify retirement. Compiler goldens/provider source
unchanged. Independent review found no substantive defects; requested concurrency
and mutation regression hardening was added and rechecked. Developer full checks:
334 tests/11 files on macOS/Node 24.22.1. Final milestone evidence is in shared context.

**Owner:** developer after architect/reviewer contract review. Source ownership covers
core/application/ports and their exact tests; assign filenames before editing.

- Review the proposed v1 input/result variants in system design; freeze their fixtures
  and version the execution policy as `hunchcraft.policy.v1`.
- Remove public session/correlation envelope fields and reject legacy v0 input.
- Refactor consult to validate/compile, evaluate once and return validated advice.
- Remove session admission/finalization, persisted freshness and secure-storage errors.
- Keep strict original-request/evidence/check routing and bounded lifecycle safeguards.

**Accept when:** offline fake-provider and real-SDK/fake-HTTP contract tests cover the
stateless success path, invalid input, missing configuration, malformed responses,
deadline, cancellation, late settlement, zero retries and no fake success. Two
independent calls require no shared state. Inert imports remain inert. Retired modules
have no production references. Run `npm run check` and independent diff review.

### S2 — portable CLI and explicit composition

**Completed offline:** strict commands, bounded input/output, lazy configuration,
bin mapping and explicit Node wiring. The original callback-write blocked-pipe test
failed; approved invocation-owned output isolation (ADR 0005) resolves it without
new setup or deadline/grace. Parent never writes descriptors, including stderr.
Developer and independent reviewer full checks passed 429 tests/16 files on macOS/
Node 24.22.1; pack dry-run 116 files. Packed installation/platform matrix remain S3.

**Owner:** developer; assign exact files under `src/integrations/cli/`,
`src/composition/`, process tests and package configuration. Serialize shared contracts.

- Implement only help, stdin validation and stdin consultation.
- Read credentials lazily from the environment for consult; inject fetch/clock/config.
- Implement bounded EOF/output, sanitized JSON failures with the terminal-lifetime
  exception in system design, exit classes and interruption. No output deadline reset
  or additional grace; never append a replacement envelope after any write attempt.
- Add the emitted ESM executable and npm bin mapping; no global library API prerequisite.

**Accept when:** process tests prove help/validate need no key or network, missing-key
consult fails without dispatch, and fake HTTP receives only selected authorized state
and questions. Test invalid args/input, CRLF/Unicode, paths with spaces, EPIPE, blocked
pipes, partial output, deadline during input/output and nonzero-close rejection. Do not
append an error result after partial output. Tests inject fakes privately; no production
fake-success flag or credential bypass. Run full checks and pack inspection.

### S3 — package readiness and concise usage documentation

**Completed locally:** actual archive and installed-byte inspection, cache-only locked
SDK payload comparison, installed inert imports, generated npm bin shims, public example,
Unicode/CRLF, failure exits, EPIPE and POSIX interruption. Usage/example ship with the
118-file artifact. Full checks pass 431 tests/16 files on macOS/Node 22.23.4 and
24.22.1; independent reviewer reran Node 24 and package checks. Linux's old blocked-output
test setup is replaced by verified FIFO saturation, with parent-owned emergency cleanup
and a deliberate hung-fixture regression. All six remote CI cells passed at `ad9945b`,
including actual packed installation. Windows terminal interruption remains unasserted.

**Owners:** developer for package/process tests; marketer for README/usage; reviewer
for correctness and observed portability. Assign disjoint files when working in parallel.

- Test the actual packed artifact without publishing.
- Verify Node 22/24 execution on macOS/Linux/Windows as environments are available.
- Document executable provisioning, env-key setup, input example, disclosure, failures,
  all-advisory interpretation and changed-snapshot rejection.
- Keep unsupported matrix cells explicit. Existing CI covers Linux/Windows, not macOS.
  Add macOS coverage or record actual local evidence before claiming it works there.

**Accept when:** independent findings are resolved/rechecked, `npm run check` and
`npm pack --dry-run` pass, the actual bin resolves, and observed platform evidence is
reported separately from configured tests. Offline tests do not establish live Jev
availability or semantic usefulness. No required skill or host launch to finish S3.

## Removed and deferred work

**Removed from the initial product:** mandatory durable consent storage, Windows ACL
spike, root identity checks, session grant/revoke/status, global admission/attempt caps,
crash recovery and public durable verify. They are not a hidden S4 prerequisite.

**Optional, separately justified:** a public library API, consultation skill, named-host
adapter, caching/persistence, broader task artifacts or background execution. Do not
build these before a concrete use case calls for them.

**Later evidence, not a CLI implementation blocker:** small approved live fixtures,
then one unchanged-host pilot if useful. [Evaluation plan](evaluation-plan.md) keeps
independent grading, scaffolding controls and cost honesty without a benchmark program.

## Authority and review

The user subsequently authorized implementing this plan and saving reviewed, verified
milestones to GitHub. Bounded offline implementation permission does not authorize paid/live Jev/main-model
calls, host launches, dataset acquisition, releases, npm publication or outreach.
The orchestrator commits/pushes verified milestones under that request; specialists do not.

Use architect input for changed contracts, developer for implementation, reviewer for
independent inspection and fixes/recheck. Involve evaluator only for measurement work
and marketer for usage docs. Do not invoke the entire team for every slice.

## Current next action

Independent planning review completed on 2026-10-25 with no blocking findings. The
two low-severity corrections are incorporated: validation check count 6–16 and
v1/in-process fixed error wording. S1/S2/S3 are implemented and reviewed locally;
verified milestones are saved and corrected remote CI passed. The accepted offline
CLI is complete. Await a user-selected next milestone; no live budget or publication
is authorized. Do not start retired secure storage. The user authorized the
working specialist model for this session; repository agent configuration is unchanged.
