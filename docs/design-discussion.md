# Design discussion: proposals, judgments, and existing agents

These distilled notes preserve project conclusions as discussion progresses; they
are not a transcript, an implementation plan, or an API specification. Update them
when conclusions change, keeping accepted choices separate from hypotheses.

**Status:** technical exploration. No new functional capability, host integration,
Jev provider, background loop, evaluation, or benchmark is implemented. See
[architecture](architecture.md), [shared context](agent-context.md), and the
[foundation ADR](decisions/0001-typescript-foundation.md).

## Agreed direction

- **Extend existing agents.** Use supported plugins or a skill plus CLI without
  fundamental host rework, a custom harness/fork, or main-model replacement.
  [ADR 0002](decisions/0002-existing-agent-extension.md) accepts this boundary only;
  the host and distribution surface remain unchosen.
- **Support both modes.** Explicit agent consultation and automatic/background
  evaluations are desired. Not every judgment must be asynchronous.
- **Separate proposing from judging.** Pursue LLM proposal/decomposition paired
  with Jev evaluation, rather than just background review. One possible aim is
  less expensive main-model deliberation; there is no evidence of savings yet.
- **Use a provisional planning standard.** Early consultation may start from
  plausible mechanisms with explicit unknowns, rather than demonstrated support
  for every mechanism. Strengthen evidence as decisions become concrete; an early
  judgment is not implementation proof. Known source conflicts remain distinct
  from unresolved dependencies, and unknowns do not establish nonexistent capabilities.
- **Separate judgment-framing responsibilities.** Hunchcraft supplies reusable
  evaluation criteria; the user and applicable repository conventions supply
  contextual standards; the main LLM supplies proposal material and optional neutral
  local questions; code can instantiate known subjects; Jev evaluates. This accepts
  the high-level responsibility split, not a concrete rubric, schema, algorithm,
  check-selection mechanism, or authority policy. The LLM need not diagnose its
  proposal or enumerate every possible failure before consultation.
- **Explore before planning.** Continue collaborative technical discussion before
  planning implementation, evaluation, or benchmarks. Obtain explicit user approval
  of a plan before carrying it out; documenting an idea is not approval to build it.

### Shared example, not a selected first slice

For a feature request, the LLM could emit a compact provisional outline of core
components grounded in the repository. Jev could evaluate relevance, cleanliness,
and fit to the desired outcome, with signals returned for the agent to use.
Critiquing one plan does not require enumerating alternatives. This illustrates
the intended separation; it does not establish feasibility or prescribe a workflow.

The judge needs the original request and relevant source evidence, not only the
proposer's interpretation. Otherwise, a missed requirement or misleading framing
can be carried into both proposal and evaluation.

### Artifacts are not private reasoning

The main model can deliberately emit a short, decision-relevant task artifact
without exposing or recovering private chain-of-thought. Producing that artifact
need not require long deliberation. However, a short visible answer alone does
not establish that the model used less internal compute.

In unchanged hosts, instructions and tools can encourage consultation early in a
task. They do not guarantee that the agent consults before deliberating, intercept
internal reasoning, or guarantee savings. Automatic observation likewise does not
imply access to private reasoning or injection into an in-flight generation.
A skill is guidance; it does not itself run a background worker.

## Exploratory hypotheses

### A "decision brief"

A possible name for the task artifact is **decision brief**. It might contain an
objective, the original request, evidence, constraints, a proposal or options,
and an evaluation question. This is an exploratory artifact, not an accepted
schema, API, serialization format, or required set of fields. Options may be
unnecessary for single-plan critique.

The useful question is what the judge needs to evaluate a bounded proposal without
turning the brief into another expensive planning exercise or losing source facts.

### Bounded propose/judge/targeted-expand

One discussion hypothesis is to make a compact proposal, obtain focused judgments,
then expand only the parts needing attention. This is not an accepted algorithm.
Whether it reduces deliberation, improves outcomes, or merely adds overhead remains
unknown. No iteration limit, threshold, queue, fallback, API/protocol, or authority
policy has been selected.

