# Providers

Place each backend in its own folder. The internal [TypeSafe M2 adapter](typesafe/README.md)
implements lazy explicit configuration, pinned SDK translation, guarded one-shot
capped transport, sanitized failures and complete runtime answer validation. Offline
tests exercise the real SDK only through injected fake HTTP; no live verification,
CLI, production credential wiring or private local-state adapter exists here.

Providers may import core, ports, their own modules, and their SDK dependencies.
They may not import application code, integrations, or other providers. Read the
TypeSafe skill and live SDK documentation before implementing `typesafe/`.
