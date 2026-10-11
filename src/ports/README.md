# Ports

Small interfaces required by an implemented application use case: decision
providers, observation sources, clocks, and result sinks as needed. Depend on
core and other ports only. Define Hunchcraft-owned contracts, not SDK aliases.

Use constructor or function arguments for injection; no service locator or
dependency injection framework is needed.
