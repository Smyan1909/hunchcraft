# Integrations

The [stateless CLI](cli/README.md) implements strict arguments, bounded input and
injected output lifecycle. Composition confines blocking descriptor output to one
invocation-owned, killable Node child; no provider runs there. There is no native host adapter. A shipped skill
or host adapter is optional later work. See the [accepted design](../../docs/system-design.md).

Place each coding-agent adapter in its own folder, for example `opencode/`,
`codex/`, or `claude-code/` after its supported extension surface is confirmed.
Translate host events into observations and deliver results through supported
host mechanisms. Keep hooks thin and move reusable behavior into application.

An integration may depend on core, ports, application, its own modules, and its
host SDK. Inject a decision provider rather than importing a concrete provider.
Do not import sibling integrations. Agent skills are instructions; executing a
background loop requires an actual host hook, process, or utility.
