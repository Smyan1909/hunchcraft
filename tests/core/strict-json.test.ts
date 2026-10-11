import { describe, expect, it } from 'vitest';
import { exactInteger, parseStrictJson } from '../../src/core/strict-json.js';

describe('strict JSON boundary', () => {
  it('preserves valid Unicode, escapes, CRLF and string contents', () => {
    const result = parseStrictJson(
      ' \r\n{"text":" café 😀\\r\\n\\t ","a":[true,false,null,1.0,1e0]}\t',
    );
    expect(result).toMatchObject({
      ok: true,
      value: { text: ' café 😀\r\n\t ', a: [true, false, null, 1, 1] },
    });
    if (!result.ok) throw new Error('Expected valid fixture.');
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it.each([
    '{"id":1,"id":2}',
    '{"id":1,"\\u0069d":2}',
    '{"outer":{"x":1,"\\u0078":2}}',
    '{"__proto__":{}}',
    '{"outer":{"constructor":1}}',
    '{"\\u0070rototype":null}',
    '{"0":1}',
    '{"text":"\\u0000"}',
    '{"text":"\\ud800"}',
    '{"text":"\\udc00"}',
    '{"text":"\ud800"}',
    '\ufeff{}',
    '{"x":1,}',
    '[1,]',
    '{}{}',
    '{"x":01}',
    '{"x":+1}',
    '{"x":.1}',
    '{"x":NaN}',
    '{"x":Infinity}',
    '{"x":1e309}',
    '{"x":-0}',
    '{"x":-0.0}',
    '{"x":-0e5}',
    '{"x":9007199254740992}',
    '{"x":9007199254740990.9}',
    '{"x":1.00000000000000001}',
    '{"x":0.99999999999999999999}',
    '{"x":1e-999}',
    '{"x":1e999}',
    '{"text":"unfinished}',
    '{"text":"\\x"}',
    '/* comment */{}',
    '{"x":undefined}',
  ])('rejects malformed, aliased, unsafe or forbidden input %#', (input) => {
    expect(parseStrictJson(input)).toEqual({
      ok: false,
      error: { code: 'invalid_input', message: 'Input does not satisfy the v0 contract.' },
    });
  });

  it('rejects invalid UTF-8 and BOM bytes instead of replacing characters', () => {
    for (const bytes of [
      new Uint8Array([0xc0, 0xaf]),
      new Uint8Array([0xed, 0xa0, 0x80]),
      new Uint8Array([0xef, 0xbb, 0xbf, 123, 125]),
      new Uint8Array([0xf0, 0x9f]),
    ]) {
      expect(parseStrictJson(bytes).ok).toBe(false);
    }
    expect(parseStrictJson(new TextEncoder().encode('{"text":"😀"}')).ok).toBe(true);
  });

  it('counts only containers, accepting depth16 and rejecting the 17th', () => {
    expect(parseStrictJson('['.repeat(16) + '1' + ']'.repeat(16)).ok).toBe(true);
    expect(parseStrictJson('['.repeat(17) + '1' + ']'.repeat(17)).ok).toBe(false);
    expect(parseStrictJson('{"x":1}', { maxDepth: 1 }).ok).toBe(true);
    expect(parseStrictJson('{"x":[]}', { maxDepth: 1 }).ok).toBe(false);
  });

  it('checks UTF-8 bytes, not character count, before parsing', () => {
    expect(parseStrictJson('"é"', { maxBytes: 4 }).ok).toBe(true);
    expect(parseStrictJson('"é"', { maxBytes: 3 }).ok).toBe(false);
    expect(parseStrictJson(new Uint8Array(48 * 1024 + 1)).ok).toBe(false);
    expect(parseStrictJson('{}', { maxDepth: 1000 }).ok).toBe(false);
  });

  it('permits provider numeric maps/finite floats only with deliberate options', () => {
    const options = {
      allowNumericKeys: true,
      numbers: 'finite',
      integerKeys: ['input_tokens', 'output_tokens'],
    } as const;
    expect(parseStrictJson('{"0":0.1,"1":0.9,"input_tokens":1e0}', options).ok).toBe(true);
    expect(parseStrictJson('{"0":0.1,"input_tokens":1.00000000000000001}', options).ok).toBe(false);
    expect(parseStrictJson('{"0":0.1,"\\u0030":0.9}', options).ok).toBe(false);
    expect(parseStrictJson('{"constructor":0.1}', options).ok).toBe(false);
    expect(parseStrictJson('{"0":-0}', options).ok).toBe(false);
  });

  it('checks bounded exact decimal coefficients without expanding exponents', () => {
    for (const token of [
      '1',
      '1.0',
      '1e0',
      '100e-2',
      '9007199254740991',
      '-9007199254740991',
      '9.007199254740991e15',
      '0e999999999999999999999',
    ]) {
      expect(exactInteger(token)).toBe(Number(token));
    }
    for (const token of [
      '1.01',
      '10e-2',
      '9007199254740991.1',
      '1e99999999999999999999',
      '1' + '0'.repeat(128),
      '-0',
      '1e-99999',
    ]) {
      expect(exactInteger(token)).toBeUndefined();
    }
  });

  it('decodes escaped quotes/backslashes and preserves distinct Unicode key spellings', () => {
    const result = parseStrictJson('{"text":"a\\"b\\\\c","é":1,"e\\u0301":2}');
    expect(result).toMatchObject({ ok: true, value: { text: 'a"b\\c', é: 1, 'e\u0301': 2 } });
  });
});
