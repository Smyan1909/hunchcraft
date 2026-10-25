// Private blocked-pipe setup, never a production transport or CLI switch.
import { spawn } from 'node:child_process';
const mode = process.argv.splice(2, 1)[0];
if (mode === 'blocked-output' || mode === 'blocked-stderr' || mode === 'interrupt-output') {
  // Fill the shared descriptor in a different process: do not put an artificial
  // uninterruptible fs worker in the CLI process under test.
  const filler = spawn(
    process.execPath,
    [
      '-e',
      'require("node:fs").write(1, Buffer.alloc(2097152), () => {}); process.stderr.write("ready\\n");',
    ],
    {
      stdio: ['ignore', mode === 'blocked-stderr' ? 2 : 1, 'pipe'],
      env: process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot } : {},
    },
  );
  filler.stderr.once('data', () => {
    if (mode === 'blocked-stderr') process.stdout.write(`ready ${filler.pid}\n`);
    else process.stderr.write(`ready ${filler.pid}\n`);
  });
  process.on('exit', () => filler.kill('SIGKILL'));
  await new Promise((resolve) => filler.stderr.once('data', resolve));
  if (mode === 'interrupt-output') {
    const { createRequire, syncBuiltinESMExports } = await import('node:module');
    const childProcess = createRequire(import.meta.url)('node:child_process');
    const originalFork = childProcess.fork;
    childProcess.fork = function (...args) {
      const child = originalFork(...args);
      const originalSend = child.send;
      child.send = function (...sendArgs) {
        const result = originalSend.apply(this, sendArgs);
        process.stderr.write('output-started\n');
        return result;
      };
      return child;
    };
    syncBuiltinESMExports();
  }
} else if (mode === 'signal') {
  process.stdin.on('newListener', (event) => {
    if (event === 'data') queueMicrotask(() => process.stderr.write('ready\n'));
  });
} else throw new Error('Unknown private harness mode');
await import('../../dist/composition/cli.js');
