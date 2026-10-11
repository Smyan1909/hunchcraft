# TypeSafe provider: internal M2 boundary

`createTypeSafeProvider` returns the internal SDK-free `DecisionProvider` port with
`origin: "provider-http"`. Nothing is package-root exported. This slice has no CLI,
environment reader, private storage, production composition or live authorization.
The caller must supply lazy asynchronous configuration, fetch and a clock; there
are no global-fetch or real-clock defaults. Import and factory creation do not
construct a client or read credentials. Each admitted evaluation constructs its own
client, sends at most one request and disposes its owned waits/listeners/readers.

- `configuration.ts` validates a selected unknown snapshot with exactly four own
  fields (`apiKey`, `baseURL`, `defaultModel`, `logLevel`, each string or undefined).
  Configuration strings alone are trimmed. Missing keys and conflicting endpoint/
  model overrides fail without echo. Logging is forced off; an ignored nonblank
  override is represented only by a boolean, with no diagnostic output here.
- `provider.ts` translates owned M1a state/questions into fresh SDK-compatible
  mutable JSON containers. Local request/session/scope/context, root/salt/hash and
  consent metadata are not transmitted. Root named SDK exports are used; no SDK
  type crosses into core/ports/application. Runtime core validation is mandatory,
  regardless of SDK generic answer types. Full Noul/Score distributions remain
  advisory; no filtering, generated explanation or approval certificate is added.
- `transport.ts` checks the actual SDK URL, POST, authorization, protocol headers,
  exact compact body and RequestInit fields before entering the one-shot guard.
  It races both application and actual SDK attempt signals across guard/fetch/body,
  checkpoints elapsed time, and prohibits a second underlying dispatch. Redirects
  use `redirect: "error"`; every observed 3xx is refused. Attempts become 1 immediately
  before calling the underlying function, including synchronous throws. Complete
  immutable progress snapshots retain known status/request ID/usage monotonically.

Success **and error** bodies are counted as decoded byte chunks before SDK buffering,
maximum **256 KiB**. Content-Length is not authoritative. One fixed-budget buffer
rejects overflowing chunks before copying them. Strict UTF-8/duplicate decoded keys/
depth/finite-number/exact integer usage checks precede SDK parsing. Only strict parsed,
independently valid usage survives another response-contract or HTTP failure; malformed,
duplicate, oversized or non-JSON bodies yield unknown usage, never fabricated zero.
Only ASCII `[A-Za-z0-9_-]{1,128}` request IDs and integer 100–599 status are retained.
SDK messages, error objects, prose, headers, causes and stacks never enter outcomes.
Transport-owned fixed markers survive SDK wrapping. Catch paths recognize classified
exceptions only through core's private-brand `classifiedFailure`
helper, never `instanceof` or an unknown exception's payload/code properties. Forged
prototypes/accessors are sanitized; constructed failures retain frozen validated data.
Attempt abort/connection failures
use `provider_connection`; application owns whole-deadline/cancellation precedence.

Cancellation closes/cancels owned bodies and observes read/fetch/cancel losers.
In-flight cancellation acknowledgments share at most one **1,000 ms** injected-clock
grace. A response arriving after disposal is cancelled immediately with rejection
observation, without starting a new timer or awaiting an unbounded acknowledgment.
Timer/listener disposal faults cannot strand a wait: every listener removal is
attempted and settlement always resolves. A disposal fault turns success into fixed
`internal_failure`; an already selected failure remains primary. Cleanup is best
effort if an injected cancellation/removal itself fails; no raw fault is retained.
Ignoring-abort dependencies can remain unresolved: finite local return is not proof
of remote cancellation, billing cancellation or complete resource reclamation.
The tiny last-check-to-dispatch race remains, as does the caller's freshness check.

## Locked SDK audit (2026-10-11, source evidence)

Installed npm artifact **`@typesafe-ai/sdk@0.6.0`**, MIT, no runtime dependencies,
Node engine **`>=20`**, root ESM runtime `dist/index.mjs` and declarations
`dist/index.d.mts`. Lock/registry integrity:

```text
sha512-IddX+Q0XM+VagOUZFeP7wZjaO4SHMdvnh2zEBdrZZnXedWI3BNK1lKhMx3ayrkFWvVLbVcUHJy6AVZlY+e6Jaw==
```

Installed declarations and bundled source were read, alongside the
[v0.6.0 tagged client](https://github.com/typesafe-ai/typesafe-sdk-js/blob/v0.6.0/src/client.ts),
[live SDK guide](https://docs.typesafe.ai/sdk/javascript.md),
[configuration](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md),
[request options](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RequestOptions.md),
[APIPromise](https://docs.typesafe.ai/sdk/javascript/api/classes/APIPromise.md), and
[HTTP API](https://docs.typesafe.ai/api.md). Actual usages typecheck against TypeScript
**6.0.3**, without assertions converting core values to SDK schemas or a TS upgrade.
The SDK's own development TS version is not a consumer requirement.

Constructor options explicitly set all four environment-fallback properties, injected
fetch, no default headers, browser refusal, logging off, retries 0 and timeout at most
`min(10_000, remainingMs)`. Its automatic headers comprise six header names:
Authorization, Accept, Content-Type, User-Agent, X-TypeSafe-SDK and X-TypeSafe-Runtime
(User-Agent and SDK both carry `typesafe-sdk/0.6.0`). Runtime value must exactly match
the current Node version/platform/architecture, not arbitrary client data. No generated
nonce or request-ID header is sent; X-TypeSafe-Retry-Count is absent on attempt zero.
The SDK reads Node runtime metadata at import, but not TypeSafe credentials. It has
no public client disposal method. Its native attempt timer/controller are distinct
from the application controller; tests exercise them with Vitest fake timers.
An adapter-owned forwarding controller aborts outstanding SDK work on disposal
even if elapsed-deadline notification from the application clock was delayed.

The SDK drains `response.clone()` (tee), then reads original body text and uses
`JSON.parse` without answer validation. Here the original external stream is never
given to that tee: the reconstructed Response contains only capped bytes and safe
headers. Peak buffering includes the adapter's fixed buffer, Response byte copy,
bounded SDK tee queue, text and parsed JSON, plus reconstructed domain data. There
is no unbounded tee; these are bounded extra representations, not zero-copy claims.

All provider and consultation tests use **dummy credentials and fake HTTP functions**.
`provider-http` metadata describes this boundary's observations, not a claim that a
packet left or an attempt was charged. No authenticated provider request, semantic
calibration, secure-state platform verification, host runtime or savings measurement
was performed. M3 must supply reviewed secure admission and explicit credential/
transport/clock composition before any approved live use. See the
[frozen handoff](../../../docs/implementation-notes/m1b-m2.md) and
[canonical sections 8–9](../../../docs/system-design.md#8-foreground-lifecycle-provider-boundary-and-validation).
