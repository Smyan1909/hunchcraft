import { readFileSync } from 'node:fs';
import { parseBrief } from '../../src/core/brief.js';
import type { Brief } from '../../src/core/brief.js';
import type { CompiledPlan } from '../../src/core/checks.js';
import type { EvaluationOutcome } from '../../src/core/result.js';
import { validateProviderResponse } from '../../src/core/result.js';
import type { Clock } from '../../src/ports/clock.js';
import type { DecisionProvider, EvaluationControl } from '../../src/ports/decision-provider.js';
import type { ConsultDependencies, ConsultInput } from '../../src/application/consult.js';
import { createOperation } from '../../src/application/operation.js';

export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: T) => void = () => {
    throw new Error('not initialized');
  };
  let reject: (reason?: unknown) => void = () => {
    throw new Error('not initialized');
  };
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export async function flush(): Promise<void> {
  for (let i = 0; i < 100; i++) await Promise.resolve();
}
export class FakeClock implements Clock {
  monotonic = 0;
  wall = Date.parse('2026-10-11T12:00:00.000Z');
  readonly timers = new Map<number, { at: number; callback: () => void }>();
  private next = 0;
  monotonicMs(): number {
    return this.monotonic;
  }
  wallTimeMs(): number {
    return this.wall;
  }
  schedule(delay: number, callback: () => void): () => void {
    const key = ++this.next;
    this.timers.set(key, { at: this.monotonic + delay, callback });
    return () => {
      this.timers.delete(key);
    };
  }
  advance(ms: number, notify = true): void {
    this.monotonic += ms;
    this.wall += ms;
    if (notify)
      for (const [key, timer] of [...this.timers])
        if (timer.at <= this.monotonic) {
          this.timers.delete(key);
          timer.callback();
        }
  }
}
export function fixture(name: 'minimal6' | 'csv13' = 'minimal6'): {
  brief: Brief;
  inputBytes: number;
  bytes: Uint8Array;
} {
  const bytes = readFileSync(new URL(`../fixtures/briefs/${name}.json`, import.meta.url));
  const parsed = parseBrief(bytes);
  if (!parsed.ok) throw new Error('fixture invalid');
  return { brief: parsed.value, inputBytes: parsed.inputBytes, bytes };
}
export function response(plan: CompiledPlan): unknown {
  return {
    model: 'jev-1.13.0',
    answers: Object.fromEntries(
      plan.checks.map((c, i) => [
        c.wireId,
        c.question.type === 'noul'
          ? { type: 'noul', noul: 0.1 * (i % 5) }
          : {
              type: 'score',
              score: 1.5,
              legend: {
                '0': c.question.criteria[0],
                '1': c.question.criteria[1],
                '2': c.question.criteria[2],
              },
              probabilities: { '0': 0.1, '1': 0.3, '2': 0.6 },
              confidence: 0.4,
            },
      ]),
    ),
    usage: { input_tokens: 120, output_tokens: 24 },
  };
}
export function evaluation(plan: CompiledPlan): EvaluationOutcome {
  const result = validateProviderResponse(response(plan), plan, {
    origin: 'test-fixture',
    attempts: 0,
    requestId: null,
    httpStatus: null,
  });
  if (!result.ok) throw new Error('response invalid');
  return { ok: true, value: result.value };
}
export class FakeProvider implements DecisionProvider {
  readonly origin = 'test-fixture';
  calls = 0;
  dispatches = 0;
  controls: EvaluationControl[] = [];
  handler:
    ((plan: CompiledPlan, control: EvaluationControl) => Promise<EvaluationOutcome>) | undefined;
  async evaluate(
    plan: CompiledPlan,
    _state: Brief['brief'],
    control: EvaluationControl,
  ): Promise<EvaluationOutcome> {
    this.calls++;
    this.controls.push(control);
    if (this.handler) return this.handler(plan, control);
    await control.beforeDispatch();
    this.dispatches++;
    return evaluation(plan);
  }
}
export function setup(name: 'minimal6' | 'csv13' = 'minimal6'): {
  clock: FakeClock;
  provider: FakeProvider;
  input: ConsultInput;
  dependencies: ConsultDependencies;
  controller: AbortController;
} {
  const clock = new FakeClock();
  const provider = new FakeProvider();
  const controller = new AbortController();
  const operation = createOperation(
    clock,
    { monotonicMs: clock.monotonic, wallTimeMs: clock.wall },
    controller.signal,
  );
  return {
    clock,
    provider,
    controller,
    input: { bytes: fixture(name).bytes, operation },
    dependencies: { provider },
  };
}
