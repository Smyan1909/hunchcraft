---
name: hunchcraft-async-decisions
description: Designs and verifies Hunchcraft asynchronous decision workflows. Use for background scheduling, state snapshots, stale results, cancellation, concurrency, provider failures, lifecycle management, or agent-enhancement experiments.
---

# Asynchronous decisions

Read `docs/architecture.md` and load the TypeSafe skill for Jev-related work.
Consult current TypeSafe SDK, state, primitives, confidence, and fan-out docs as
relevant. Keep decisions and observed facts separate.

## Define the lifecycle before implementation

1. Identify one bounded judgment and its minimum sufficient evidence. Specify
   how its result can help the main agent and how to measure that benefit.
2. Capture session, request, and source revision/fingerprint. Define exactly which
   state changes invalidate the result, and how it expires or is superseded.
3. Keep independent questions over shared state together. Speculative branches
   need explicit premises; consume only applicable answers. Answers in one request
   cannot depend on other answers from that request.
4. Set bounds for in-flight requests and waiting work. Choose replacement,
   coalescing, or dropping behavior deliberately; measure token cost as well as latency.
5. Keep host hooks short according to the host's actual await semantics. Track
   owned background tasks and handle their rejection; `void promise` is not a strategy.
6. Define cancellation, deadlines, provider failures, and shutdown. Stop intake,
   remove listeners, cancel requests, and suppress late delivery on disposal.
7. Re-check freshness immediately before consumption. Cancellation alone cannot
   guarantee that a service or already-completed operation will stop.

## Decision policy

Use Choice for one candidate, Noul for a condition, and Score for a defined degree.
Include no-match when appropriate and verify candidate coverage. Keep fallback and
threshold policy in code. Calibrate on representative inputs; distribution
confidence is not overall workflow correctness. Keep unused branch uncertainty
out of the decision. Avoid retrying superseded work or inventing missing evidence.

## Verify concurrency and value

Use injected fakes, deferred promises, and controllable time. Test overlapping
sessions, reversed completion order, changed revisions, cancellation, timeouts,
queue saturation, service rejection, and disposal with late completion.

Keep default checks offline. Compare opt-in live experiments to an unassisted
baseline; record task outcome, decision quality, model/question version, end-to-end
latency, token cost, and stale/unused rate. Report measured improvements, not just
typed-output validity. Run `npm run check` after implementation.