### Judging a provisional outline

The provisional planning standard above is agreed. The following example and check
designs remain exploratory rather than an accepted rubric, schema, or decision policy.

Consider a request to export all filtered rows as CSV while keeping the interface
usable. A hypothetical outline proposes serializing the visible table rows and
adding a loading indicator. Supplied source shows that the table receives only
the current page. The data source conflicts with the requested scope; the presence
of a loading indicator alone does not establish a responsiveness mechanism. Whether
another API can retrieve all matching rows remains unknown without its contract.
These are illustrative facts, not observations about Hunchcraft or live Jev results.

Three distinctions could make feedback more useful:

- **Contradiction:** supplied evidence conflicts with a proposal claim.
- **Missing evidence:** supplied material does not establish a needed fact; this
  does not by itself show that the proposal is wrong.
- **Model uncertainty:** a dispersed answer distribution does not identify whether
  evidence is missing, wording is ambiguous, or multiple options are reasonable.

These can coexist across different claims. Asking Jev about evidence sufficiency
is itself a fallible judgment, not a completeness guarantee.

Checks could run in both directions: requested outcomes against the combined
proposal, and proposed components against the request, constraints, or necessary
supporting work. Focused relationship checks would also matter: individually
relevant retrieval and serialization components need to agree on which filtered
data is being exported. Necessary tests and cleanup should not be pruned merely
because their contribution is indirect. Interactions do not justify asking one
unbounded question about the entire architecture.

A candidate input approach preserves the original request and authoritative
clarifications, component responsibilities and decisive relationships, actual
source excerpts, and explicit distinctions between observations and assumptions.
Paths or evidence handles locate material; they do not substitute for its contents.
Reuse evidence already read where sufficient, expanding only when an important
claim needs more support. This does not guarantee that selection found all relevant
or contrary evidence, and source text must still be treated as untrusted data.

A reusable rubric plus bounded task-specific checks might balance general coverage
with details such as all-filtered rows versus visible-page rows. General checks
can be superficial; generated task-specific checks can inherit proposer omissions.
Neither approach guarantees completeness. Requirement/constraint signals should
remain distinct from cleanliness preferences and missing evidence.

Feedback need not invent a prose explanation: retain the judgment's association
with its exact question, implicated component or requirement, and supplied evidence.
A renderer could identify a flagged scope check and point to the pagination excerpt
without claiming Jev generated a diagnosis or proved the implementation incorrect.
The actual feedback format and subsequent agent behavior remain open.

The agreed standard allows plausible mechanisms with explicit unknowns at early
consultation. Planning-stage suitability must not be confused with implementation
proof. Which evidence becomes necessary at later decision points remains open.

### Who frames the judgments?

The high-level responsibility split is agreed. The remaining question is how to form
useful checks without requiring the main LLM to perform the evaluation first.
Hunchcraft-owned reusable questions could
cover recurring dimensions, while the original request, proposal, and repository
evidence instantiate their subjects. Bounded task-specific questions could supplement
them, but their author, generation cost, and protection against proposer omissions
remain unresolved. Supplying a check or concern must not be treated as supplying its
answer. No concrete question-generation mechanism or rubric is accepted.

The agreed roles and their still-open operational details are:

- **Hunchcraft authors reusable evaluation intent and criteria.** Candidate check
  families include requested-outcome coverage, source consistency, component
  justification, and responsibility boundaries. The proposer should not be the
  sole selector of baseline checks; their actual scope and applicability remain open.
- **Users and applicable repository conventions supply contextual standards.**
  Preserve provenance and distinguish authorized requirements from assumptions or
  arbitrary instructions embedded in source data. Standards can conflict or need
  clarification; they are not all equivalent in authority.
- **The LLM supplies proposal material and optional local questions.** Responsibilities,
  mechanisms, known assumptions, and evidence can be stated without first producing
  a failure diagnosis. The LLM may add neutral task-specific questions, but should
  not have to predict Jev's answer or invent every check before consulting it.
