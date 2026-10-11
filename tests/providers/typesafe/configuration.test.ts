import { describe, expect, it } from 'vitest';
import { validateTypeSafeConfiguration } from '../../../src/providers/typesafe/configuration.js';

const snapshot = {
  apiKey: 'dummy-offline-key',
  baseURL: undefined,
  defaultModel: undefined,
  logLevel: undefined,
};

describe('selected TypeSafe configuration (no environment reader)', () => {
  it('trims only configuration and freezes fixed policy', () => {
    const result = validateTypeSafeConfiguration({
      ...snapshot,
      apiKey: '  dummy-offline-key\n',
      baseURL: ' https://api.typesafe.ai ',
      defaultModel: ' jev-1.13.0 ',
      logLevel: 'debug-private-sentinel',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        apiKey: 'dummy-offline-key',
        baseURL: 'https://api.typesafe.ai',
        defaultModel: 'jev-1.13.0',
        logLevel: 'off',
        maxRetries: 0,
        loggingOverrideIgnored: true,
      },
    });
    if (!result.ok) throw new Error('configuration rejected');
    expect(Object.isFrozen(result.value)).toBe(true);
  });
  it.each([undefined, '', ' \n\t'])('classifies absent key %j without echo', (apiKey) => {
    expect(validateTypeSafeConfiguration({ ...snapshot, apiKey })).toMatchObject({
      ok: false,
      error: { code: 'missing_key', exitCode: 3 },
    });
  });
  it.each([
    { ...snapshot, baseURL: 'https://private-sentinel.example' },
    { ...snapshot, defaultModel: 'jev-latest' },
    { ...snapshot, logLevel: 1 },
    { ...snapshot, apiKey: null },
    { ...snapshot, apiKey: 'bad\0key' },
    { ...snapshot, unexpected: 'private-sentinel' },
    { apiKey: snapshot.apiKey },
    null,
    [],
  ])('rejects malformed/conflicting selected snapshots without echo', (value) => {
    const result = validateTypeSafeConfiguration(value);
    expect(result).toMatchObject({ ok: false, error: { code: 'configuration_conflict' } });
    expect(JSON.stringify(result)).not.toContain('private-sentinel');
  });
  it('rejects getters/symbols/prototypes and inspection failures without executing getters', () => {
    let reads = 0;
    const getter = { ...snapshot };
    Object.defineProperty(getter, 'apiKey', {
      get: () => {
        reads++;
        throw new Error('private-sentinel');
      },
    });
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('private-sentinel');
        },
      },
    );
    for (const value of [
      getter,
      hostile,
      { ...snapshot, [Symbol('private-sentinel')]: 1 },
      Object.create(snapshot),
    ]) {
      expect(validateTypeSafeConfiguration(value)).toMatchObject({
        ok: false,
        error: { code: 'configuration_conflict' },
      });
    }
    expect(reads).toBe(0);
  });
  it.each(['', ' \t', 'off'])(
    'ignores blank/off logging without an override diagnostic',
    (logLevel) => {
      expect(validateTypeSafeConfiguration({ ...snapshot, logLevel })).toMatchObject({
        ok: true,
        value: { loggingOverrideIgnored: false },
      });
    },
  );
});
