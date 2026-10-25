# Use the stateless CLI

Hunchcraft reads one supplied JSON brief from stdin, validates and compiles it,
optionally consults Jev once, returns a result and exits. It does not inspect your
repository or execute advice.

## Install from a checkout or local tarball

Hunchcraft is unreleased at version `0.0.0`. Do not assume `npm install hunchcraft`
or `npx hunchcraft` retrieves this implementation.

Use Node.js 22.13+ on the 22.x line or Node 24.x, and npm, for checkout tooling.
The installed package declares a Node runtime floor of 22.12.0. Portability targets
macOS, Linux and Windows on Node-supported hardware. See [shared context](https://github.com/Smyan1909/hunchcraft/blob/main/docs/agent-context.md)
for observed checks. Actual packed-install/shim checks and full local macOS checks
passed on Node 22.23.4 and 24.22.1. Corrected six-cell remote CI remains pending.
The earlier S2 Linux blocked-output setup defect is repaired; its failed run is not
Linux acceptance. S2 Windows Node 22/24 CI passed. A configured matrix is not evidence
that it passed.

From the repository root:

```sh
npm ci
npm run build
node dist/composition/cli.js --help
```

To build an actual tarball without publishing:

```sh
npm pack
```

`prepack` rebuilds the package. At the current version, the artifact is
`hunchcraft-0.0.0.tgz`. Install that file in a separate directory, not over the checkout.
The following relative paths assume the checkout directory is named `hunchcraft`:

```sh
mkdir ../hunchcraft-local
cd ../hunchcraft-local
npm init -y
npm install --ignore-scripts --no-audit --no-fund ../hunchcraft/hunchcraft-0.0.0.tgz
node node_modules/hunchcraft/dist/composition/cli.js --help
```

This installs the local Hunchcraft artifact and its locked-version runtime dependency,
`@typesafe-ai/sdk@0.6.0`. Dependency installation may use npm registry access. It does
not consult TypeSafe. npm maps the `hunchcraft` executable to
`dist/composition/cli.js`. The explicit Node path above also avoids shell-specific
bin wrappers. The packaged output worker requires no separate installation.

Keep the checkout's [example](../examples/brief.json) available as input. Examples below
use the installed CLI from `hunchcraft-local`. For a built checkout instead, replace
`node_modules/hunchcraft/dist/composition/cli.js` with `dist/composition/cli.js`, and
`../hunchcraft/examples/brief.json` with `examples/brief.json`.

## Validate without credentials

In zsh or bash, `<` connects a file to stdin and supplies EOF when the file ends:

```sh
node node_modules/hunchcraft/dist/composition/cli.js validate < ../hunchcraft/examples/brief.json
```

PowerShell does not support stdin redirection with `<`. For **PowerShell on Windows**,
use direct process input redirection rather than a text pipeline that can change encoding:

```powershell
$cli = (Resolve-Path ./node_modules/hunchcraft/dist/composition/cli.js).Path
$p = Start-Process -FilePath (Get-Command node).Source -ArgumentList "`"$cli`"", "validate" -RedirectStandardInput ../hunchcraft/examples/brief.json -RedirectStandardOutput ./validation.json -NoNewWindow -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "Hunchcraft failed with exit $($p.ExitCode). Discard its output." }
Get-Content -Raw -Encoding UTF8 ./validation.json | ConvertFrom-Json
```

The Windows procedure explicitly creates `validation.json`. That is caller-managed
output, not Hunchcraft persistence. `-Encoding UTF8` also reads BOM-less output correctly
in Windows PowerShell 5.1. Do not assume Unix PowerShell process redirection preserves
input bytes. This example is guidance, not a claim of a verified PowerShell run.

Both procedures should produce exit `0` and this JSON value:

```json
{
  "schemaVersion": "hunchcraft.result.v1",
  "kind": "validation",
  "status": "valid",
  "checkSetId": "component-outline.v0",
  "checkCount": 6
}
```

Validation proves that the brief parses and its checks compile. It does not evaluate
the proposal, authenticate source evidence or certify correctness. `--help` and
`validate` do not read credential values, initialize the provider or call it.

## Prepare a brief

Copy the public example and edit it locally. It matches the
[minimal six-check fixture](https://github.com/Smyan1909/hunchcraft/blob/main/tests/fixtures/briefs/minimal6.json), including the
stateless `hunchcraft.brief.v1` envelope. All evidence in that example is synthetic.
`src/Table.ts` is an illustrative locator, not a file Hunchcraft reads.

The original request asks for all filtered rows and a usable interface. The proposal
instead serializes visible rows synchronously. This is deliberately questionable
planning input, even though its JSON is valid. No live answer is supplied or promised.

- Preserve the original request and any human clarifications.
- Supply 1–3 components and at least one selected evidence excerpt.
- Keep every required array, even when empty. Unknown fields and old v0 envelopes fail.
- Use unique IDs and valid references. Quotes must match their referenced source text.
- Mark actual caller-selected repository excerpts as `caller-repo-read`. Use
  `synthetic-example` only for synthetic material. The CLI does not authenticate either.
- State unresolved premises in `assumptions`. Do not turn a proposal into source proof.
- Review all supplied material for secrets and disclosure permission before consultation.
  Locator restrictions are not a complete secret detector.

The retained inner grammar is a component outline, not an arbitrary prompt. See
[brief types and validation](../src/core/brief.ts) for exact entity/text bounds and
[the system contract](https://github.com/Smyan1909/hunchcraft/blob/main/docs/system-design.md#4-input-and-check-reuse) for its envelope.

| Bound              | Limit                     |
| ------------------ | ------------------------- |
| Input              | 48 KiB, strict UTF-8 JSON |
| Compiled state     | 32 KiB                    |
| Compiled questions | 16 KiB                    |
| Compiled checks    | 6–16                      |
| Output             | 256 KiB                   |
| Provider response  | 256 KiB                   |

Duplicate keys, unknown fields, invalid scalars and invalid numeric values fail.
Overflow fails rather than trimming checks. Empty `requirements` and `localQuestions`
do not remove the two whole-proposal checks. The example also compiles four component
checks: contradiction, missing evidence, plausibility and justification.

## Consult only within an authorized workflow

**This section is for humans and human-authorized workflows. Project development
agents must not run live consultation. No live/evaluation budget is authorized.**

Have a human provision `TYPESAFE_API_KEY` through their existing environment-management
process. The CLI reads it lazily for `consult` only. Do not put a key in command arguments,
briefs, chat, skills or logs. Do not print it to check setup.

The key is the only service-specific setup. A consultation still needs installation,
supported Node, valid input, network access and a usable provider account.

Explicitly invoking `consult` authorizes transmission of the supplied material to
TypeSafe under this disclosure. An agent needs a human-authorized workflow. Key
presence alone never authorizes scanning, automatic inference or arbitrary disclosure.
The CLI cannot authenticate human intent or isolate hostile same-user processes.

Only compiled questions and the supplied inner brief state are transmitted, including
the original request and selected excerpts. Ordinary SDK protocol/runtime metadata and
provider processing/retention still apply. No Hunchcraft-managed storage does not imply
provider zero retention. Shell/host logs and caller-redirected files remain external.

After human authorization, with the key already available in the environment, zsh/bash
users can run:

```sh
node node_modules/hunchcraft/dist/composition/cli.js consult < ../hunchcraft/examples/brief.json
```

In the PowerShell-on-Windows procedure above, replace the argument `"validate"` with `"consult"`
and use a separately chosen output filename. Keep the nonzero-exit rejection.

The provider policy is fixed:

- SDK `@typesafe-ai/sdk@0.6.0`, model `jev-1.13.0`, base URL `https://api.typesafe.ai`.
- Conflicting `TYPESAFE_BASE_URL` or `TYPESAFE_DEFAULT_MODEL` fails with exit `3`.
  Overrides cannot redirect the key to another endpoint or model.
- `TYPESAFE_LOG_LEVEL` is ignored. Provider logging is off and failures are sanitized.
- At most one underlying dispatch, zero retries and redirects refused.

Current TypeSafe documentation can describe a newer SDK. That does not upgrade this
package or change its pinned policy. See the [provider audit](../src/providers/typesafe/README.md).

## Read judgments, not approvals

A completed consultation has `schemaVersion: "hunchcraft.result.v1"`,
`kind: "judgment"`, `status: "completed"` and `policyVersion: "hunchcraft.policy.v1"`.
Its `checks` preserve all compiled questions and validated raw answers in compiler order.
See [result types](../src/core/result.ts) for the complete closed result contract.

- **Noul:** `answer.noul` is the probability of yes, from 0 to 1. A value near 0.5
  means yes and no have similar probability, not medium severity. For gap and
  contradiction questions, a high value means a concern was identified.
- **Score:** `answer.score` is the probability-weighted position on levels 0–2.
  Read `probabilities`, `legend` and `confidence` too. Concentrated probability is not
  a correctness guarantee.
- Static `feedback` is Hunchcraft guidance, not a generated explanation from Jev.
- Unknown usage or cost is unknown, not zero. `costEstimate` is null, not free service.

Every judgment is advisory. Adverse answers still exit `0`, because the consultation
completed. Positive answers do not certify correctness, authorize actions or justify
removing necessary tests. Discard advice after relevant request, proposal, evidence or
assumption changes. Run normal tests and verification before accepting work.

For the primitive meanings, see TypeSafe's [Noul](https://docs.typesafe.ai/primitives/noul.md)
and [Score](https://docs.typesafe.ai/primitives/score.md) documentation. There are no
measured Hunchcraft quality, cost or latency gains yet.

## Handle exits and incomplete output

The CLI accepts exactly one argument: `--help`, `validate` or `consult`. There are no
file flags, key arguments, session commands, public `verify` command or extra options.
Help is text. Validation, judgments and ordinary failures use JSON stdout.

| Exit  | Meaning                                   |
| ----- | ----------------------------------------- |
| `0`   | Valid brief or completed consultation     |
| `2`   | Invalid arguments/input or check overflow |
| `3`   | Missing key or conflicting configuration  |
| `4`   | Provider or provider-response failure     |
| `5`   | Deadline                                  |
| `130` | Local interruption                        |
| `1`   | Local I/O or internal failure             |

Wait for process close. Reject every nonzero exit, even if stdout appears to contain
a complete result. On exit `0`, parse the complete JSON and validate the expected v1
variant before consuming advice. Help is the text-only exception.

Ordinary failures can emit a fixed sanitized error envelope while the invocation is
still live. Deadline, interruption or invariant termination can leave stdout empty or
partial. A failed output attempt never appends a replacement envelope. Terminal stderr
diagnostics are intentionally empty, so do not wait for an error message there.

One 15-second deadline starts before stdin and spans acknowledged output and output-child
exit. The provider attempt gets at most 10 seconds, bounded by remaining time. Only the
provider owns its existing cleanup grace of at most 1 second. There is no fresh output
deadline, extra grace, queue, persistent session or background daemon. One foreground
invocation owns one short-lived output child without credentials or inherited preloads.
See [ADR 0005](https://github.com/Smyan1909/hunchcraft/blob/main/docs/decisions/0005-invocation-owned-output-process.md).

These are bounded local lifecycle policies, not hard real-time reclamation guarantees.
Failed child termination or abrupt parent death can prevent complete cleanup. Local
timeout/abort does not guarantee remote cancellation or stopped billing. Independent
invocations have no shared cap or hard spend ceiling. Retrying after an ambiguous failure
can create another charged request. Review failure circumstances before trying again.