- **Code instantiates already-identified subjects into reusable questions.** Filling
  a known requirement or component into a template can be mechanical. Extracting
  complete requirements from an unstructured request is semantic work and remains
  fallible; retain the original request rather than trust the extracted list alone.
- **Jev judges supplied questions.** It can select among an authored check library
  if given bounded candidates, but it does not generate new questions. Such selection
  adds cost and coverage risks; it is an optional alternative, not an accepted stage.

For the CSV example, "Does the proposed source cover all filtered results given
the supplied pagination contract?" does not require the proposer to diagnose a
failure first. "Confirm the loading indicator keeps the interface responsive"
presupposes support that needs evaluation; a mechanism-focused check would instead
ask whether the outline identifies how interaction is preserved during export.
Neutral wording reduces answer-smuggling but does not guarantee unbiased judgments.

Reusable or domain-specific check libraries could be developed outside individual
agent turns, amortizing authoring effort. A separate LLM could propose bespoke
questions, but its latency, semantic validation, and shared-error risks could move
expensive work upstream rather than remove it. Neither is a selected design.
TypeSafe's autoresearch cookbook demonstrates LLM-authored questions judged by Jev
in a labeled wine-review feature-discovery workflow, not live coding-agent savings.

The next useful distinction is whether early consultation should require the LLM
to enumerate implicit domain obligations (for example, CSV escaping) or let reusable
domain checks supplement its outline. Mechanically instantiating questions cannot
discover arbitrary missing obligations. Correctness constraints should be separated
from new product scope; the fallback for unfamiliar tasks remains unresolved.

### Readiness and remaining material questions

The discussion now provides a coherent conceptual foundation; another broad theory
layer is not necessary before targeted feasibility work. It does not yet provide an
implementation-ready design. These are gaps to discuss, not accepted policies or an
implementation/evaluation plan:

1. **Host observation and delivery:** identify supported public artifacts, what the
   host awaits, and when a judgment can reach the agent before its decision passes.
   Explicit consultation and background assistance may need different mechanisms.
2. **Feedback influence:** decide what a signal should prompt and how stale,
   uncertain, contradicted, unsupported, or unavailable judgments are treated.
   Positive judgments do not authorize actions or certify correctness.
3. **Evidence and domain coverage:** retain source grounding and an honest limit
   for implicit obligations and unfamiliar tasks. The agreed roles do not guarantee
   completeness or select a domain-specialization mechanism.
4. **Privacy and bounded failure:** define what user/repository material may be sent
   to Jev and under which permission, plus behavior on timeouts, provider errors,
   and finite work/spend limits. No data-sharing or fallback policy is accepted yet.
5. **Whole-loop value:** identify the deliberation or error the exchange could avoid,
   accounting for proposal preparation, retrieval, feedback consumption, and rework.
   Actual benefit remains empirical; no benchmark protocol is chosen.

For a later scoped plan, establish a credible host path and behavioral, evidence,
data-sharing, and failure boundaries. Concrete wording, thresholds, check sets,
and budget tuning need not all be settled now; they can be explicit experimental
variables in a subsequently agreed plan. No host or feature is selected here.

## Judgment boundaries and risks

- **Semantic judgment is not verification.** Jev evaluates supplied state; it does
  not gather repository evidence, run tests, prove correctness, or generate code
  or explanations. Keep exact checks, calculations, and actual evidence gathering
  separate from semantic evaluation.
- **Do not average away requirements.** A clean-looking proposal that misses a
  required outcome is still deficient. Preserve requirement-fit signals separately
  from compensating preferences such as cleanliness; the composition policy is open.
- **Relevance is not just visible feature work.** Filtering should not remove
  necessary support work such as tests, compatibility handling, or lifecycle cleanup.
- **Coverage matters.** Missing candidates or incomplete evidence can prevent a
  useful answer. A confident judgment over inadequate state is not workflow correctness.
- **Errors can correlate.** Shared framing, missing evidence, and model mistakes
  can make proposer and judge agree for the wrong reason. A second model is not
  automatically an independent check.
