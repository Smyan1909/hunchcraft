// Private real-descriptor fixtures; no production switches or runtime helpers.
import { spawn, execFileSync } from 'node:child_process';
import { constants, openSync, closeSync, writeSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire, syncBuiltinESMExports } from 'node:module';

const self = fileURLToPath(import.meta.url);
const bin = fileURLToPath(new URL('../../dist/composition/cli.js', import.meta.url));
const descriptorWrite = writeSync;

function fill(fd) {
  let block = Buffer.alloc(4096);
  let total = 0;
  for (;;) {
    try {
      const count = descriptorWrite(fd, block);
      if (!Number.isSafeInteger(count) || count <= 0 || count > block.length)
        throw new Error('Invalid saturation write');
      total += count;
      if (total > 16 * 1024 * 1024) throw new Error('Saturation bound exceeded');
    } catch (error) {
      if (error?.code !== 'EAGAIN' && error?.code !== 'EWOULDBLOCK') throw error;
      if (block.length > 1) {
        block = Buffer.alloc(1);
        continue;
      }
      return total;
    }
  }
}
function blocking(stream, value) {
  // No public Node fcntl wrapper exists. Check this narrowly authorized,
  // test-only libuv capability; missing support fails rather than skips.
  if (typeof stream._handle?.setBlocking !== 'function')
    throw new Error('No test descriptor blocking capability');
  stream._handle.setBlocking(value);
}

