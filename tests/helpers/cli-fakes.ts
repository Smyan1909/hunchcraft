import { createOperation } from '../../src/application/operation.js';
import type { InputObserver, InputSource } from '../../src/integrations/cli/input.js';
import type { CliDependencies } from '../../src/integrations/cli/run.js';
import { FakeClock, FakeProvider } from './consultation-fakes.js';

export class FakeInput implements InputSource {
  observer: InputObserver | undefined;
  subscriptions = 0;
  disposals = 0;
  subscribe(observer: InputObserver): () => void {
    this.observer = observer;
    this.subscriptions++;
    return () => {
      this.disposals++;
    };
  }
}
export function cliSetup(): {
  clock: FakeClock;
  controller: AbortController;
  input: FakeInput;
  dependencies: CliDependencies;
  writes: Uint8Array[];
  observed: { disposals: number };
} {
  const clock = new FakeClock();
  const controller = new AbortController();
  const input = new FakeInput();
  const writes: Uint8Array[] = [];
  const observed = { disposals: 0 };
  const dependencies: CliDependencies = {
    operation: createOperation(
      clock,
      { monotonicMs: clock.monotonic, wallTimeMs: clock.wall },
      controller.signal,
    ),
    input,
    provider: new FakeProvider(),
    output: {
      deliver(text): Promise<void> {
        writes.push(new TextEncoder().encode(text));
        return Promise.resolve();
      },
    },
    dispose: () => {
      observed.disposals++;
    },
  };
  return { clock, controller, input, writes, observed, dependencies };
}
