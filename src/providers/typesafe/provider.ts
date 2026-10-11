import { TypeSafeClient } from '@typesafe-ai/sdk';
import type { Fetch, JsonValue, Questions, SystemOneRequest } from '@typesafe-ai/sdk';
import type { BriefState } from '../../core/brief.js';
import type { CompiledPlan } from '../../core/checks.js';
import type { EvaluationOutcome, Failure, Validation } from '../../core/result.js';
import { failure, reconstructFailure, validateProviderResponse } from '../../core/result.js';
import { record } from '../../core/value.js';
import type { Clock } from '../../ports/clock.js';
import type { DecisionProvider, EvaluationControl } from '../../ports/decision-provider.js';
import type { TypeSafeConfiguration } from './configuration.js';
import { validateTypeSafeConfiguration } from './configuration.js';
import { boundedWait, createGuardedFetch } from './transport.js';

export interface TypeSafeProviderDependencies {
  readonly configuration: () => Promise<Validation<TypeSafeConfiguration>>;
  readonly fetch: Fetch;
  readonly clock: Clock;
}

function request(plan: CompiledPlan, state: BriefState): SystemOneRequest {
  // Explicit projection from owned M1a values; no session/context/proof envelope.
  const projected: JsonValue = {
    originalRequest: state.originalRequest,
    clarifications: state.clarifications.map((v) => ({ id: v.id, text: v.text })),
    requirements: state.requirements.map((v) => ({
      id: v.id,
      text: v.text,
      origin:
        v.origin.kind === 'request'
          ? { kind: 'request', quote: v.origin.quote }
          : v.origin.kind === 'clarification'
            ? {
                kind: 'clarification',
                clarificationId: v.origin.clarificationId,
                quote: v.origin.quote,
              }
            : { kind: 'inferred', basis: v.origin.basis },
    })),
    standards: state.standards.map((v) => ({
      id: v.id,
      text: v.text,
      origin:
        v.origin.kind === 'repo'
          ? { kind: 'repo', evidenceId: v.origin.evidenceId, quote: v.origin.quote }
          : { kind: 'user', clarificationId: v.origin.clarificationId, quote: v.origin.quote },
    })),
    components: state.components.map((v) => ({
      id: v.id,
      name: v.name,
      responsibility: v.responsibility,
      mechanism: v.mechanism,
      claimStatus: v.claimStatus,
      requirementRefs: [...v.requirementRefs],
      evidenceRefs: [...v.evidenceRefs],
      assumptionRefs: [...v.assumptionRefs],
    })),
    relationships: state.relationships.map((v) => ({
      id: v.id,
      from: v.from,
      to: v.to,
      contract: v.contract,
      requirementRefs: [...v.requirementRefs],
      evidenceRefs: [...v.evidenceRefs],
      assumptionRefs: [...v.assumptionRefs],
    })),
    assumptions: state.assumptions.map((v) => ({
      id: v.id,
      statement: v.statement,
      componentRefs: [...v.componentRefs],
      evidenceRefs: [...v.evidenceRefs],
    })),
    evidence: state.evidence.map((v) => ({
      id: v.id,
      locator: v.locator,
      startLine: v.startLine,
      content: v.content,
      provenance: v.provenance,
    })),
    localQuestions: state.localQuestions.map((v) => ({
      id: v.id,
      statement: v.statement,
      componentRefs: [...v.componentRefs],
      requirementRefs: [...v.requirementRefs],
      evidenceRefs: [...v.evidenceRefs],
    })),
  };
  const questions: Questions = {};
  for (const check of plan.checks) {
    const q = check.question;
    const instructions = {
      task: q.instructions.task,
      subjectPath: q.instructions.subjectPath,
      contextPaths: [...q.instructions.contextPaths],
    };
    if (q.type === 'noul')
      questions[check.wireId] = {
        type: 'noul',
        instructions,
        criteria: { true: q.criteria.true, false: q.criteria.false },
      };
    else {
      const [first, second, third] = q.criteria;
      if (
        first === undefined ||
        second === undefined ||
        third === undefined ||
        q.criteria.length !== 3
      )
        throw new Error('Invalid compiled criteria.');
      questions[check.wireId] = { type: 'score', instructions, criteria: [first, second, third] };
    }
  }
  return { state: projected, model: 'jev-1.13.0', questions };
}

