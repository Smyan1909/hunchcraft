import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

// Exercise real built entry points: a source-only test runner can hide ESM errors.
for (const [name, conditions] of Object.entries(manifest.exports)) {
  assert.equal(typeof conditions.types, 'string', `${name}: missing declaration entry`);
  assert.equal(typeof conditions.import, 'string', `${name}: missing ESM entry`);
  await access(new URL(conditions.types, root));
  await import(new URL(conditions.import, root).href);
}

console.info('Built package entry points and declarations are valid.');
