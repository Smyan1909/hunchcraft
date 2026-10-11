# Architecture

## Goal

Explore a decision layer that assists existing coding agents through both explicit
consultation and automatic/background evaluations; not every judgment must be
asynchronous. Pursue separation of LLM proposal/decomposition from Jev evaluation,
rather than only reviewing completed work. Jev supplies bounded typed judgments;
Hunchcraft code owns its execution, scheduling, and result-consumption policy.

Use supported plugins or a skill plus CLI without reworking fundamental host code,
requiring a custom harness or fork, or replacing the main model. This boundary is
accepted in [ADR 0002](decisions/0002-existing-agent-extension.md); no host or runtime
surface is selected or verified yet. The repository remains a foundation with no
functional decision capability. Continue [technical exploration](design-discussion.md)
before planning implementation, evaluation, or benchmarks, and obtain explicit
user approval of a plan before carrying it out. Any reduction in main-model
deliberation, cost, or elapsed time remains an empirical question, not a guarantee.

## Dependency direction

```text
composition -> integrations -> application -> ports -> core
composition -> providers ------------------> ports -> core
```

An arrow means "may import"; a layer may also import the inner layers shown to
its right. Providers do not depend on application. Integrations receive providers
through injected ports, so each host can use a fake or different backend.

| Layer                 | Owns                                  | Must keep outside                         |
| --------------------- | ------------------------------------- | ----------------------------------------- |
| `core`                | Domain values and pure policies       | SDKs, I/O, process globals                |
| `ports`               | Interfaces needed by use cases        | Concrete backend and host implementations |
| `application`         | Scheduling and consuming decisions    | Concrete providers, host hooks            |
| `providers/<backend>` | Backend-specific translation          | Application policy, sibling adapters      |
| `integrations/<host>` | Host observations and result delivery | Provider construction, sibling adapters   |
| `composition`         | Explicit wiring and configuration     | Domain policy that belongs in core        |

`npm run lint:architecture` checks this direction, provider and integration
isolation, cycles, unresolved imports, and runtime imports of development tools.
These checks also inspect type-only imports; SDK types should not leak inward.

The single root package keeps setup simple. Split packages only when independent
release cycles, consumer dependencies, or build environments justify that cost.
Keep `src/index.ts` host-independent; add explicit package subpaths for implemented
provider or host entry points. Importing an entry point must not start background work.

## Asynchronous lifecycle design

These are design constraints for future implementation, not an implemented protocol:

1. Capture the minimum sufficient observed state, session identity, and a revision
   or fingerprint. Distinguish facts from earlier model inferences.
2. Schedule narrow judgments with bounded concurrency and queue size. Batch
   independent questions over the same state when useful; dependent questions
   require another request after their evidence becomes available.
3. Keep the main agent moving through an actual supported host extension surface.
   Investigate which callbacks the host awaits before claiming work is asynchronous.
4. Associate each result with its request and source revision. Check freshness and
   applicability immediately before consumption; an earlier result may finish last.
5. Define timeout, cancellation, replacement, and provider-failure behavior. A
   stalled assistant layer should not indefinitely stall the main agent.
6. Initialize explicitly and expose disposal. Track and handle every background
   promise; stop intake, cancel work, release listeners, and ignore late completions
   on shutdown. Keep simultaneous agent sessions isolated.
7. Record decision quality, wall-clock impact, model usage/cost, queue pressure,
   and stale/unused results. Calibrate thresholds on representative cases.

If a later, jointly agreed and user-approved plan includes a vertical slice, choose
one host and one bounded decision, compare it with the same workflow without
Hunchcraft, and expand only after the data helps. The host, decision, and actual
contracts remain open choices; this is not an instruction to start planning now.

## Agent instructions versus execution

Development skills instruct agents contributing to Hunchcraft. A shipped skill
can teach an agent how to consult a CLI, but does not itself run a worker. A plugin
and a skill plus CLI have different runtime and lifecycle contracts; investigate
supported observation, await, and result-delivery mechanisms before choosing one.
No host capabilities are established by these design notes.

Explicit consultation may wait for a judgment; background evaluation needs an actual
runtime mechanism. Automatic observation does not imply access to private reasoning
or the ability to inject signals into an in-flight model generation. An agent can
deliberately emit a compact, decision-relevant task artifact without exposing or
recovering private chain-of-thought. Instructions and tools may encourage early
consultation in an unchanged host, but cannot guarantee interception or reasoning
savings. Short visible output alone does not establish reduced internal compute.
