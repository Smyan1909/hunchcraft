import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import {
  access,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli && isAbsolute(npmCli), 'Run this check with npm run check:packed.');
await access(npmCli);
const directory = await mkdtemp(join(await realpath(tmpdir()), 'hunchcraft packed ü '));
const active = new Set();
const env = {};
// Explicit runtime/cache paths only: no TypeSafe keys, npm auth, preloads or inherited npm options.
for (const key of [
  'PATH',
  'Path',
  'HOME',
  'USERPROFILE',
  'SystemRoot',
  'WINDIR',
  'TMP',
  'TEMP',
  'TMPDIR',
  'LOCALAPPDATA',
  'APPDATA',
  'LANG',
  'LC_ALL',
]) {
  if (process.env[key] !== undefined) env[key] = process.env[key];
}
env.PATH = `${dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${env.PATH ?? env.Path ?? ''}`;
delete env.Path;
const userConfig = join(directory, 'empty-user.npmrc');
const globalConfig = join(directory, 'empty-global.npmrc');
const npmOptions = ['--userconfig', userConfig, '--globalconfig', globalConfig];
if (process.env.npm_config_cache) npmOptions.push('--cache', process.env.npm_config_cache);

/** Normal completion means observed close, not a write callback or stdout EOF. */
function run(label, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? directory,
      env: options.env ?? env,
      stdio: options.ready ? ['pipe', 'pipe', 'pipe', 'ipc'] : 'pipe',
      windowsVerbatimArguments: options.windowsVerbatimArguments ?? false,
    });
    active.add(child);
    let finished = false;
    let fault;
    const stdout = [];
    const stderr = [];
    let size = 0;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      if (error) reject(error);
      else resolve(value);
    };
    const watchdog = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* Cleanup below will report unreclaimed children. */
      }
      finish(new Error(`${label}: process watchdog exceeded.`));
    }, options.timeout ?? 22000);
    const capture = (target, bytes) => {
      size += bytes.byteLength;
      if (size > 2 * 1024 * 1024) {
        fault = new Error(`${label}: process output exceeded check limit.`);
        child.kill('SIGKILL');
      } else target.push(bytes);
    };
    child.stdout.on('data', (bytes) => capture(stdout, bytes));
    child.stderr.on('data', (bytes) => capture(stderr, bytes));
    child.stdout.on('error', () => {
      fault ??= new Error(`${label}: stdout failed.`);
    });
    child.stderr.on('error', () => {
      fault ??= new Error(`${label}: stderr failed.`);
    });
    // Early invalid-input/argument termination can close stdin before its callback.
    child.stdin.on('error', () => {});
    child.on('error', () => {
      fault ??= new Error(`${label}: process spawn failed.`);
    });
    child.on('close', (code, signal) => {
      active.delete(child);
      finish(fault, { code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
    if (options.ready)
      child.on('message', (message) => {
        if (message?.type === 'ready' && !finished) child.kill('SIGINT');
      });
    if (options.epipe) child.stdout.destroy();
    if (!options.ready) child.stdin.end(options.input ?? Buffer.alloc(0));
  });
}
async function npm(args, cwd) {
  const result = await run(`npm ${args[0]}`, process.execPath, [npmCli, ...args, ...npmOptions], {
    cwd,
    timeout: 90000,
  });
  assert.equal(
    result.code,
    0,
    `npm ${args[0]} failed; cache-only installation requires the locked SDK from npm ci. ${result.stderr.toString('utf8')}`,
  );
  assert.equal(result.signal, null);
  return result.stdout.toString('utf8');
}
function field(header, start, length) {
  return header
    .subarray(start, start + length)
    .toString('utf8')
    .split('\0')[0];
}
/** Inspect the actual archive, independently of npm's pack-list report. */
function archiveFiles(compressed) {
  const tar = gunzipSync(compressed, { maxOutputLength: 16 * 1024 * 1024 });
  const files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const sizeText = field(header, 124, 12).trim();
    assert.match(sizeText, /^[0-7]+$/);
    const size = parseInt(sizeText, 8);
    const name = [field(header, 345, 155), field(header, 0, 100)].filter(Boolean).join('/');
    assert.ok(name.startsWith('package/') && !name.includes('\\'));
    const path = name.slice(8);
    assert.equal(posix.normalize(path), path);
    assert.ok(!path.startsWith('../') && !path.startsWith('/'));
    assert.ok(offset + 512 + size <= tar.length, 'Truncated tar entry.');
    const type = field(header, 156, 1);
    assert.ok(type === '0' || type === '', `Unexpected non-file tar entry: ${path}`);
    assert.ok(!files.has(path), `Duplicate tar path: ${path}`);
    files.set(path, {
      bytes: tar.subarray(offset + 512, offset + 512 + size),
      mode: parseInt(field(header, 100, 8).trim(), 8),
    });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  assert.ok(files.size > 0);
  return files;
}
function inspectContents(files, reported, manifest) {
  assert.deepEqual([...files.keys()].sort(), reported.map((file) => file.path).sort());
  assert.deepEqual(manifest.dependencies, { '@typesafe-ai/sdk': '0.6.0' });
  assert.deepEqual(manifest.bin, { hunchcraft: 'dist/composition/cli.js' });
  for (const required of [
    'LICENSE',
    'README.md',
    'docs/usage.md',
    'examples/brief.json',
    'package.json',
    'dist/index.js',
    'dist/index.d.ts',
    manifest.bin.hunchcraft,
    'dist/composition/output-worker.js',
    'src/composition/output-worker.ts',
  ]) {
    assert.ok(files.has(required), `Missing packed file: ${required}`);
  }
  assert.ok(
    files.get(manifest.bin.hunchcraft).bytes.toString().startsWith('#!/usr/bin/env node\n'),
  );
  for (const [path, file] of files) {
    assert.match(
      path,
      /^(?:src\/|dist\/|docs\/usage\.md$|examples\/brief\.json$|README\.md$|LICENSE$|package\.json$)/,
    );
    assert.doesNotMatch(
      path,
      /(?:^|\/)(?:tests?|helpers|fixtures|node_modules|\.agents)(?:\/|\.)|\.test\.|(?:^|\/)(?:session|consent|identity|admission|verify|secure-storage|root-identity)(?:[./_-]|$)/i,
    );
    assert.doesNotMatch(
      file.bytes.toString('utf8'),
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|dummy-offline-key|offline-secret-not-sent|private cleanup failure/,
    );
    if (path.endsWith('.js') || path.endsWith('.d.ts'))
      assert.ok(files.has(`${path}.map`), `Missing map: ${path}`);
    if (path.endsWith('.map')) {
      const map = JSON.parse(file.bytes.toString('utf8'));
      assert.equal(map.version, 3);
      assert.ok(Array.isArray(map.sources) && map.sources.length > 0);
      for (const source of map.sources) {
        assert.equal(typeof source, 'string');
        assert.ok(
          files.has(posix.normalize(posix.join(posix.dirname(path), source))),
          `Missing mapped source: ${path}`,
        );
      }
    }
  }
}
async function compareTree(expected, actual) {
  const names = (await readdir(expected)).sort();
  assert.deepEqual((await readdir(actual)).sort(), names, 'Installed locked SDK file set changed.');
  for (const name of names) {
    const source = join(expected, name);
    const target = join(actual, name);
    if ((await lstat(source)).isDirectory()) await compareTree(source, target);
    else
      assert.deepEqual(
        await readFile(target),
        await readFile(source),
        `Installed locked SDK changed: ${name}`,
      );
  }
}
function windowsCommand(shim, args) {
  // All arguments are fixed check literals; input JSON goes through stdin, never cmd.exe.
  for (const value of [shim, ...args])
    assert.doesNotMatch(value, /["%!^&|<>\r\n]/, 'Unsafe cmd.exe path/argument.');
  return `""${shim}" ${args.map((value) => `"${value}"`).join(' ')}"`;
}

try {
  await writeFile(userConfig, '');
  await writeFile(globalConfig, '');
  const packDirectory = join(directory, 'archive');
  const consumer = join(directory, 'installed path 日本語');
  await mkdir(packDirectory);
  await mkdir(consumer);
  const report = JSON.parse(
    await npm(['pack', '--json', '--ignore-scripts', '--pack-destination', packDirectory], root),
  );
  assert.equal(report.length, 1);
  assert.equal(report[0].filename, posix.basename(report[0].filename));
  const archive = join(packDirectory, report[0].filename);
  const files = archiveFiles(await readFile(archive));
  const manifest = JSON.parse(files.get('package.json').bytes.toString('utf8'));
  inspectContents(files, report[0].files, manifest);
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  const lockedSdk = lock.packages['node_modules/@typesafe-ai/sdk'];
  assert.equal(lockedSdk.version, '0.6.0');
  assert.equal(lockedSdk.resolved, 'https://registry.npmjs.org/@typesafe-ai/sdk/-/sdk-0.6.0.tgz');
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'hunchcraft-offline-consumer', private: true, type: 'module' }),
  );
  await npm(
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      '--omit=dev',
      lockedSdk.resolved,
      archive,
    ],
    consumer,
  );
  const installed = join(consumer, 'node_modules/hunchcraft');
  // npm applies executable mode when creating the bin link, even if tsc's
  // emitted file was archived as 0644. Verify the installed bin, not tar mode.
  if (process.platform !== 'win32')
    assert.ok((await lstat(join(installed, manifest.bin.hunchcraft))).mode & 0o111);
  for (const [path, file] of files)
    assert.deepEqual(
      await readFile(join(installed, path)),
      file.bytes,
      `Installed artifact differs: ${path}`,
    );
  const modules = (await readdir(join(consumer, 'node_modules')))
    .filter((name) => !name.startsWith('.'))
    .sort();
  assert.deepEqual(modules, ['@typesafe-ai', 'hunchcraft']);
  assert.deepEqual(await readdir(join(consumer, 'node_modules/@typesafe-ai')), ['sdk']);
  const sdk = join(consumer, 'node_modules/@typesafe-ai/sdk');
  assert.equal(JSON.parse(await readFile(join(sdk, 'package.json'), 'utf8')).version, '0.6.0');
  assert.equal(lock.packages['node_modules/@typesafe-ai/sdk'].version, '0.6.0');
  // Cache-only install plus exact payload comparison to the npm-ci locked install:
  // no mutable metadata resolution can silently substitute a different SDK payload.
  await compareTree(join(root, 'node_modules/@typesafe-ai/sdk'), sdk);

  const probe = join(consumer, 'inert-root.mjs');
  await writeFile(
    probe,
    `import assert from 'node:assert/strict';
import {createRequire,syncBuiltinESMExports} from 'node:module';
const attempts=[];const deny=label=>()=>{attempts.push(label);throw new Error('Forbidden import-time work');};
process.env=new Proxy(process.env,{get(target,key){if(typeof key==='string'&&/^TYPESAFE_/i.test(key))return deny('credential')();return Reflect.get(target,key);},ownKeys(){return deny('environment scan')();}});
const require=createRequire(import.meta.url);
for(const [name,methods] of [['node:child_process',['spawn','fork','exec','execFile']],['node:http',['request','get']],['node:https',['request','get']],['node:net',['connect','createConnection']],['node:tls',['connect']],['node:timers',['setTimeout','setInterval','setImmediate']],['node:timers/promises',['setTimeout','setInterval','setImmediate']]])for(const method of methods)require(name)[method]=deny(name+':'+method);
for(const method of ['fetch','setTimeout','setInterval','setImmediate'])globalThis[method]=deny(method);
syncBuiltinESMExports();assert.deepEqual(Object.keys(await import('hunchcraft')),[]);assert.deepEqual(attempts,[]);
`,
  );
  const inert = await run('installed inert import', process.execPath, [probe], { cwd: consumer });
  assert.equal(inert.code, 0);
  assert.equal(inert.signal, null);
  assert.equal(inert.stdout.length, 0);
  assert.equal(inert.stderr.length, 0);
  const { parseResultEnvelope } = await import(
    pathToFileURL(join(installed, 'dist/core/result.js')).href
  );
  const fixture = await readFile(join(installed, 'examples/brief.json'));
  const unicode = JSON.parse(fixture.toString('utf8'));
  unicode.brief.originalRequest += ' 日本語 café';
  const shim = join(
    consumer,
    'node_modules/.bin',
    process.platform === 'win32' ? 'hunchcraft.cmd' : 'hunchcraft',
  );
  await access(shim);
  const invoke = (args, options = {}) =>
    process.platform === 'win32'
      ? run(
          'installed npm bin shim',
          join(env.SystemRoot ?? env.WINDIR, 'System32/cmd.exe'),
          ['/d', '/s', '/c', windowsCommand(shim, args)],
          { ...options, cwd: consumer, windowsVerbatimArguments: true },
        )
      : run('installed npm bin shim', shim, args, { ...options, cwd: consumer });
  const cases = [
    { args: ['--help'], code: 0 },
    { args: ['validate'], input: fixture, code: 0, kind: 'validation' },
    {
      args: ['validate'],
      input: Buffer.from(JSON.stringify(unicode, null, 2).replace(/\n/g, '\r\n')),
      code: 0,
      kind: 'validation',
    },
    { args: ['consult'], input: fixture, code: 3, error: 'missing_key' },
    { args: ['consult'], input: Buffer.from('{}'), code: 2, error: 'invalid_input' },
    { args: ['validate'], input: Buffer.from([255]), code: 2, error: 'invalid_input' },
    { args: ['validate'], input: Buffer.alloc(49153), code: 2, error: 'invalid_input' },
    { args: [], code: 2, error: 'invalid_input' },
    { args: ['unknown'], code: 2, error: 'invalid_input' },
    { args: ['validate', 'not-a-file-argument'], code: 2, error: 'invalid_input' },
  ];
  for (const test of cases) {
    const result = await invoke(test.args, { input: test.input });
    assert.equal(result.code, test.code);
    assert.equal(result.signal, null);
    assert.equal(result.stderr.length, 0);
    assert.ok(result.stdout.length <= 256 * 1024 && result.stdout.at(-1) === 10);
    if (test.args[0] === '--help') assert.match(result.stdout.toString('utf8'), /TYPESAFE_API_KEY/);
    else {
      const parsed = parseResultEnvelope(new Uint8Array(result.stdout));
      assert.ok(parsed.ok, 'Installed shim emitted invalid result JSON.');
      assert.equal(parsed.value.kind, test.kind ?? 'error');
      if (test.error) assert.equal(parsed.value.error.code, test.error);
      else assert.equal(parsed.value.checkCount, 6);
    }
  }
  const epipe = await invoke(['validate'], { input: fixture, epipe: true });
  assert.equal(epipe.code, 1);
  assert.equal(epipe.stderr.length, 0);
  assert.equal(epipe.stdout.length, 0);
  let interrupted = false;
  if (process.platform !== 'win32') {
    const ready = join(consumer, 'stdin-ready.mjs');
    await writeFile(
      ready,
      `process.stdin.on('newListener',event=>{if(event==='data')queueMicrotask(()=>process.send?.({type:'ready'}));});`,
    );
    const result = await invoke(['validate'], {
      ready: true,
      env: { ...env, NODE_OPTIONS: `--import=${pathToFileURL(ready).href}` },
    });
    assert.equal(result.code, 130);
    assert.equal(result.stdout.length, 0);
    assert.equal(result.stderr.length, 0);
    interrupted = true;
  }
  console.info(
    `Packed artifact verified: ${files.size} files; cache-only SDK 0.6.0; inert installed root; ${cases.length} npm-shim cases; EPIPE${interrupted ? '; POSIX interruption' : '; Windows terminal interruption not asserted'}.`,
  );
} finally {
  // Keep error/close observers attached while watchdog losers terminate.
  try {
    await Promise.all(
      [...active].map(
        (child) =>
          new Promise((resolve, reject) => {
            if (child.exitCode !== null || child.signalCode !== null) {
              resolve();
              return;
            }
            const timer = setTimeout(
              () => reject(new Error('Packed-check subprocess could not be reclaimed.')),
              2000,
            );
            child.once('close', () => {
              clearTimeout(timer);
              resolve();
            });
            try {
              child.kill('SIGKILL');
            } catch {
              clearTimeout(timer);
              reject(new Error('Packed-check subprocess termination failed.'));
            }
          }),
      ),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
