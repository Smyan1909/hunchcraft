# Hunchcraft

Fast hunches. Deliberate agents.

Hunchcraft is a stateless foreground CLI for a second look at a coding proposal.
Supply the original request, a small component outline and selected evidence.
Hunchcraft validates the brief, asks TypeSafe's **Jev** bounded questions, returns
typed advisory judgments and exits. Your agent still implements and verifies the work.

For example: a plan to export visible table rows may miss a request to export **all**
filtered rows. The [public example](examples/brief.json) captures that mismatch with
synthetic evidence. It is valid input, not a claim about Jev's measured accuracy.

## Try validation first

**Unreleased, version `0.0.0`.** Use a checkout or install its local npm tarball.
These instructions do not assume an npm registry release.

Use Node.js 22.13+ on the 22.x line or Node 24.x, and npm. The package runtime floor
is 22.12.0. From a checkout, run:

```sh
npm ci
npm run build
node dist/composition/cli.js --help
```

In zsh or bash, validate the example without credentials or provider calls:

```sh
node dist/composition/cli.js validate < examples/brief.json
```

Expected result, with exit `0`:

```json
{
  "schemaVersion": "hunchcraft.result.v1",
  "kind": "validation",
  "status": "valid",
  "checkSetId": "component-outline.v0",
  "checkCount": 6
}
```

See [usage](docs/usage.md) for local-tarball installation, PowerShell input redirection,
human-authorized consultation, input limits and exit handling.

## Consult deliberately

`TYPESAFE_API_KEY` in a human-managed environment is the only service-specific setup.
Consultation also needs valid input, supported Node, network access and a usable provider
account. Help and validation need neither credentials nor provider access.

Explicit `consult` invocation authorizes transmission of the supplied material to
TypeSafe. Agent use requires a human-authorized workflow. Key presence alone never
authorizes scanning, inference or arbitrary disclosure. Keep secrets out of briefs,
arguments, chat, skills and logs. No Hunchcraft persistence does **not** mean provider
zero retention.

Noul probabilities and Score distributions are raw advice, not correctness
certification or action permission. Discard advice when the request, proposal,
evidence or assumptions change. Run normal tests and verification regardless.
Quality, cost and latency benefits remain hypotheses, not measured outcomes.

## What exists

- Strict v1 brief/result contracts and mandatory check compilation.
- `--help`, offline `validate`, one-shot `consult` and an npm executable.
- Explicit Node composition with lazy credentials and a pinned TypeSafe provider.
- One 15-second invocation lifetime, zero retries and bounded input/output.
  One invocation-owned Node output child isolates blocked stdout. It is not a daemon.
  Terminal stderr diagnostics are deliberately omitted.

There is no repository scan, persistent session, cache, background service or advice
execution. No functional package-root API, shipped consultation skill or host adapter
exists. Existing coding agents need no custom harness or main-model replacement.

S1/S2/S3 are implemented and independently reviewed offline. Full macOS checks passed
on Node 22.23.4 and 24.22.1: **431 tests**, plus actual packed-install/bin checks.
Corrected six-cell remote CI remains pending. The earlier S2 Linux blocked-output
test setup was repaired with verified FIFO saturation and emergency fixture cleanup;
its failed run is not Linux acceptance. S2 Windows Node 22/24 CI passed.
Target platforms are macOS, Linux and Windows. Configured CI is not proof of a passed run. See
[shared context](https://github.com/Smyan1909/hunchcraft/blob/main/docs/agent-context.md) for milestone-specific evidence and current gaps.
Offline checks do not establish live inference, usefulness or savings.

## Contribute

```sh
npm ci
npm run check
```

Read [CONTRIBUTING.md](https://github.com/Smyan1909/hunchcraft/blob/main/CONTRIBUTING.md), the [test map](https://github.com/Smyan1909/hunchcraft/blob/main/tests/README.md) and
[architecture](https://github.com/Smyan1909/hunchcraft/blob/main/docs/architecture.md). Dependencies point inward through application,
SDK-free ports and pure core. Only composition wires providers to integrations.
`@typesafe-ai/sdk@0.6.0` is the sole runtime dependency. TypeScript is pinned to 6.0.3.

For coding-agent contributors, start with [AGENTS.md](https://github.com/Smyan1909/hunchcraft/blob/main/AGENTS.md) and
[shared context](https://github.com/Smyan1909/hunchcraft/blob/main/docs/agent-context.md). The [OpenCode team](https://github.com/Smyan1909/hunchcraft/blob/main/docs/opencode-agents.md)
and `.agents/skills/` support repository development, not Hunchcraft runtime agents.
Development agents have no live/evaluation budget. Publication requires separate approval.

## Design and evidence

- [System design](https://github.com/Smyan1909/hunchcraft/blob/main/docs/system-design.md) and [implementation plan](https://github.com/Smyan1909/hunchcraft/blob/main/docs/implementation-plan.md).
- [Stateless decision](https://github.com/Smyan1909/hunchcraft/blob/main/docs/decisions/0004-stateless-portable-consultation.md) and
  [output isolation](https://github.com/Smyan1909/hunchcraft/blob/main/docs/decisions/0005-invocation-owned-output-process.md).
- [Evaluation plan](https://github.com/Smyan1909/hunchcraft/blob/main/docs/evaluation-plan.md): optional, separately authorized measurement.
- [Legacy design](https://github.com/Smyan1909/hunchcraft/blob/main/docs/system-design-legacy.md): historical session contracts, not current setup.

## License

[MIT](LICENSE). The upstream TypeSafe skill retains its own license and content.
