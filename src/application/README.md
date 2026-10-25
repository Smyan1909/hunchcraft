# Application

Host-independent use cases and asynchronous orchestration. Depend on core, ports,
and other application modules only. Own scheduling, concurrency bounds,
cancellation, freshness checks, and the policy for consuming decisions.

Inject providers and I/O through ports. Keep provider SDKs, host hooks, concrete
logging libraries, and process configuration outside this layer.

M1b implements internal `consult` and `verify`; nothing is package-root exported.
These are the legacy session-based contracts. The
[stateless plan](../../docs/implementation-plan.md) will refactor consult and retire
durable verify, not inject fake consent into production. That migration is not implemented.
Caller-supplied briefs must be owned `parseBrief` results and `startedAt` must be
captured before input work. Hashing, clocks, consent and providers are injected.

- `operation.ts` owns one 15-second deadline callback, cancellation forwarding,
  per-wait observers, elapsed checkpoints, first-cause failure and disposal. Losing
  promises remain observed; late results cannot become ready.
- `consult.ts` compiles/hashes, checks scope, admits once, guards one evaluation,
  reconstructs every typed response, prepares private owned bytes without I/O,
  commits exact timestamps, and rechecks consent before returning ready. Ready means
  prepared/committed, not emitted or consumed. Failure after ambiguous admission
  requests an owned terminal intent; possible completed writes use delivery-unknown.
  Once a closed matching reservation confirms admission, cleanup requires a
  persisted receipt; `not-admitted` is acceptable only for an ambiguous admission
  whose adapter confirms it was fenced without commitment. A false receipt yields
  unconfirmed cleanup, not a claim that an active/completed record was released.
  Cleanup has one fresh-controller 1-second grace and reports unconfirmed persistence
  honestly. No retry, worker, credential access, production fake or storage exists.
- `verify.ts` reconstructs explicit internal/production-JSON format and compares full
  current compilation, digests, session/request/root and exact stored completed pair.
  It performs reads/hashes only, then rechecks consent/time; no inference or writes.

Wall rollback beyond one observed second fails closed. Machine clock trust remains
necessary; unobserved host edits and small/between-process rollback can be invisible.
Verification is not provider authentication or action authorization. Secure storage
is no longer an initial-product prerequisite. Planned CLI work still owns bounded
rendering/emission and successful-close checks. Offline fakes prove mechanics only;
no live provider or platform verification is claimed.
