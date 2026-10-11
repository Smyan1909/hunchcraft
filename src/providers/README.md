# Providers

Place each decision backend in its own folder, initially `typesafe/` when the Jev
integration is implemented. Translate provider-specific questions, responses,
errors, and request controls into Hunchcraft contracts.

Providers may import core, ports, their own modules, and their SDK dependencies.
They may not import application code, integrations, or other providers. Read the
TypeSafe skill and live SDK documentation before implementing `typesafe/`.
