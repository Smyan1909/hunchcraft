# Composition

Explicit factories and executable entry points that wire application use cases,
concrete providers, and host integrations. This is the only layer permitted to
import all other layers. Read and validate environment or CLI configuration here.

The next planned executable wires stateless consultation to Node clock/fetch and a
lazy `TYPESAFE_API_KEY` reader. Help/validation need no credentials or network.
No persistent session/storage provider or OS-specific helper is required. This
composition does not exist yet; see [the plan](../../docs/implementation-plan.md).

Add a package subpath export for a concrete integration when it exists. Keep the
root package entry host-independent. Importing a library must not start workers,
make requests, or read credentials; initialize and dispose through explicit calls.
