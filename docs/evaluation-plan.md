# Evaluation plan: prove mechanics, then test usefulness

**Replanned 2026-10-25. No live study or measured gain exists.** The old offline
core/application/provider suites exist at `cde4ef8`; the stateless CLI is still planned.
Use [system design](system-design.md) and [implementation plan](implementation-plan.md).
The previous detailed protocol is available in Git at `cde4ef8`, not an active mandate.

## 1. Now: offline correctness

Test the stateless migration and actual CLI/package behavior with fixture providers
and real-SDK/fake-HTTP boundaries. Verify strict input, original-request preservation,
selected evidence, mandatory check routing, typed answers, failures, time limits,
credential handling, inert imports and output-close behavior.

These tests prove mechanical contracts. They do not establish Jev accuracy, live
availability, reduced model reasoning, lower cost or useful host consumption.
No evaluation runner, acquired dataset or host launch is needed to build the CLI.

## 2. Later: a small live judgment check

Only after separate approval of account/terms, disclosure scope, material rights and
a finite budget, freeze a small set of independently labeled cases before calling Jev:

- Valid minimal proposals: does consultation create false alarms?
- Missing requested outcomes, including omissions not named in optional questions.
- Source contradictions versus genuinely missing evidence.
- Necessary tests, compatibility and cleanup: does advice discourage required work?
- Explicit unknowns and unfamiliar-domain cases: where does coverage break down?

Record the model/check versions, every attempt, known/unknown usage, answer quality
and coverage misses. Do not use Jev as its own grader. Whole-proposal gap answers do
not identify individual omitted requirements without additional evidence. Keep tuning
cases separate from untouched confirmation cases. Return all raw advice in production;
do not turn analytical thresholds into undocumented output filters.

If advice is consistently unhelpful or harmful, narrow or revise the artifact rather
than proceeding automatically to a larger study. Typed output alone is not success.

## 3. If warranted: one existing-host pilot

Choose one unchanged host/version and a few representative tasks under separately
approved provisioning, data and spend limits. Use three matched treatments:

| Arm | Workflow                                                                            |
| --- | ----------------------------------------------------------------------------------- |
| A   | Unchanged host without Hunchcraft                                                   |
| B   | Same proposal/evidence preparation as C, without Jev advice or fake positive output |
| C   | Same preparation plus Jev advice                                                    |

Freeze task revisions, budgets, setup, retry rules, grading and stopping criteria before
running. Keep hidden tests/reference solutions outside both main-model and Jev inputs.
Use independent task grading. Reset environments and vary run order to limit confounding.
Do not replace the host's model/tool loop with a custom evaluation harness.

Measure completed-task quality, necessary-work regressions, wall time and whole-task
cost. Include input preparation, retrieval, interpretation, retries, failures and unused
advice, not just the Jev request. Missing cost is unknown, not zero; it may prevent a
total-dollar-savings claim. Compare C against both A and B. Shorter visible prose does
not prove lower compute, and scaffolding-only gains are not Jev gains.

## 4. Decision and scope limits

Report proceed, narrow, adjust, stop or inconclusive, with denominators and uncertainty.
Set practical quality/harm/cost tolerances before the approved pilot; do not invent
successful thresholds afterward. A small pilot is exploratory, not a general benchmark
or proof of universal savings. Any stronger claim needs separately approved held-out
confirmation and sufficient evidence.

Public datasets, leaderboard studies, broad host replication, same-artifact LLM controls
and foreground/background comparisons are optional later work. No dataset or sample
size is selected or acquired by this plan. Background value requires its own lifecycle
and timing study; foreground value does not prove useful overlap.

No live/evaluation budget, host run, dataset acquisition, private-data transmission,
publication or outreach is authorized by this planning pass.
