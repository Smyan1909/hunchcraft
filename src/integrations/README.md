# Integrations

The next integration is the [planned stateless CLI](../../docs/system-design.md),
not a native host adapter. It owns arguments, bounded stdin/stdout and exit behavior.
No CLI is implemented yet. A shipped skill or host adapter is optional later work.

Place each coding-agent adapter in its own folder, for example `opencode/`,
`codex/`, or `claude-code/` after its supported extension surface is confirmed.
Translate host events into observations and deliver results through supported
host mechanisms. Keep hooks thin and move reusable behavior into application.

An integration may depend on core, ports, application, its own modules, and its
host SDK. Inject a decision provider rather than importing a concrete provider.
Do not import sibling integrations. Agent skills are instructions; executing a
background loop requires an actual host hook, process, or utility.
