import type { Operation } from '../../application/operation.js';
import {
  ClassifiedFailure,
  failure,
  parseResultEnvelope,
  prepareBytes,
} from '../../core/result.js';
import type { ResultEnvelope, Validation } from '../../core/result.js';

export interface OutputSink {
  deliver(text: string, signal: AbortSignal): Promise<void>;
}
export function encodeEnvelope(envelope: ResultEnvelope): Uint8Array {
  const bytes = new TextEncoder().encode(`${JSON.stringify(envelope)}\n`);
  if (!parseResultEnvelope(bytes).ok)
    throw new ClassifiedFailure(failure('internal_failure', 'internal'));
  const prepared = prepareBytes(bytes);
  if (!prepared.ok) throw new ClassifiedFailure(prepared.error);
  return prepared.value.copyBytes();
}
/** A single delivery attempt. Every continuation is fenced against the same lifetime. */
export async function writeOutput(
  sink: OutputSink,
  bytes: Uint8Array,
  operation: Operation,
): Promise<Validation<void>> {
  const prepared = prepareBytes(bytes);
  if (!prepared.ok) return prepared;
  const text = new TextDecoder('utf-8', { fatal: true }).decode(prepared.value.copyBytes());
  const delivery = await operation.wait('output', (signal) => {
    const fence = operation.checkpoint('output');
    if (!fence.ok) throw new ClassifiedFailure(fence.error);
    return sink.deliver(text, signal);
  });
  if (!delivery.ok) return delivery;
  const after = operation.checkpoint('output');
  return after.ok ? { ok: true, value: undefined } : after;
}
