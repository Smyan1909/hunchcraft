# Application

S1 implements one stateless internal consultation with explicit provider and
Operation injection. Dependencies point inward to ports/core; there is no SDK,
credential reader, storage, composition, CLI or public package-root API here.

`consult({bytes, operation}, {provider})` strictly parses the supplied v1 document,
compiles all checks, evaluates once, revalidates the complete outcome and returns
either `{status:"ready",result}` or `{status:"error",failure,outcome}`. The failure
retains internal exit classification; `outcome` is the closed sanitized v1 wire
envelope. There is no preparation callback, admission, receipt or persistent verify.
Production completion still requires `completedJudgmentEnvelope`; test fixtures
cannot pass that projection. Nothing emits output in this layer.

The caller **owns** the Operation: create it before stdin reading, borrow it for
consultation, checkpoint immediately before consumption/output and dispose in a
caller `finally`. Consultation never resets its 15-second deadline or disposes it,
on success or failure. The timer and caller cancellation remain active through
eventual output. An ordinary dependency rejection does not terminate the Operation;
sanitized error output can use its remaining time. Cancellation, deadline, disposal
and invariant failures invalidate further consumption. S2 must own bounded failure
diagnostics and emission under those terminal conditions.

`operation.ts` uses injected wall/monotonic readings, one deadline callback and
owned wait observers. It detects observed monotonic rollback and wall rollback
greater than one second. This is in-process fault detection, not durable freshness
or trusted machine-time proof. `claimDispatch` is invocation-local and never resets
if consultation is mistakenly repeated with the same Operation. There are no shared
caps, queue, retries or global worker. Dispatch guards recheck time/cancellation;
validated progress cannot regress, change identity/known usage, or claim dispatch
before the guard succeeds. Closed final answers must agree with observed progress.

Wait losers and late rejections are observed; late advice/progress is suppressed.
Disposal is idempotent, attempts timer/listener removal independently and always
aborts owned waits even when cleanup throws. No application cleanup wait or fresh
deadline is introduced. The unchanged TypeSafe boundary owns at most one 1-second
cleanup grace. Ignoring-abort dependencies can remain unresolved; finite local
return is not a guarantee of remote cancellation, resource reclamation or stopped
billing. See the [contract](../../docs/system-design.md) and
[offline tests](../../tests/README.md). Consumer snapshot tracking and normal task
verification remain mandatory; advice is not action permission.
