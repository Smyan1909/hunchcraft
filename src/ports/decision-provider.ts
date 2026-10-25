import type { BriefState } from '../core/brief.js';
import type { CompiledPlan } from '../core/checks.js';
import type { EvaluationMetadata, EvaluationOutcome } from '../core/result.js';
export interface EvaluationControl {
  readonly signal: AbortSignal;
  remainingMs(): number;
  /** Claim this invocation's single dispatch immediately before transport starts. */
  beforeDispatch(): Promise<void>;
  onProgress(value: unknown): void;
}
export interface DecisionProvider {
  readonly origin: EvaluationMetadata['origin'];
  evaluate(
    plan: CompiledPlan,
    state: BriefState,
    control: EvaluationControl,
  ): Promise<EvaluationOutcome>;
}
