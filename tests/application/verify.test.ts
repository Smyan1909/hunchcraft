import { describe, expect, it } from 'vitest';
import { consult } from '../../src/application/consult.js';
import { verify } from '../../src/application/verify.js';
import { ClassifiedFailure, completedJudgmentEnvelope, failure } from '../../src/core/result.js';
import { flush, setup } from '../helpers/consultation-fakes.js';

async function completed() {
  const s = setup();
  const o = await consult(s.input, s.dependencies);
  if (o.status !== 'ready') throw new Error('not ready');
  return { ...s, outcome: o };
}
describe('read-only applicability', () => {
  it('forged classified hash rejection remains a fixed error without invoking an accessor', async () => {
    const s = await completed();
    let calls = 0;
    const forged = new Error('untrusted exception');
    Object.setPrototypeOf(forged, ClassifiedFailure.prototype);
    Object.defineProperty(forged, 'failure', {
      get: () => {
        calls++;
        return { message: 'private verification data' };
      },
    });
    expect(
      await verify(
        { ...s.input, result: { format: 'internal', value: s.outcome.result } },
        { ...s.dependencies, sha256: () => Promise.reject(forged) },
      ),
    ).toMatchObject({ kind: 'error', error: failure('internal_failure', 'internal') });
    expect(calls).toBe(0);
    expect(s.clock.timers.size).toBe(0);
  });
  it('verifies current internal result, no provider/write calls and no answer redisplay', async () => {
    const s = await completed();
    const before = [s.store.admitCalls, s.store.finalizeCalls, s.provider.calls];
    const o = await verify(
      { ...s.input, result: { format: 'internal', value: s.outcome.result } },
      s.dependencies,
    );
    expect(o).toEqual({
      schemaVersion: 'hunchcraft.v0',
      kind: 'verification',
      status: 'applicable-to-supplied-snapshot',
      requestId: s.input.brief.requestId,
      sessionId: s.input.sessionId,
      sourceIdentity: s.outcome.result.sourceIdentity,
      limitations: [
        'caller-supplied-evidence',
        'host-state-not-observed',
        'not-an-action-authorization',
      ],
    });
    expect([s.store.admitCalls, s.store.finalizeCalls, s.provider.calls]).toEqual(before);
    expect(s.clock.timers.size).toBe(0);
  });
  it('production JSON explicit format parses fake-HTTP claimed provenance, not authentication', async () => {
    const s = await completed();
    const r = {
      ...s.outcome.result,
      provider: {
        ...s.outcome.result.provider,
        metadata: {
          origin: 'provider-http' as const,
          attempts: 1 as const,
          requestId: 'fixture',
          httpStatus: 200,
        },
      },
    };
    const wire = completedJudgmentEnvelope(r);
    if (!wire.ok) throw new Error();
    expect(
      await verify(
        { ...s.input, result: { format: 'completed-json', bytes: JSON.stringify(wire.value) } },
        s.dependencies,
      ),
    ).toMatchObject({ kind: 'verification' });
    expect(
      await verify(
        {
          ...s.input,
          result: { format: 'completed-json', bytes: JSON.stringify(s.outcome.result) },
        },
        s.dependencies,
      ),
    ).toMatchObject({ kind: 'error', error: { code: 'invalid_input' } });
  });
  it.each(['request', 'context', 'digest', 'question', 'session'] as const)(
    'changed %s cannot adopt old judgment',
    async (kind) => {
      const s = await completed();
      const result = s.outcome.result;
      const value =
        kind === 'request'
          ? { ...result, requestId: 'other' }
          : kind === 'context'
            ? { ...result, context: { ...result.context, proposalRevision: 'other' } }
            : kind === 'digest'
              ? { ...result, sourceIdentity: { ...result.sourceIdentity, digest: 'f'.repeat(64) } }
              : kind === 'session'
                ? { ...result, sessionId: 'f'.repeat(32) }
                : {
                    ...result,
                    checks: result.checks.map((c, i) =>
                      i === 0
                        ? {
                            ...c,
                            question: {
                              ...c.question,
                              instructions: {
                                ...c.question.instructions,
                                task: 'Changed question',
                              },
                            },
                          }
                        : c,
                    ),
                  };
      expect(
        await verify({ ...s.input, result: { format: 'internal', value } }, s.dependencies),
      ).toMatchObject({ kind: 'error', error: { code: 'source_mismatch' } });
    },
  );
  it.each(['active', 'failed', 'delivery-unknown', 'missing', 'timestamps'] as const)(
    'requires exact persisted completed pair, not %s',
    async (kind) => {
      const s = await completed();
      const key = s.store.key(s.input.sessionId, s.input.brief.requestId);
      const a = s.store.attempts.get(key);
      if (!a) throw new Error();
      if (kind === 'missing') s.store.attempts.delete(key);
      else if (kind === 'timestamps')
        s.store.attempts.set(key, { ...a, completedAtMs: (a.completedAtMs ?? 0) + 1 });
      else
        s.store.attempts.set(key, {
          ...a,
          state: kind,
          completedAtMs: kind === 'delivery-unknown' ? a.completedAtMs : null,
          resultExpiresAtMs: kind === 'delivery-unknown' ? a.resultExpiresAtMs : null,
        });
      expect(
        await verify(
          { ...s.input, result: { format: 'internal', value: s.outcome.result } },
          s.dependencies,
        ),
      ).toMatchObject({ kind: 'error', error: { code: 'source_mismatch' } });
    },
  );
  it('result exact expiry is stale, revocation is unavailable, malformed store is local failure', async () => {
    const s = await completed();
    s.clock.wall += 60000;
    expect(
      await verify(
        { ...s.input, result: { format: 'internal', value: s.outcome.result } },
        s.dependencies,
      ),
    ).toMatchObject({ kind: 'error', error: { code: 'result_expired', exitCode: 6 } });
    s.store.revoke(s.input.sessionId);
    expect(
      await verify(
        { ...s.input, result: { format: 'internal', value: s.outcome.result } },
        s.dependencies,
      ),
    ).toMatchObject({ kind: 'error', error: { code: 'consent_revoked', exitCode: 3 } });
    const bad = await completed();
    const consent = bad.store.snapshots.get(bad.input.sessionId);
    if (!consent) throw new Error();
    bad.store.snapshots.set(bad.input.sessionId, { ...consent, attemptsUsed: -0 });
    expect(
      await verify(
        { ...bad.input, result: { format: 'internal', value: bad.outcome.result } },
        bad.dependencies,
      ),
    ).toMatchObject({ kind: 'error', error: { code: 'local_io', exitCode: 1 } });
  });
  it('observable wall rollback exceeding one second is stale', async () => {
    const s = await completed();
    s.clock.wall -= 1001;
    expect(
      await verify(
        { ...s.input, result: { format: 'internal', value: s.outcome.result } },
        s.dependencies,
      ),
    ).toMatchObject({ kind: 'error', error: { code: 'clock_inconsistent', exitCode: 6 } });
  });
  it('rechecks consent after hashing and observes deferred cancellation without writes', async () => {
    const s = await completed();
    let count = 0;
    const o = await verify(
      { ...s.input, result: { format: 'internal', value: s.outcome.result } },
      {
        ...s.dependencies,
        sha256: async (bytes) => {
          count++;
          const digest = await s.dependencies.sha256(bytes);
          if (count === 2) s.store.revoke(s.input.sessionId);
          return digest;
        },
      },
    );
    expect(o).toMatchObject({ kind: 'error', error: { code: 'consent_revoked' } });
    expect(s.store.admitCalls).toBe(1);
    expect(s.store.finalizeCalls).toBe(1);
    await flush();
    expect(s.clock.timers.size).toBe(0);
  });
});
