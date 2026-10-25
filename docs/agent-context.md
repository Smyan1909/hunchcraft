# Hunchcraft: shared bootstrap context

Latest user instruction and repository evidence supersede older planning/authorization.

## Accepted direction (2026-10-25 retake)

- **Stateless portable CLI first.** Supplied JSON -> validate/compile -> one Jev
  consultation -> typed advice -> exit. `TYPESAFE_API_KEY` is the only service-specific
  setup. Installation, supported Node, valid input and provider/network access still apply.
- Explicit `consult` invocation authorizes transmission of supplied material under
  documented disclosure. Agent use requires a human-authorized workflow. Key presence
  alone never authorizes scanning, automatic inference or arbitrary disclosure.
- No mandatory session files, ACL helpers, root identity, grant/revoke/status commands,
  shared counters, persistent verify, caches or background process. No same-user hostile
  isolation, cross-process cap, hard spend ceiling or provider zero-retention claim.
- Keep original request/selected evidence, strict bounds, mandatory checks, raw advisory
  Noul/Score judgments, fixed provider policy, sanitized failures and normal verification.
- Extend unchanged hosts. No custom coding harness, host fork or main-model replacement.
- One TypeScript ESM npm package, strict types, inward dependencies and MIT remain.
  Public API, shipped skill, native adapter, persistence and evaluations are optional.

## Read and inspect

1. [System design](system-design.md): active proposed stateless contract.
2. [Implementation plan](implementation-plan.md): S1 migration, S2 CLI, S3 package/usage.
3. [Architecture](architecture.md), [ADR 0004](decisions/0004-stateless-portable-consultation.md).
4. [Evaluation plan](evaluation-plan.md) only when measurement is in scope.

[Legacy specification](system-design-legacy.md), [M1b/M2 handoff](implementation-notes/m1b-m2.md),
ADR 0003 and dated research explain historical contracts; their session/storage and
future-phase obligations are superseded, not current work orders. Old plans are in Git
at `cde4ef8`. Inner brief grammar/compiler remains the starting point; migrate outer
input/results explicitly to v1. Do not fabricate consent/session adapters for production.

## Source status and evidence

