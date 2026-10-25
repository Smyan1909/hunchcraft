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

At inspected HEAD **`cde4ef8`**, M1a core, M1b session-based consult/verify and M2
TypeSafe provider are implemented, reviewed and verified **offline**. The 2026-10-25
retake changes planning only. Stateless envelopes/application, CLI/bin and production
composition do not exist. No functional public API, shipped skill, host adapter,
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

Migrate core/application contracts offline (S1), then implement the CLI (S2). Do not
start the retired Windows ACL/storage milestone. No credentials or host choice are
needed for the next offline slice.

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