/** Inert factory. Explicit configuration, clock and transport are required; no fallback. */
export function createTypeSafeProvider(
  dependencies: TypeSafeProviderDependencies,
): DecisionProvider {
  return Object.freeze({
    origin: 'provider-http',
    async evaluate(
      plan: CompiledPlan,
      state: BriefState,
      control: EvaluationControl,
    ): Promise<EvaluationOutcome> {
      const empty = Object.freeze({
        origin: 'provider-http',
        attempts: 0,
        requestId: null,
        httpStatus: null,
      } as const);
      const rejected = (error: Failure): EvaluationOutcome =>
        Object.freeze({ ok: false, error, usage: null, metadata: empty });
      if (
        typeof dependencies.fetch !== 'function' ||
        typeof dependencies.configuration !== 'function' ||
        !dependencies.clock
      )
        return rejected(failure('configuration_conflict', 'configuration'));
      const configured = await boundedWait(
        () => dependencies.configuration(),
        dependencies.clock,
        () => control.remainingMs(),
        [control.signal],
      );
      if (!configured.ok) return rejected(configured.error);
      // Reconstruct even the typed injected configuration, including its closed failure.
      let configuration: TypeSafeConfiguration;
      try {
        const descriptor = Object.getOwnPropertyDescriptor(configured.value, 'ok');
        if (descriptor?.value === false) {
          const denied = record(configured.value, ['ok', 'error']);
          const error = reconstructFailure(denied.error);
          return rejected(
            error.ok && error.value.stage === 'configuration'
              ? error.value
              : failure('configuration_conflict', 'configuration'),
          );
        }
        const accepted = record(configured.value, ['ok', 'value']);
        if (accepted.ok !== true)
          return rejected(failure('configuration_conflict', 'configuration'));
        const c = record(accepted.value, [
          'apiKey',
          'baseURL',
          'defaultModel',
          'logLevel',
          'maxRetries',
          'loggingOverrideIgnored',
        ]);
        const rebuilt = validateTypeSafeConfiguration({
          apiKey: c.apiKey,
          baseURL: c.baseURL,
          defaultModel: c.defaultModel,
          logLevel: c.logLevel,
        });
        if (
          !rebuilt.ok ||
          c.maxRetries !== 0 ||
          c.logLevel !== 'off' ||
          typeof c.loggingOverrideIgnored !== 'boolean'
        )
          return rejected(failure('configuration_conflict', 'configuration'));
        configuration = rebuilt.value;
      } catch {
        return rejected(failure('configuration_conflict', 'configuration'));
      }
      let body: SystemOneRequest;
      try {
        body = request(plan, state);
      } catch {
        return rejected(failure('internal_failure', 'internal'));
      }
      const transport = createGuardedFetch({
        ...dependencies,
        configuration,
        body: JSON.stringify(body),
        control,
      });
      const sdkController = new AbortController();
      const forwardAbort = (): void => {
        sdkController.abort();
      };
      control.signal.addEventListener('abort', forwardAbort, { once: true });
      try {
        const timeout = Math.min(10000, control.remainingMs());
        if (!Number.isFinite(timeout) || timeout <= 0 || control.signal.aborted)
          return rejected(failure('provider_connection', 'provider'));
        const client = new TypeSafeClient({
          apiKey: configuration.apiKey,
          baseURL: configuration.baseURL,
          defaultModel: configuration.defaultModel,
          logLevel: 'off',
          retry: { maxRetries: 0 },
          timeout,
          fetch: transport.fetch,
          defaultHeaders: {},
          dangerouslyAllowBrowser: false,
        });
        const result = await boundedWait(
          () =>
            client
              .systemOne(body, { signal: sdkController.signal, timeout, retry: { maxRetries: 0 } })
              .withResponse(),
          dependencies.clock,
          () => control.remainingMs(),
          [control.signal],
        );
        const snapshot = transport.snapshot();
        if (!result.ok)
          return Object.freeze({
            ok: false,
            error: transport.error() ?? result.error,
            ...snapshot,
          });
        const validated = validateProviderResponse(result.value.data, plan, snapshot.metadata);
        const fresh = await boundedWait(
          () => Promise.resolve(),
          dependencies.clock,
          () => control.remainingMs(),
          [control.signal],
        );
        if (!fresh.ok) return Object.freeze({ ok: false, error: fresh.error, ...snapshot });
        return validated.ok
          ? Object.freeze({ ok: true, value: validated.value })
          : Object.freeze({ ok: false, error: validated.error, ...snapshot });
      } catch {
        return Object.freeze({
          ok: false,
          error: transport.error() ?? failure('configuration_conflict', 'configuration'),
          ...transport.snapshot(),
        });
      } finally {
        sdkController.abort();
        control.signal.removeEventListener('abort', forwardAbort);
        await transport.dispose();
      }
    },
  });
}
