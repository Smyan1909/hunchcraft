import { describe, expect, it } from 'vitest';
import {
  checkConsent,
  checkScope,
  completionTimes,
  parseScope,
  reconstructConsentSnapshot,
  reconstructFinalizationReceipt,
  repoBindingBytes,
} from '../../src/core/consent.js';
import { FakeClock, fixture, session } from '../helpers/consultation-fakes.js';
describe('scope and consent', () => {
  it('fixture disclosure requires explicit synthetic evidence consent', () => {
    const s = session(new FakeClock());
    expect(checkScope(fixture().brief, s.scope).ok).toBe(true);
    expect(checkScope(fixture().brief, { ...s.scope, allowSyntheticEvidence: false }).ok).toBe(
      false,
    );
  });
  it.each(['src-old', 'SRC', '.git', 'src/.ENV-key', '../src', 'C:/repo', 'src//file'])(
    'denies roots %s',
    (root) => {
      const s = session(new FakeClock());
      expect(checkScope(fixture().brief, { ...s.scope, excerptRoots: [root] }).ok).toBe(false);
      if (!['src-old', 'SRC'].includes(root))
        expect(parseScope(JSON.stringify({ ...s.scope, excerptRoots: [root] })).ok).toBe(false);
    },
  );
  it('required categories and duplicate fields/roots are rejected', () => {
    const s = session(new FakeClock());
    expect(parseScope(JSON.stringify({ ...s.scope, allowedContent: ['proposal'] })).ok).toBe(false);
    expect(parseScope(JSON.stringify({ ...s.scope, excerptRoots: ['src', 'src'] })).ok).toBe(false);
    expect(
      parseScope(
        JSON.stringify({ ...s.scope, allowedContent: [...s.scope.allowedContent, 'proposal'] }),
      ).ok,
    ).toBe(false);
  });
  it('checks identity, generation, cwd, revoke and exact expiry', () => {
    const clock = new FakeClock();
    const s = session(clock);
    const expected = {
      sessionId: s.sessionId,
      scopeId: s.scope.scopeId,
      repo: { ...s.repo, cwdWithinRoot: true },
      expectedGeneration: 0,
    };
    expect(checkConsent(s, expected, clock.wall).ok).toBe(true);
    expect(checkConsent({ ...s, revoked: true }, expected, clock.wall)).toMatchObject({
      ok: false,
      error: { code: 'consent_revoked' },
    });
    expect(checkConsent(s, expected, s.expiresAtMs)).toMatchObject({
      ok: false,
      error: { code: 'consent_expired' },
    });
    expect(checkConsent(s, { ...expected, expectedGeneration: 1 }, clock.wall)).toMatchObject({
      ok: false,
      error: { code: 'scope_mismatch' },
    });
    expect(
      checkConsent(s, { ...expected, repo: { ...expected.repo, cwdWithinRoot: false } }, clock.wall)
        .ok,
    ).toBe(false);
    expect(checkConsent(s, expected, s.createdAtMs - 1001)).toMatchObject({
      ok: false,
      error: { code: 'clock_inconsistent' },
    });
  });
  it.each([
    { salt: 'c'.repeat(33) },
    { generation: -0 },
    { attemptsUsed: 11 },
    { maxCalls: 0 },
    { activeInvocationId: 'not-uuid' },
  ])('rejects invalid persisted snapshot %j', (patch) => {
    expect(reconstructConsentSnapshot({ ...session(new FakeClock()), ...patch }).ok).toBe(false);
  });
  it('bounds root identity decimals to 32 before copying and never invokes getters', () => {
    const s = session(new FakeClock());
    expect(
      reconstructConsentSnapshot({
        ...s,
        repo: {
          ...s.repo,
          rootFileIdentity: { ...s.repo.rootFileIdentity, inode: '1'.repeat(33) },
        },
      }).ok,
    ).toBe(false);
    expect(
      reconstructConsentSnapshot({
        ...s,
        repo: { ...s.repo, rootFileIdentity: { ...s.repo.rootFileIdentity, inode: '01' } },
      }).ok,
    ).toBe(false);
    let calls = 0;
    expect(
      reconstructConsentSnapshot({
        ...s,
        get salt() {
          calls++;
          return 'private';
        },
      }).ok,
    ).toBe(false);
    expect(calls).toBe(0);
  });
  it('selects canonical capped timestamps and exact repo binding order', () => {
    const clock = new FakeClock();
    const s = session(clock);
    const near = s.expiresAtMs - 1000;
    expect(completionTimes(s, near)).toEqual({
      ok: true,
      value: {
        status: 'requires-current-brief-check',
        completedAt: new Date(near).toISOString(),
        expiresAt: new Date(s.expiresAtMs).toISOString(),
      },
    });
    expect(new TextDecoder().decode(repoBindingBytes(s))).toBe(
      JSON.stringify({
        rootPath: s.repo.rootPath,
        rootFileIdentity: s.repo.rootFileIdentity,
        salt: s.salt,
      }),
    );
    expect(
      reconstructFinalizationReceipt({
        sessionId: s.sessionId,
        requestId: 'request',
        invocationId: '12345678-1234-4234-8234-123456789012',
        sourceDigest: 'a'.repeat(64),
        terminal: { state: 'failed', completedAtMs: 1, resultExpiresAtMs: 2 },
        disposition: 'persisted',
      }).ok,
    ).toBe(false);
  });
});
