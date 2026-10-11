/** Closed, source-free failures shared by the M1 boundaries. */
export type CoreFailure = Readonly<{
  ok: false;
  error: Readonly<{ code: 'invalid_input' | 'check_budget_exceeded'; message: string }>;
}>;

export function invalidInput(): CoreFailure {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: 'invalid_input',
      message: 'Input does not satisfy the v0 contract.',
    }),
  });
}

export function checkBudgetExceeded(): CoreFailure {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: 'check_budget_exceeded',
      message: 'The complete mandatory check set exceeds the v0 limit.',
    }),
  });
}

export type JsonValue = null | boolean | number | string | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/** Only transport limits and the provider's deliberate numeric exceptions vary. */
export interface StrictJsonOptions {
  readonly maxBytes?: number;
  readonly maxDepth?: number;
  readonly allowNumericKeys?: boolean;
  readonly numbers?: 'integer' | 'finite';
  readonly integerKeys?: readonly string[];
}

export type ParsedJson = Readonly<{ ok: true; value: JsonValue; inputBytes: number }> | CoreFailure;

class InvalidJson extends Error {}

/** UTF-8 length without normalizing text. Call only after scalar validity checks. */
export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function hasValidScalars(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit === 0) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

/** Verify mathematical integer value before binary64 conversion can round it. */
export function exactInteger(token: string): number | undefined {
  if (token.length > 128) return undefined;
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  if (!match) return undefined;
  const whole = match[2];
  if (whole === undefined) return undefined;
  const fraction = match[3] ?? '';
  let digits = (whole + fraction).replace(/^0+/, '');
  const value = Number(token);
  if (!Number.isFinite(value) || Object.is(value, -0)) return undefined;
  if (digits.length === 0) return 0;
  const exponent = Number(match[4] ?? '0');
  // A nonzero coefficient of <=128 digits cannot become a safe integer outside
  // this range. No exponentiation or unbounded BigInt allocation is performed.
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 256) return undefined;
  const shift = exponent - fraction.length;
  if (shift < 0) {
    const remove = -shift;
    if (remove > digits.length || !/^0*$/.test(digits.slice(-remove))) return undefined;
    digits = digits.slice(0, digits.length - remove);
  } else {
    if (digits.length + shift > 16) return undefined;
    digits += '0'.repeat(shift);
  }
  if (digits.length > 16 || BigInt(digits || '0') > 9007199254740991n) return undefined;
  return Number.isSafeInteger(value) ? value : undefined;
}

class Parser {
  private position = 0;
  constructor(
    private readonly text: string,
    private readonly options: Required<StrictJsonOptions>,
  ) {}

  parse(): JsonValue {
    this.space();
    const value = this.value(0);
    this.space();
    if (this.position !== this.text.length) throw new InvalidJson();
    return value;
  }

  private space(): void {
    while (/^[\x20\t\r\n]$/.test(this.text[this.position] ?? '')) this.position++;
  }

  private take(character: string): void {
    if (this.text[this.position++] !== character) throw new InvalidJson();
  }

  private value(depth: number, key?: string): JsonValue {
    this.space();
    const character = this.text[this.position];
    if (character === '{' || character === '[') {
      if (depth >= this.options.maxDepth) throw new InvalidJson();
      return character === '{' ? this.object(depth + 1) : this.array(depth + 1);
    }
    if (character === '"') return this.string();
    for (const [literal, value] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (this.text.startsWith(literal, this.position)) {
        this.position += literal.length;
        return value;
      }
    }
    const start = this.position;
    while (/^[0-9eE+.-]$/.test(this.text[this.position] ?? '')) this.position++;
    const token = this.text.slice(start, this.position);
    if (
      token.length === 0 ||
      token.length > 128 ||
      !/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(token)
    )
      throw new InvalidJson();
    const number =
      this.options.numbers === 'integer' ||
      (key !== undefined && this.options.integerKeys.includes(key))
        ? exactInteger(token)
        : Number(token);
    if (number === undefined || !Number.isFinite(number) || Object.is(number, -0))
      throw new InvalidJson();
    return number;
  }

  private string(): string {
    const start = this.position;
    this.take('"');
    while (this.position < this.text.length) {
      const character = this.text[this.position++];
      if (character === '"') {
        // JSON.parse is used only to decode a scanned string token, never an object
        // whose duplicate keys would be erased. Its return is narrowed from unknown.
        let decoded: unknown;
        try {
          decoded = JSON.parse(this.text.slice(start, this.position));
        } catch {
          throw new InvalidJson();
        }
        if (typeof decoded !== 'string' || !hasValidScalars(decoded)) throw new InvalidJson();
        return decoded;
      }
      if (character === '\\') this.position++;
    }
    throw new InvalidJson();
  }

  private object(depth: number): JsonObject {
    this.take('{');
    const entries: [string, JsonValue][] = [];
    const keys = new Set<string>();
    this.space();
    if (this.text[this.position] !== '}') {
      while (true) {
        this.space();
        const key = this.string();
        if (
          keys.has(key) ||
          ['__proto__', 'prototype', 'constructor'].includes(key) ||
          (!this.options.allowNumericKeys && /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(key))
        )
          throw new InvalidJson();
        keys.add(key);
        this.space();
        this.take(':');
        entries.push([key, this.value(depth, key)]);
        this.space();
        if (this.text[this.position] !== ',') break;
        this.position++;
      }
    }
    this.take('}');
    return Object.freeze(Object.fromEntries(entries));
  }

  private array(depth: number): readonly JsonValue[] {
    this.take('[');
    const values: JsonValue[] = [];
    this.space();
    if (this.text[this.position] !== ']') {
      while (true) {
        values.push(this.value(depth));
        this.space();
        if (this.text[this.position] !== ',') break;
        this.position++;
      }
    }
    this.take(']');
    return Object.freeze(values);
  }
}

/** Pure bounded decoding/parsing; never reads streams, files or process state. */
export function parseStrictJson(
  input: string | Uint8Array,
  options: StrictJsonOptions = {},
): ParsedJson {
  const limits: Required<StrictJsonOptions> = {
    maxBytes: options.maxBytes ?? 48 * 1024,
    maxDepth: options.maxDepth ?? 16,
    allowNumericKeys: options.allowNumericKeys ?? false,
    numbers: options.numbers ?? 'integer',
    integerKeys: options.integerKeys ?? [],
  };
  if (
    !Number.isSafeInteger(limits.maxBytes) ||
    limits.maxBytes < 1 ||
    limits.maxBytes > 256 * 1024 ||
    !Number.isSafeInteger(limits.maxDepth) ||
    limits.maxDepth < 1 ||
    limits.maxDepth > 16
  )
    return invalidInput();
  let text: string;
  let inputBytes: number;
  if (typeof input === 'string') {
    if (input.length > limits.maxBytes || !hasValidScalars(input)) return invalidInput();
    text = input;
    inputBytes = utf8Bytes(input);
  } else {
    inputBytes = input.byteLength;
    if (inputBytes > limits.maxBytes) return invalidInput();
    try {
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input);
    } catch {
      return invalidInput();
    }
  }
  if (inputBytes > limits.maxBytes || text.startsWith('\ufeff') || !hasValidScalars(text))
    return invalidInput();
  try {
    return Object.freeze({ ok: true, value: new Parser(text, limits).parse(), inputBytes });
  } catch (error) {
    if (error instanceof InvalidJson) return invalidInput();
    throw error;
  }
}
