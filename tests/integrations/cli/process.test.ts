import { spawn, execFile, fork } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, cp, writeFile, symlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { outputForkOptions } from '../../../src/composition/output-child.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../../helpers/consultation-fakes.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const bin = join(root, 'dist/composition/cli.js');
beforeAll(async () => {
  await promisify(execFile)(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'],
    { cwd: root },
  );
}, 30000);
function start(args: string[], entry = bin, cwd = root): ChildProcessWithoutNullStreams {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('TYPESAFE_')) delete env[key];
  const child = spawn(process.execPath, [entry, ...args], { cwd, env, stdio: 'pipe' });
  child.stdin.on('error', () => {});
  return child;
}
function completion(
  child: ChildProcessWithoutNullStreams,
  collect = true,
  collectStderr = true,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const watchdog = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('CLI watchdog exceeded'));
    }, 22000);
    if (collect)
      child.stdout.on('data', (bytes: Buffer) => {
        stdout += bytes.toString('utf8');
      });
    if (collectStderr)
      child.stderr.on('data', (bytes: Buffer) => {
        stderr += bytes.toString('utf8');
      });
    child.on('error', (error) => {
      clearTimeout(watchdog);
      reject(error);
    });
    child.on('exit', () => {
      if (!collect) child.stdout.destroy();
      if (!collectStderr) child.stderr.destroy();
    });
    child.on('close', (code) => {
      clearTimeout(watchdog);
      resolve({ code, stdout, stderr });
    });
  });
}
describe('actual executable (offline)', () => {
  it.each([
    ['--help', 0],
    ['validate', 0],
    ['consult', 3],
    ['unknown', 2],
  ] as const)('%s closes with %i', async (command, code) => {
    const child = start([command]);
    const done = completion(child);
    child.stdin.end(fixture().bytes);
    const result = await done;
    expect(result.code).toBe(code);
    expect(result.stdout).not.toContain('dummy');
    expect(result.stderr).toBe('');
  });
  it.each(['bad', 'oversize', 'crlf-unicode'] as const)('handles %s bytes', async (kind) => {
    const child = start(['validate']);
    const done = completion(child);
    const text = new TextDecoder().decode(fixture().bytes);
    child.stdin.end(
      kind === 'bad'
        ? Buffer.from([255])
        : kind === 'oversize'
          ? Buffer.alloc(49153)
          : text
              .replace(/\n/g, '\r\n')
              .replace('originalRequest": "', 'originalRequest": "日本語 '),
    );
    expect((await done).code).toBe(kind === 'crlf-unicode' ? 0 : 2);
  });
  it('works from paths with spaces and Unicode without scanning cwd', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hunchcraft space ü '));
    try {
      await cp(join(root, 'dist'), join(directory, 'dist'), { recursive: true });
      await symlink(
        join(root, 'node_modules'),
        join(directory, 'node_modules'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      await writeFile(join(directory, 'package.json'), '{"type":"module"}');
      const child = start(['validate'], join(directory, 'dist/composition/cli.js'), directory);
      const done = completion(child);
      child.stdin.end(fixture().bytes);
      expect((await done).code).toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  // Windows kill() emulates forced termination, not delivery of terminal SIGINT.
  it.skipIf(process.platform === 'win32').each(['SIGINT', 'SIGTERM'] as const)(
    'cancels blocked stdin on %s',
    async (signal) => {
      const child = start(['signal', 'validate'], join(root, 'tests/helpers/cli-process.mjs'));
      const done = completion(child);
      child.stderr.once('data', () => child.kill(signal));
      try {
        const result = await done;
        expect(result.code).toBe(130);
        expect(result.stdout).toBe('');
      } finally {
        child.kill();
      }
    },
  );
  it('does not replace output after EPIPE', async () => {
    const child = start(['validate']);
    const done = completion(child);
    child.stdout.destroy();
    child.stdin.end(fixture().bytes);
    expect((await done).code).toBe(1);
  });
  it('reaps a real worker after exact acknowledgement and successful exit', async () => {
    const child = fork(join(root, 'dist/composition/output-worker.js'), [], {
      ...outputForkOptions(process.execPath, process.platform, process.env.SystemRoot),
      stdio: ['ignore', 'pipe', 'ignore', 'ipc'],
    });
    const messages: unknown[] = [];
    const chunks: Buffer[] = [];
    child.on('message', (message) => messages.push(message));
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
    const exited = new Promise<number | null>((resolve, reject) => {
      const watchdog = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Worker watchdog exceeded'));
      }, 4000);
      child.once('error', (error) => {
        clearTimeout(watchdog);
        reject(error);
      });
      child.once('close', (code) => {
        clearTimeout(watchdog);
        resolve(code);
      });
      child.send({ type: 'output', text: '日本語\n' }, (error) => {
        if (error) {
          clearTimeout(watchdog);
          reject(error);
        }
      });
    });
    try {
      expect(await exited).toBe(0);
      expect(messages).toEqual([{ type: 'written', byteLength: 10 }]);
      expect(Buffer.concat(chunks).toString()).toBe('日本語\n');
      const pid = child.pid;
      if (pid === undefined) throw new Error('No worker PID');
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  });
  it('does not inherit secrets, NODE_OPTIONS or parent execArgv preloads into the worker', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hunchcraft preload '));
    try {
      const preload = join(directory, 'preload.mjs');
      const marker = join(directory, 'worker-loaded');
      await writeFile(
        preload,
        `import {writeFileSync} from 'node:fs'; if(process.argv[1]?.endsWith('output-worker.js')){writeFileSync(${JSON.stringify(marker)}, 'worker preload executed');process.stdout.write('worker preload leaked\\n');}`,
      );
      const env = {
        ...process.env,
        NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
        TYPESAFE_API_KEY: 'offline-secret-not-sent',
        TYPESAFE_BASE_URL: 'https://private.invalid',
      };
      const child = spawn(
        process.execPath,
        ['--import', pathToFileURL(preload).href, bin, 'validate'],
        { cwd: root, env, stdio: 'pipe' },
      );
      const done = completion(child);
      child.stdin.end(fixture().bytes);
      const result = await done;
      expect(result.code).toBe(0);
      expect(result.stdout).not.toContain('preload');
      expect(result.stdout).not.toContain('offline-secret');
      await expect(access(marker)).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('terminates genuinely blocked stdin under the original deadline', async () => {
    const child = start(['validate']);
    const done = completion(child);
    try {
      const result = await done;
      expect(result.code).toBe(5);
      expect(result.stdout).toBe('');
    } finally {
      child.kill();
    }
  }, 25000);
  it('terminates genuinely blocked inherited stdout without waiting for write callbacks', async () => {
    const child = start(['blocked-output', '--help'], join(root, 'tests/helpers/cli-process.mjs'));
    const done = completion(child, false);
    let fillerPid: number | undefined;
    child.stderr.on('data', (bytes: Buffer) => {
      const match = /ready (\d+)/.exec(bytes.toString());
      if (match?.[1]) fillerPid = Number(match[1]);
    });
    try {
      const result = await done;
      expect(result.code).toBe(5);
      expect(result.stderr).toContain('ready');
    } finally {
      child.kill();
      if (fillerPid) {
        try {
          process.kill(fillerPid, 'SIGKILL');
        } catch {
          /* Already terminated. */
        }
      }
    }
  }, 25000);
  it('terminates with blocked stderr without starting a diagnostic write', async () => {
    const child = start(
      ['blocked-stderr', 'validate'],
      join(root, 'tests/helpers/cli-process.mjs'),
    );
    const done = completion(child, true, false);
    let fillerPid: number | undefined;
    child.stdout.on('data', (bytes: Buffer) => {
      const match = /ready (\d+)/.exec(bytes.toString());
      if (match?.[1]) fillerPid = Number(match[1]);
    });
    try {
      const result = await done;
      expect(result.code).toBe(5);
      expect(result.stdout).toMatch(/^ready \d+\n$/);
    } finally {
      child.kill();
      if (fillerPid) {
        try {
          process.kill(fillerPid, 'SIGKILL');
        } catch {
          /* Already reaped. */
        }
      }
    }
  }, 25000);
  it.skipIf(process.platform === 'win32')(
    'interrupts actual blocked output without replacement or grace',
    async () => {
      const child = start(
        ['interrupt-output', '--help'],
        join(root, 'tests/helpers/cli-process.mjs'),
      );
      const done = completion(child, false);
      let fillerPid: number | undefined;
      child.stderr.on('data', (bytes: Buffer) => {
        const value = bytes.toString();
        const match = /ready (\d+)/.exec(value);
        if (match?.[1]) fillerPid = Number(match[1]);
        if (value.includes('output-started')) child.kill('SIGINT');
      });
      try {
        expect((await done).code).toBe(130);
      } finally {
        child.kill();
        if (fillerPid) {
          try {
            process.kill(fillerPid, 'SIGKILL');
          } catch {
            /* Already reaped. */
          }
        }
      }
    },
    25000,
  );
});
