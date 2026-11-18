import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeQoderUsage, qoderClaimWindow } from '../apps/Qoder/injector.mjs';
import { normalizeMiniMaxQuota } from '../apps/MiniMax/injector.mjs';

test('the Qoder answer becomes counters only', () => {
  const quota = normalizeQoderUsage({
    ok: true,
    data: {
      addOn: { total: 2400, used: 1618, remaining: 782, percent: 67, unit: 'credits' },
      plan: { total: 0, used: 0, remaining: 0, percent: 0, unit: 'credits' },
      campaign: { claimable: true, popup: false },
    },
  });
  assert.equal(quota.status, 'ok');
  assert.equal(quota.used, 1618);
  assert.equal(quota.total, 2400);
  assert.equal(quota.remaining, 782);
  assert.equal(quota.percent, 67);
  assert.equal(quota.unit, 'credits');
  assert.equal(quota.claim.claimed, null);
  assert.equal(quota.claim.available, true);
});

test('a Qoder with no waiting reward offers no claim', () => {
  // The app itself says there is nothing to take today, so the button stays
  // off instead of guessing.
  const quota = normalizeQoderUsage({
    ok: true,
    data: {
      addOn: { total: 2400, used: 1618, remaining: 782, percent: 67, unit: 'credits' },
      plan: null,
      campaign: { claimable: false, popup: false },
    },
  });
  assert.equal(quota.status, 'ok');
  assert.equal(quota.claim.available, false);
});

test('a Qoder that does not report its campaign offers no claim', () => {
  const quota = normalizeQoderUsage({
    ok: true,
    data: { addOn: { total: 2400, used: 1618, remaining: 782, percent: 67, unit: 'credits' }, plan: null },
  });
  assert.equal(quota.claim.available, false);
});

test('the daily add-on credits are the headline, not the empty plan bucket', () => {
  // A live Qoder account: the plan allowance is zero while the daily claims
  // have built up an add-on pool.
  const quota = normalizeQoderUsage({
    ok: true,
    data: {
      addOn: { total: 2400, used: 1618, remaining: 782, percent: 67, unit: 'credits' },
      plan: { total: 0, used: 0, remaining: 0, percent: 0, unit: 'credits' },
    },
  });
  assert.equal(quota.total, 2400);
  assert.equal(quota.remaining, 782);
});

test('the plan allowance is reported next to the daily credits', () => {
  const quota = normalizeQoderUsage({
    ok: true,
    data: {
      addOn: { total: 100, used: 10, remaining: 90, percent: 90, unit: 'credits' },
      plan: { total: 500, used: 200, remaining: 300, percent: 60, unit: 'credits' },
    },
  });
  assert.equal(quota.total, 100);
  assert.equal(quota.plan.total, 500);
  assert.equal(quota.plan.remaining, 300);
});

test('a missing percentage is derived from what is left', () => {
  const quota = normalizeQoderUsage({
    ok: true,
    data: { addOn: { total: 200, used: 150, remaining: 50 }, plan: null },
  });
  assert.equal(quota.percent, 25);
});

test('a signed out Qoder is reported, not crashed on', () => {
  const quota = normalizeQoderUsage({ ok: false, error: 'signedOut' });
  assert.equal(quota.status, 'signedOut');
  assert.equal(quota.remaining, null);
});

test('an app that does not expose its usage is reported as unsupported', () => {
  const quota = normalizeQoderUsage({ ok: false, error: 'unsupported' });
  assert.equal(quota.status, 'unsupported');
});

