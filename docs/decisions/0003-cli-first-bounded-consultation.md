# 0003: CLI-first bounded proposal consultation

Status: partially superseded by [ADR 0004](0004-stateless-portable-consultation.md)

> Historical decision for the source implemented at `cde4ef8`. ADR 0004 replaces
> mandatory persistent consent/storage and session-bound runtime envelopes. The
> [current design](../system-design.md) governs new work; retained inner grammar and
> checks come from the [legacy contract](../system-design-legacy.md).

Date: 2026-10-11

## Context

The user approved CLI-first delivery, human-scoped session/repository disclosure
consent, and starting implementation after the planning milestone is complete.
Parallel primary-source research, canonical specification, implementation sequencing,
and evaluation design are recorded in the planning packet. Independent review resolved
partial-output commitment, cross-process clock claims, and evaluation issue-credit
ambiguities. No semantic model experiment or host runtime verification has occurred.

## Decision

- Implement the reviewed [proposed v0 contract](../system-design-legacy.md) in bounded
  offline slices, following [the implementation plan](../implementation-plan.md).
  The initial slice is strict brief parsing/validation, mandatory check compilation,
  pure canonical identity representation, and meaningful offline fixtures.
- Use explicit foreground consultation before opt-in host-specific automation.
  Retain the existing-host boundary in [ADR 0002](0002-existing-agent-extension.md).
- Preserve the original selected request and actual supplied evidence. Compile
  reusable checks without proposer veto; return typed advisory signals, not a
  correctness certificate, action permission, automatic test deletion, or prose
  explanation attributed to Jev.
- Keep credentials and consent separate. Human consent is scoped; private state
  storage and cross-process admission must be verified before production wiring.
  Same-user cooperating-caller guardrails are not adversarial isolation.
- Freeze the specification's M1 grammar, literal templates, ordering, bindings, and
  canonicalization as implementation defaults through coordinated technical review.
  Numerical limits and operating choices were not individually selected by the user.
  Changes require contract review and explicit versioning rather than improvisation
  in consumers or adoption of earlier research sketches.

This record accepts an implementation direction and reviewed offline contract. It
does not make design commands runnable, prove the templates useful, or authorize
live calls, host launches, paid evaluations, dataset acquisition, or releases.

## Consequences

- Proposed v0 is deliberately limited to small component outlines and finite
  mandatory checks. Capability-based portability is not unlimited feature coverage.
- M1 needs no new dependencies or network. Hash computation stays outside pure
  core; tests may independently compute digests using Node crypto.
- M1b uses injected test-only consent, time, hashing, and provider capabilities.
  Production cannot fall back to synthetic success or an in-memory consent bypass.
- Windows ACL/root identity and local-state transaction durability remain later
  offline platform gates. Failure must disable activation, not weaken privacy.
- [Evaluation](../evaluation-plan.md) separates unassisted, scaffolding-only, and
  Jev-assisted workflows. Global gap answers get proposal-level credit, not invented
  per-issue localization. Actual quality and savings remain unknown.

## Reconsider when

- Offline tests or implementation reveal inconsistent or impractical contract rules.
- The bounded outline is too costly to prepare or excludes the intended use cases.
- Provider interoperability or platform storage cannot meet the reviewed requirements.
- Approved live studies show poor coverage, harmful feedback, or no useful net benefit.

Reconsideration returns to the orchestrator and the appropriate specialist review;
changes to user authority, disclosure scope, or fundamental host boundaries require
user agreement. No hidden scope expansion is authorized by this record.
