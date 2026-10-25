#!/usr/bin/env node
import { runCli } from '../integrations/cli/run.js';
import { createNodeCli, createNodeClock, nodeInput } from './node.js';

const controller = new AbortController();
const interrupt = (): void => controller.abort();
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);
let code: number;
try {
  const dependencies = createNodeCli({
    clock: createNodeClock(),
    input: nodeInput(process.stdin),
    signal: controller.signal,
    environment: () => process.env,
    fetch: (input, init) => fetch(input, init),
    dispose: () => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
    },
  });
  code = await runCli(process.argv.slice(2), dependencies);
} catch {
  code = 1;
} finally {
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
}
// Terminal diagnostics are deliberately omitted: parent stdio can block too.
process.exit(code);
