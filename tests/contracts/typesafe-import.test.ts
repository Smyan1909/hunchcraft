import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';

describe('TypeSafe import/factory inactivity', () => {
  it('imports the installed SDK with throwing network/timers and credential read guards', () => {
    const script = `
      const originalEnv = process.env;
      let reads = 0;
      process.env = new Proxy(originalEnv, { get(target, key) {
        if (typeof key === 'string' && key.startsWith('TYPESAFE_')) { reads++; throw new Error('credential read'); }
        return Reflect.get(target, key);
      }});
      globalThis.fetch = () => { throw new Error('network'); };
      globalThis.setTimeout = () => { throw new Error('timer'); };
      globalThis.setInterval = () => { throw new Error('timer'); };
      const sdk = await import('@typesafe-ai/sdk');
      if (sdk.VERSION !== '0.6.0') throw new Error('wrong SDK');
      if (reads) throw new Error('import activity');
    `;
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--input-type=module', '-e', script],
      { cwd: new URL('../..', import.meta.url), encoding: 'utf8', timeout: 10000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe('');
  });
  it('imports and creates the source factory without invoking injected capabilities or globals', async () => {
    vi.resetModules();
    const original = process.env;
    const poison = (): never => {
      throw new Error('unexpected activity');
    };
    vi.stubGlobal('fetch', poison);
    vi.stubGlobal('setTimeout', poison);
    vi.stubGlobal('setInterval', poison);
    process.env = new Proxy(original, {
      get(target, key) {
        if (typeof key === 'string' && key.startsWith('TYPESAFE_')) return poison();
        return Reflect.get(target, key) as unknown;
      },
    });
    try {
      await import('../../src/core/brief.js');
      await import('../../src/core/result.js');
      await import('../../src/application/operation.js');
      await import('../../src/application/consult.js');
      const { createTypeSafeProvider } = await import('../../src/providers/typesafe/provider.js');
      expect(
        createTypeSafeProvider({
          configuration: poison,
          fetch: poison,
          clock: { monotonicMs: poison, wallTimeMs: poison, schedule: poison },
        }).origin,
      ).toBe('provider-http');
    } finally {
      process.env = original;
      vi.unstubAllGlobals();
    }
  });
});
