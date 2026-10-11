# 0002: Extend existing coding agents through supported surfaces

Status: accepted

Date: 2026-10-11

## Context

Hunchcraft explores adding System One judgments to coding-agent workflows. The
user wants to enhance existing agents, not build a replacement agent runtime.
The repository is still a TypeScript foundation with no functional host adapter
or decision provider. See [the discussion notes](../design-discussion.md) for the
broader direction and unresolved workflow ideas.

## Decision

Extend existing coding agents through a supported plugin or a skill plus CLI.
Do not require reworking fundamental host code, a custom harness, a host fork, or
replacement of the host's main model.

This accepts only the existing-host extension boundary. It does not choose a host,
plugin implementation, CLI design, distribution surface, or decision protocol.
No specific host extension capability has been verified by this decision.

## Consequences

- Observation and delivery must fit a host's actual supported contracts. Check
  current host documentation and relevant types before relying on them.
- A skill provides guidance, not execution. Background work needs a real runtime
  mechanism with explicit lifecycle handling.
- Hunchcraft cannot assume access to private reasoning, interception of internal
  deliberation, or injection into an in-flight generation. Early consultation can
  be encouraged through instructions/tools, not guaranteed by this boundary.
- Some workflow ideas may be infeasible within unchanged hosts. Return those
  limits for discussion rather than silently introducing a custom harness or fork.

## Reconsider when

- Supported surfaces cannot expose the evidence or delivery opportunity needed
  for a useful workflow.
- A concrete host/runtime constraint makes the boundary incompatible with an
  explicitly agreed project goal.
- The user explicitly requests a different scope.

These triggers reopen discussion; changing this accepted boundary requires explicit
user agreement and an updated decision record, not an implementation workaround.
