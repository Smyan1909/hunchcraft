# Composition

Explicit factories and executable entry points that wire application use cases,
concrete providers, and host integrations. This is the only layer permitted to
import all other layers. Read and validate environment or CLI configuration here.

Add a package subpath export for a concrete integration when it exists. Keep the
root package entry host-independent. Importing a library must not start workers,
make requests, or read credentials; initialize and dispose through explicit calls.
