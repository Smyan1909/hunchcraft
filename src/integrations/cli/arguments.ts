import { invalid, valid } from '../../core/result.js';
import type { Validation } from '../../core/result.js';

export type Command = 'help' | 'validate' | 'consult';
export function parseArguments(args: readonly string[]): Validation<Command> {
  if (args.length !== 1) return invalid('invalid_input', 'arguments');
  switch (args[0]) {
    case '--help':
      return valid('help');
    case 'validate':
      return valid('validate');
    case 'consult':
      return valid('consult');
    default:
      return invalid('invalid_input', 'arguments');
  }
}
export const HELP = `Usage: hunchcraft --help | validate | consult
validate and consult read one strict UTF-8 v1 JSON document from stdin until EOF.
No files, keys or extra options are accepted in arguments.
consult discloses only supplied request, proposal and selected evidence to TypeSafe.
Agent use requires a human-authorized workflow. Key presence does not authorize scanning.
Set TYPESAFE_API_KEY in the environment for consult only; help/validate are offline.
Endpoint/model are pinned; conflicting TYPESAFE_BASE_URL/TYPESAFE_DEFAULT_MODEL fail.
TYPESAFE_LOG_LEVEL is ignored; provider logging is off.
Limits: 48 KiB input, 32 KiB state, 6-16 mandatory checks, 256 KiB output.
One 15-second deadline spans stdin through acknowledged output. No retries or sessions.
Output uses one invocation-local Node child. Terminal stderr diagnostics are omitted.
Raw Noul/Score judgments are advisory, not approval. Verify normally and discard advice
after relevant request, proposal, evidence or assumptions change. Unknown cost is not zero.
Exit: 0 valid/completed, 2 invalid, 3 configuration, 4 provider, 5 deadline,
130 local interruption, 1 local I/O/internal failure. No provider retention guarantee.
`;