- **Freshness depends on the judgment.** Identify which changes invalidate a signal,
  retain its source state identity, and recheck applicability at consumption. A result
  can become stale between completion and use; age alone is not a sufficient rule.
- **Runtime support must be verified.** Observation, hook await semantics, timing,
  result delivery, permissions, and lifecycle are host-specific open questions,
  not capabilities established by a skill or these notes.

## Source evidence reviewed

The following live TypeSafe pages were reviewed on 2026-10-11. They inform the
discussion, not evidence that Hunchcraft works or a host supports a proposed hook.

- [System One](https://docs.typesafe.ai/concepts/system-one.md) and
  [Jev with coding agents](https://docs.typesafe.ai/introduction/coding-agents.md):
  Jev returns typed judgments, not generated code/text, and is not a drop-in
  replacement for a coding agent's LLM.
- [State](https://docs.typesafe.ai/concepts/state.md),
  [building guide](https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md),
  and [primitives](https://docs.typesafe.ai/primitives.md): supply relevant evidence,
  ask focused questions, and keep deterministic control and side effects in code.
- [Confidence](https://docs.typesafe.ai/confidence.md): Choice/Score confidence
  summarizes a probability distribution, not overall correctness or permission
  to act. Noul returns a yes probability without separate confidence.
- [Composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md): separate
  preference dimensions can be combined with code-owned weights. This does not
  establish a rule for trading away required outcomes or unresolved evidence.
- [Speculative fan-out](https://docs.typesafe.ai/patterns/fan-out.md): questions in
  one request are independent over the same state. That provider-level parallelism
  does not establish nonblocking host execution; dependent evidence may need a
  subsequent request, and extra questions still consume tokens.
- [Skill suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion.md):
  a narrow Hermes-roster/Haiku experiment using `jev-1.12` on 488 synthetic single-turn
  requests reports improved skill-load selection, with some regressions. It is not
  evidence of coding performance, asynchronous benefit, or generalization to our
  proposal/judgment idea. Its harness is not an accepted Hunchcraft integration.
- [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md):
  documented risks include literal reading, indirection, irrelevant state, numeric
  precision, adversarial content, and option-order sensitivity. These observations
  are version-specific, not permanent limits for every Jev version.
- [Noul](https://docs.typesafe.ai/primitives/noul.md): reusable question wording and
  per-subject data can be combined in structured instructions; IDs are bookkeeping,
  not model-visible meaning. This supports mechanical instantiation once subjects
  exist, not guaranteed semantic coverage.
- [Autoresearch feature discovery](https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery.md):
  a separate LLM proposes questions, Jev supplies numeric judgments, and supervised
  feedback selects features. That wine-review example illustrates distinct roles;
  it does not establish an efficient question-generation stage for Hunchcraft.

## Open questions

1. What compact evidence lets Jev judge a provisional component outline against
   the original request without relying solely on the LLM's framing?
2. Which questions separate requirement coverage, relevance, cleanliness, and
   desired-outcome fit without demanding a broad multi-hop reasoning task from Jev?
3. How should missing evidence, disagreement, and necessary support work be surfaced
   without premature filtering or a misleading aggregate score?
4. When would explicit consultation be useful, and when could automatic/background
   evaluation produce a signal before the relevant decision has passed?
5. Which supported candidate-host surfaces can observe public task artifacts and
   return signals? What do they await, and what lifecycle/permission limits apply?
6. How much influence should a signal have, and when should the agent gather evidence,
   expand a proposal, disregard a stale result, or ask the user? Authority remains open.
7. After exploration, what would count as evidence of useful judgment and reduced
   deliberation rather than shorter output? No evaluation or benchmark plan is set.

## Next suggested discussion

Move from broad conceptual discussion to targeted feasibility: identify where a
judgment could reach an unchanged agent in time to affect a decision, then examine
candidate hosts' current supported observation, await, and delivery surfaces. Address
feedback influence, coverage limits, privacy, and failure boundaries before proposing
an implementation-ready plan. Do not select a host or first slice prematurely; obtain
explicit user approval before carrying out a subsequent plan.