Planning milestone **`8c4b3de`** is committed/pushed; its GitHub CI passed
([run](https://github.com/Smyan1909/hunchcraft/actions/runs/40208042659)). S1 implements
closed brief/result v1, policy v1, stateless consultation and a borrowed caller-owned
Operation with one lifetime dispatch claim. S1 milestone **`5b228a7`** is committed/
pushed and its [GitHub CI](https://github.com/Smyan1909/hunchcraft/actions/runs/40209548737)
passed. Session/consent/identity/durable verify
modules and obsolete tests are retired. Inner grammar/compiler goldens, provider source
and dependency pins are unchanged. S1 is independently reviewed offline, including four
added concurrency/mutation cases. S2 adds CLI/bin and explicit Node composition,
independently reviewed offline. Its actual packed-install/platform acceptance remains S3.
No functional public API, shipped skill, host adapter,
live inference, evaluation runner or measured quality/cost/savings exists.

Historical orchestrator acceptance: Windows/Node 24.18.1/npm 12.2.0, `npm run check`
passed **345 tests/13 files**, types/lint/architecture/build/export checks; pack dry-run
**95 files**, excluding test fakes/dummy keys. Do not present these as new macOS/Linux
runs or new-code remote CI. Current CI config targets Linux/Windows and Node 22/24.

`@typesafe-ai/sdk@0.6.0` is the only runtime dependency; TypeScript 6.0.3 stays pinned.
Live docs read 2026-10-25 now describe SDK v0.7.0; no upgrade is included in this retake.
Imports stay inert. Fake-HTTP `provider-http` metadata is not live network/billing
evidence. Missing usage/cost remains unknown, not zero.

## Authorization and coordination

The user subsequently requested implementation and continuous GitHub saving of
reviewed, verified milestones. Bounded offline source/test/package permission does not authorize paid/live calls, private
transmission, host launches, dataset acquisition, automation expansion or releases.
**No live/evaluation budget is approved.** Never put keys in chat, argv, skills or logs.
The orchestrator is authorized to commit/push verified milestones to origin
`Smyan1909/hunchcraft`; specialists do not. Publication, external posts and PRs still
require separate requests.

Use specialists for substantive work, with exact ownership, accepted contract,
acceptance tests and allowed operations. Serialize shared files; do not recursively
delegate. Resolve findings and distinguish self-review from independent review.

Initial specialist starts failed with `DeploymentNotFound`. The user explicitly
authorized `azure-two/gpt-6.1-sol` for this session's specialist calls, leaving repo
model configuration unchanged. Independent reviewer completed planning review with
no blocking findings. Low findings on checkCount 6–16 and fixed v1/in-process message
wording were corrected in the contract. Planning checks are recorded below.

## Next step

Save the verified S2 milestone, then complete packed-artifact/platform/usage work (S3). Do not
start the retired Windows ACL/storage milestone. No credentials or host choice are
needed for the next offline slice.

S2 initially failed real full-stdout-pipe termination: callback `fs.write` left an
uninterruptible worker. Architect and independent reviewer approved one killable,
invocation-owned Node output child (ADR 0005), now implemented. No parent stdout/stderr
descriptor writes, inherited credentials/preloads, replacement output or restart.
Original 15-second Operation spans input through exact acknowledgment and child exit 0;
no deadline reset/additional grace. Ordinary errors emit JSON only while live. After
deadline/cancel/invariant termination, kill/disconnect live output child, dispose and
terminate without awaiting child exit. Terminal stderr is deliberately omitted.
Live output fault exits 1; deadline/interruption exits 5/130. Provider alone owns its
<=1-second cleanup grace. Failed kill/abrupt parent death/hard-real-time reclamation
are not guaranteed. Remaining platform/packed verification belongs to S3.

## S2 verification (2026-10-25)

Developer and independent reviewer full `npm run check` passed **429 tests/16 files**
on macOS/Node 24.22.1/npm 11.17.0, including real blocked stdin/stdout/stderr,
interruption, EPIPE, short/partial writes, IPC faults, child reaping and preload exclusion.
Pack dry-run passed **116 files**, including the worker and excluding private helpers.
Independent reviewer additionally delivered 256 KiB through the actual built worker,
with exact acknowledgment and exit 0. No substantive code findings remain. Orchestrator
final full checks passed **429 tests/16 files**, build/exports/bin help, formatting,
types/lint/architecture and pack dry-run **116 files** on macOS/Node 24.22.1/npm
11.17.0. Root/status docs and ADR 0005 are integrated; independent documentation
review passed formatting/whitespace and 133 Markdown links across 39 files. Its low
provider status clarification is corrected to reflect completed S2 composition.
No Node 22/Windows/Linux/packed-install or S2 remote CI evidence is asserted yet.

## S1 verification (2026-10-25)

Developer full supported-Node checks passed **334 tests/11 files** on macOS/Node
24.22.1/npm 11.17.0. Independent reviewer full checks passed the initial 330-test
S1 and pack dry-run (75 files); after four additional tests, targeted recheck passed
38 consultation tests and resolved the optional coverage finding. No substantive
review findings remain. Orchestrator final `npm run check` passed on macOS/Node
24.22.1/npm 11.17.0: **334 tests/11 files**, formatting/types/lint/architecture,
build and actual package export/declaration checks. `npm pack --dry-run` passed
with **75 files**, excluding retired modules/test fakes. Whitespace checks and
independent Markdown path/heading checks passed (125 links across 37 files).
No live calls, host runs, publication or new S1 remote CI evidence is asserted here.

## Retake verification (2026-10-25)

Orchestrator ran `npm ci` (172 packages installed, audit reported zero vulnerabilities),
targeted Prettier formatting, `npm run format:check`, `git diff --check` and a local
Markdown path/heading checker (125 links checked), all passed. Environment: macOS,
Node 26.4.0/npm 11.17.0, not the supported Node 22/24 verification matrix. Changes
are Markdown only; no runtime tests, host launches, authenticated Jev calls or remote
CI checks were performed. No source/config/dependency change, commit or push. The
locked SDK was installed unchanged. Subsequent independent reviewer ran formatting,
whitespace and an inline-link/heading checker (122 links) and inspected source/contracts.
No blocking findings; both low contract clarifications were incorporated and
independently rechecked. Orchestrator baseline `npm run check` passed on macOS,
Node 24.22.1/npm 11.17.0: 345 tests/13 files, types/lint/architecture/build/package
entry checks. This is baseline verification, not stateless implementation evidence.