if (process.argv[1]?.endsWith('output-worker.js')) {
  const fs = createRequire(import.meta.url)('node:fs');
  const original = fs.writeSync;
  fs.writeSync = function (...args) {
    if (args[0] === 1) {
      blocking(process.stdout, false);
      try {
        // Prove the worker's actual inherited FIFO has no single-byte room.
        try {
          descriptorWrite(1, Buffer.alloc(1));
          throw new Error('Worker descriptor not full');
        } catch (error) {
          if (error?.code !== 'EAGAIN' && error?.code !== 'EWOULDBLOCK') throw error;
        }
      } finally {
        blocking(process.stdout, true);
      }
      descriptorWrite(4, 'worker-eagain\n');
      fs.writeSync = original;
      syncBuiltinESMExports();
    }
    return original(...args);
  };
  syncBuiltinESMExports();
} else if (process.argv[1] === bin) {
  // Test-only preload explicitly injected by this fixture, not inherited by
  // production. Independent fd 4 avoids perturbing the closed output IPC.
  const childProcess = createRequire(import.meta.url)('node:child_process');
  const originalFork = childProcess.fork;
  childProcess.fork = function (module, args, options) {
    const child = originalFork(module, args, {
      ...options,
      execArgv: ['--import', import.meta.url],
      stdio: ['ignore', 1, 'ignore', 'ipc', 'pipe'],
    });
    let evidence = '';
    child.stdio[4].on('data', (bytes) => {
      evidence += bytes.toString();
      if (evidence === 'worker-eagain\n') process.stderr.write('output-started worker-eagain\n');
    });
    child.stdio[4].on('error', () => {});
    return child;
  };
  syncBuiltinESMExports();
} else {
  const mode = process.argv.splice(2, 1)[0];
  if (mode === 'hung-worker') {
    // Deliberately never exits or disposes its inherited descriptors.
    process.stderr.write(`owned-pid ${process.pid}\nhung-ready\n`);
    setInterval(() => {}, 1000);
  } else if (mode === 'hung-cli' || mode === 'hung-fixture') {
    const directory = process.env.HUNCHCRAFT_TEST_DIRECTORY;
    if (!directory) throw new Error('Missing externally owned fixture directory');
    let fd;
    if (mode === 'hung-fixture') {
      const path = join(directory, 'output');
      if (process.platform === 'win32') writeFileSync(path, 'held open');
      else execFileSync('/usr/bin/mkfifo', [path], { timeout: 3000, stdio: 'ignore' });
      fd = openSync(
        path,
        constants.O_RDWR | (process.platform === 'win32' ? 0 : constants.O_NONBLOCK),
      );
    }
    if (mode === 'hung-cli') process.stderr.write(`owned-pid ${process.pid}\n`);
    const descendant = spawn(
      process.execPath,
      [self, mode === 'hung-fixture' ? 'hung-cli' : 'hung-worker'],
      { env: process.env, stdio: [fd ?? 0, 'ignore', 'pipe'] },
    );
    descendant.stderr.pipe(process.stderr);
    descendant.on('error', () => process.exit(1));
    // Intentionally omit exit/finally cleanup: only the outside watchdog can
    // reclaim this wrapper and both descendants (including the held FIFO).
    setInterval(() => {}, 1000);
  } else if (mode === 'saturate') {
    blocking(process.stdout, false);
    let count;
    try {
      count = fill(1);
    } finally {
      blocking(process.stdout, true);
    }
    process.send?.({ type: 'saturated', count }, () => process.exit(0));
  } else if (mode === 'signal') {
    process.stdin.on('newListener', (event) => {
      if (event === 'data') queueMicrotask(() => process.stderr.write('ready\n'));
    });
    await import('../../dist/composition/cli.js');
  } else if (['blocked-output', 'blocked-stderr', 'interrupt-output'].includes(mode)) {
    if (process.platform === 'win32') {
      // Retained Windows pending-write fixture; Unix EAGAIN claims do not apply.
      const filler = spawn(
        process.execPath,
        [
          '-e',
          'require("node:fs").write(1, Buffer.alloc(2097152), () => {}); process.stderr.write("ready\\n");',
        ],
        {
          stdio: ['ignore', mode === 'blocked-stderr' ? 2 : 1, 'pipe'],
          env: { SystemRoot: process.env.SystemRoot },
        },
      );
      process.on('exit', () => filler.kill('SIGKILL'));
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          filler.kill('SIGKILL');
          reject(new Error('Windows setup watchdog exceeded'));
        }, 3000);
        filler.on('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        filler.stderr.once('data', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      const text = `ready ${filler.pid} windows-pending-write\n`;
      if (mode === 'blocked-stderr') process.stdout.write(text);
      else process.stderr.write(text);
      await import('../../dist/composition/cli.js');
    } else {
      // Node spawn's Unix 'pipe' can be a socketpair. EAGAIN there can be
      // transient while the kernel transfers queued bytes. An actual FIFO with
      // an open, unread reader gives stable pipe saturation across fork/exec.
      const directory = process.env.HUNCHCRAFT_TEST_DIRECTORY;
      if (!directory) throw new Error('Missing externally owned FIFO directory');
      const path = join(directory, 'output');
      let fd;
      let filler;
      let cli;
      const cleanup = () => {
        if (filler && filler.exitCode === null && filler.signalCode === null)
          filler.kill('SIGKILL');
        if (cli && cli.exitCode === null && cli.signalCode === null) cli.kill('SIGKILL');
        if (fd !== undefined) {
          closeSync(fd);
          fd = undefined;
        }
        rmSync(directory, { recursive: true, force: true });
      };
      process.on('exit', cleanup);
      try {
        execFileSync('/usr/bin/mkfifo', [path], { timeout: 3000, stdio: 'ignore' });
        fd = openSync(path, constants.O_RDWR | constants.O_NONBLOCK);
        filler = spawn(process.execPath, [self, 'saturate'], {
          stdio: ['ignore', fd, 'ignore', 'ipc'],
          env: {},
        });
        const count = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            filler.kill('SIGKILL');
            reject(new Error('FIFO saturation setup watchdog exceeded'));
          }, 3000);
          let evidence;
          filler.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
          filler.on('message', (message) => {
            evidence = message;
          });
          filler.on('exit', (code) => {
            clearTimeout(timer);
            if (
              code !== 0 ||
              evidence?.type !== 'saturated' ||
              !Number.isSafeInteger(evidence.count) ||
              evidence.count <= 0
            )
              reject(new Error('FIFO saturation evidence missing'));
            else resolve(evidence.count);
          });
        });
        const ready = `ready ${filler.pid} eagain ${count}\n`;
        if (mode === 'blocked-stderr') process.stdout.write(ready);
        else process.stderr.write(ready);
        cli = spawn(
          process.execPath,
          [
            ...(mode === 'interrupt-output' ? ['--import', import.meta.url] : []),
            bin,
            ...process.argv.slice(2),
          ],
          {
            stdio: [
              0,
              mode === 'blocked-stderr' ? 'pipe' : fd,
              mode === 'blocked-stderr' ? fd : 'pipe',
            ],
            env: process.env,
          },
        );
        cli.stdout?.pipe(process.stdout);
        cli.stderr?.pipe(process.stderr);
        const interrupt = (signal) => {
          if (cli.exitCode === null && cli.signalCode === null) cli.kill(signal);
        };
        const sigint = () => interrupt('SIGINT');
        const sigterm = () => interrupt('SIGTERM');
        process.on('SIGINT', sigint);
        process.on('SIGTERM', sigterm);
        const code = await new Promise((resolve, reject) => {
          cli.on('error', reject);
          cli.on('close', (code, signal) =>
            signal === null ? resolve(code) : reject(new Error('CLI terminated by signal')),
          );
        });
        process.removeListener('SIGINT', sigint);
        process.removeListener('SIGTERM', sigterm);
        process.exitCode = code;
      } finally {
        cleanup();
        process.removeListener('exit', cleanup);
      }
    }
  } else throw new Error('Unknown private harness mode');
}
