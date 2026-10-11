import { hasValidScalars, utf8Bytes } from './strict-json.js';

/** Shared result/consent inspection: never execute an unknown accessor or serializer. */
export class InvalidValue extends Error {}
export function record(
  value: unknown,
  fields: readonly string[],
): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new InvalidValue();
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) throw new InvalidValue();
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== fields.length ||
    keys.some((key) => typeof key !== 'string' || !fields.includes(key))
  )
    throw new InvalidValue();
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new InvalidValue();
    result[field] = descriptor.value as unknown;
  }
  return result;
}
export function list<T>(
  value: unknown,
  max: number,
  build: (item: unknown) => T,
  min = 0,
): readonly T[] {
  if (
    !Array.isArray(value) ||
    value.length < min ||
    value.length > max ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    throw new InvalidValue();
  const fields = Array.from({ length: value.length }, (_, i) => String(i));
  if (Reflect.ownKeys(value).length !== fields.length + 1) throw new InvalidValue();
  return Object.freeze(
    fields.map((field) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new InvalidValue();
      return build(descriptor.value as unknown);
    }),
  );
}
export function text(value: unknown, max = 4096): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    !hasValidScalars(value) ||
    !value.trim() ||
    utf8Bytes(value) > max
  )
    throw new InvalidValue();
  return value;
}
export function identifier(value: unknown): string {
  const v = text(value, 64);
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v)) throw new InvalidValue();
  return v;
}
export function hex(value: unknown, length: number): string {
  const v = text(value, length);
  if (v.length !== length || !/^[0-9a-f]+$/.test(v)) throw new InvalidValue();
  return v;
}
export function numeric(
  value: unknown,
  max = Number.MAX_SAFE_INTEGER,
  integer = false,
  min = 0,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Object.is(value, -0) ||
    value < min ||
    value > max ||
    (integer && !Number.isSafeInteger(value))
  )
    throw new InvalidValue();
  return value;
}
export function literal<T extends string | number | boolean | null>(
  value: unknown,
  expected: T,
): T {
  if (value !== expected) throw new InvalidValue();
  return expected;
}
export function oneOf<T extends string>(value: unknown, choices: readonly T[]): T {
  for (const choice of choices) if (value === choice) return choice;
  throw new InvalidValue();
}
export function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new InvalidValue();
  return value;
}
export function refs(value: unknown, max: number): readonly string[] {
  const result = list(value, max, identifier);
  if (new Set(result).size !== result.length) throw new InvalidValue();
  return result;
}
export function epoch(value: unknown): number {
  const result = numeric(value, 253402300799999, true);
  return result;
}
export function iso(value: unknown): string {
  const result = text(value, 24);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(result)) throw new InvalidValue();
  const ms = epoch(Date.parse(result));
  if (new Date(ms).toISOString() !== result) throw new InvalidValue();
  return result;
}
