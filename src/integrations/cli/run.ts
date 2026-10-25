import { consult } from '../../application/consult.js';
import type { Operation } from '../../application/operation.js';
import { parseBrief } from '../../core/brief.js';
import { compileChecks } from '../../core/checks.js';
import {
  classifiedFailure,
  completedJudgmentEnvelope,
  failure,
  failureEnvelope,
  validationEnvelope,
} from '../../core/result.js';
import type { Failure, ResultEnvelope, Validation } from '../../core/result.js';
import type { DecisionProvider } from '../../ports/decision-provider.js';
import { HELP, parseArguments } from './arguments.js';
import { readInput } from './input.js';
import type { InputSource } from './input.js';
import { encodeEnvelope, writeOutput } from './output.js';
import type { OutputSink } from './output.js';

export interface CliDependencies {
  readonly operation: Operation;
  readonly input: InputSource;
  readonly output: OutputSink;
  readonly provider: DecisionProvider;
  dispose(): void;
}
function requireValue<T>(value: Validation<T>): T {
  if (!value.ok) throw new ErrorFailure(value.error);
  return value.value;
}
class ErrorFailure extends Error {
  constructor(readonly causeFailure: Failure) {
    super(causeFailure.message);
  }
}
export async function runCli(
  args: readonly string[],
  dependencies: CliDependencies,
): Promise<number> {
  const { operation } = dependencies;
  let exit = 0;
  try {
    let bytes: Uint8Array;
    try {
      const command = requireValue(parseArguments(args));
      if (command === 'help') bytes = new TextEncoder().encode(HELP);
      else {
        const input = requireValue(await readInput(dependencies.input, operation));
        const parsed = parseBrief(input);
        if (!parsed.ok)
          throw new ErrorFailure(
            failure(
              parsed.error.code,
              parsed.error.code === 'check_budget_exceeded' ? 'compile' : 'input',
            ),
          );
        const compiled = compileChecks(parsed.value);
        if (!compiled.ok) throw new ErrorFailure(failure(compiled.error.code, 'compile'));
        const plan = compiled.value;
        requireValue(operation.checkpoint('compile'));
        let envelope: ResultEnvelope;
        if (command === 'validate') envelope = requireValue(validationEnvelope(plan.checks.length));
        else {
          const result = await consult(
            { bytes: input, operation },
            { provider: dependencies.provider },
          );
          if (result.status === 'ready')
            envelope = requireValue(completedJudgmentEnvelope(result.result));
          else {
            envelope = result.outcome;
            exit = result.failure.exitCode;
            if (result.failure.code === 'internal_failure') operation.fail(result.failure);
          }
        }
        bytes = encodeEnvelope(envelope);
      }
    } catch (error) {
      const cause =
        error instanceof ErrorFailure
          ? error.causeFailure
          : (classifiedFailure(error) ?? failure('internal_failure', 'internal'));
      exit = cause.exitCode;
      if (cause.code === 'internal_failure') operation.fail(cause);
      bytes = encodeEnvelope(requireValue(failureEnvelope(cause)));
    }
    requireValue(operation.checkpoint('output'));
    const written = await writeOutput(dependencies.output, bytes, operation);
    if (!written.ok) {
      exit = written.error.exitCode;
    }
  } catch (error) {
    const current = operation.checkpoint('output');
    exit = !current.ok
      ? current.error.exitCode
      : error instanceof ErrorFailure
        ? error.causeFailure.exitCode
        : 1;
  } finally {
    const current = operation.checkpoint('output');
    if (!current.ok) {
      exit = current.error.exitCode;
    }
    try {
      dependencies.dispose();
    } catch {
      if (exit !== 5 && exit !== 130) exit = 1;
    }
    try {
      operation.dispose();
    } catch {
      if (exit !== 5 && exit !== 130) exit = 1;
    }
  }
  return exit;
}
