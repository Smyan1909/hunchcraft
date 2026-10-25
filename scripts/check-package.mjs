import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

// Exercise real built entry points: a source-only test runner can hide ESM errors.
for (const [name, conditions] of Object.entries(manifest.exports)) {
  assert.equal(typeof conditions.types, 'string', `${name}: missing declaration entry`);
  assert.equal(typeof conditions.import, 'string', `${name}: missing ESM entry`);
  await access(new URL(conditions.types, root));
  await import(new URL(conditions.import, root).href);
}

assert.equal(manifest.bin.hunchcraft, 'dist/composition/cli.js');
const executable = new URL(manifest.bin.hunchcraft, root);
await access(new URL('dist/composition/output-worker.js', root));
assert.ok((await readFile(executable, 'utf8')).startsWith('#!/usr/bin/env node\n'));
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.startsWith('TYPESAFE_')) delete env[key];
const help = await promisify(execFile)(process.execPath, [fileURLToPath(executable), '--help'], {
  env,
  timeout: 20000,
  maxBuffer: 256 * 1024,
});
assert.match(help.stdout, /TYPESAFE_API_KEY/);
assert.equal(help.stderr, '');
console.info('Built package entry points, declarations and executable help are valid.');
