import { BRIEF_SCHEMA_VERSION } from './brief.js';
import type { Brief } from './brief.js';
import { CHECK_SET_ID, ENDPOINT, EXECUTION_POLICY_VERSION, REQUESTED_MODEL } from './checks.js';
import type { CompiledPlan } from './checks.js';

export const IDENTITY_VERSION = 'hunchcraft.identity.v0';

/** Compact canonical text, without BOM/newline. Hashing is an injected boundary,
 * not authentication, evidence retrieval or a claim of current host state.
 * Inputs must come from parseBrief/compileChecks, not arbitrary caller objects.
 */
export function identityRepresentation(input: Brief, plan: CompiledPlan): string {
  return JSON.stringify({
    identityVersion: IDENTITY_VERSION,
    briefSchemaVersion: BRIEF_SCHEMA_VERSION,
    context: input.context,
    state: plan.state,
    checkSetId: CHECK_SET_ID,
    compiledChecks: plan.checks,
    requestedModel: REQUESTED_MODEL,
    endpoint: ENDPOINT,
    executionPolicyVersion: EXECUTION_POLICY_VERSION,
  });
}

/** A new owned byte sequence per call; mutation cannot change retained identity. */
export function identityBytes(input: Brief, plan: CompiledPlan): Uint8Array {
  return new TextEncoder().encode(identityRepresentation(input, plan));
}
