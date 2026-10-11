# Core

Pure domain values and deterministic decision policies. Depend only on other core
modules. Keep provider responses, host SDK types, I/O, environment access, and
global mutable state outside this layer. Pass time and observed state explicitly.

Add contracts when a concrete use case requires them; this directory currently
documents the boundary rather than declaring speculative interfaces.