test('the Qoder claim window closes at 10:00 Singapore time', () => {
  // 2026-11-18T02:00:00Z is 10:00 in Singapore (UTC+8).
  const open = qoderClaimWindow(Date.parse('2026-11-18T02:00:00Z'));
  assert.equal(open.available, true);
  // Seconds, like the rest of VibeHub's timestamps.
  assert.equal(open.resetsAt, Date.parse('2026-11-19T02:00:00Z') / 1000);
  // Half an hour before the boundary the next one is still today's.
  const before = qoderClaimWindow(Date.parse('2026-11-18T01:30:00Z'));
  assert.equal(before.resetsAt, Date.parse('2026-11-18T02:00:00Z') / 1000);
  // After the boundary the next one is tomorrow's.
  const after = qoderClaimWindow(Date.parse('2026-11-18T12:00:00Z'));
  assert.equal(after.resetsAt, Date.parse('2026-11-19T02:00:00Z') / 1000);
});

test('the MiniMax answer becomes counters only', () => {
  const quota = normalizeMiniMaxQuota({
    ok: true,
    data: {
      used: 0,
      total: 120,
      remaining: 120,
      claimed: true,
      points: 5,
      dayNo: 3,
      signin: true,
      image: { used: 2, total: 10, remaining: 8 },
    },
  });
  assert.equal(quota.status, 'ok');
  assert.equal(quota.used, 0);
  assert.equal(quota.total, 120);
  assert.equal(quota.remaining, 120);
  assert.equal(quota.percent, 100);
  assert.equal(quota.unit, 'credits');
  assert.equal(quota.claim.claimed, true);
  assert.equal(quota.claim.available, false);
  assert.equal(quota.claim.points, 5);
  assert.equal(quota.claim.dayNo, 3);
  // The free image pool is reported next to the coding credits.
  assert.equal(quota.plan.total, 10);
  assert.equal(quota.plan.remaining, 8);
  assert.equal(quota.plan.unit, 'images');
});

test('a MiniMax plan pool is counted in credits', () => {
  const quota = normalizeMiniMaxQuota({ ok: true, data: { used: 4, total: 8 } });
  assert.equal(quota.unit, 'credits');
  assert.equal(quota.percent, 50);
});

test('a MiniMax account without coding credits shows its free image pool', () => {
  // A live account: no plan credits, but a free image allowance of ten whose
  // window is over, so the app itself reports nothing left.
  const quota = normalizeMiniMaxQuota({
    ok: true,
    data: {
      used: 0,
      total: 0,
      remaining: 0,
      signin: false,
      image: { used: 0, total: 10, remaining: 0 },
    },
  });
  assert.equal(quota.status, 'ok');
  assert.equal(quota.total, 10);
  assert.equal(quota.remaining, 0);
  assert.equal(quota.unit, 'images');
  // Without the daily check-in there is nothing to claim.
  assert.equal(quota.claim.available, false);
});

test('a MiniMax pool without a remaining count is derived from what is left', () => {
  const quota = normalizeMiniMaxQuota({
    ok: true,
    data: { used: 3, total: 10, signin: false, image: null },
  });
  assert.equal(quota.remaining, 7);
  assert.equal(quota.percent, 70);
});

test('a failed MiniMax check keeps the reason', () => {
  assert.equal(normalizeMiniMaxQuota({ ok: false, error: 'signedOut' }).status, 'signedOut');
  assert.equal(normalizeMiniMaxQuota({ ok: false, error: 'probeFailed' }).status, 'error');
  assert.equal(normalizeMiniMaxQuota({ ok: false, error: 'unsupported' }).status, 'unsupported');
});

test('no answer can carry a token or an account detail out', () => {
  const answers = [
    normalizeQoderUsage({ ok: true, data: { total: 10, accessToken: 'secret', email: 'a@b.invalid' } }),
    normalizeMiniMaxQuota({ ok: true, data: { total: 10, authorization: 'Bearer secret', user: 'a@b.invalid' } }),
  ];
  for (const answer of answers) {
    const text = JSON.stringify(answer).toLowerCase();
    assert.ok(!text.includes('secret'), 'a secret must never reach the answer');
    assert.ok(!text.includes('@b.invalid'), 'an account detail must never reach the answer');
    assert.ok(!text.includes('token'), 'a token field must never reach the answer');
    assert.ok(!text.includes('authorization'), 'an auth header must never reach the answer');
  }
});
