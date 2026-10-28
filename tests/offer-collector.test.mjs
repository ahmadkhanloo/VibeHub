import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sources, parseOffer, collectOffers } from '../scripts/collect-offers.mjs';
import { claimWindow, notificationEvents } from '../packages/core/src/offer-events.ts';

const now = new Date('2026-10-27T03:00:00Z');
const daily = 'Claim 100 Credits manually every day at 10:00 Singapore. Valid for 30 days.';
const offer = () => parseOffer(sources[0], daily, now);
test('known campaign parsing is stable and unknown/login pages fail closed', () => {
  const a = offer(), b = parseOffer(sources[0], daily, new Date(+now + 3600000));
  assert.equal(a.revision, b.revision);
  assert.equal(a.benefit.quantity, 100);
  assert.throws(() => parseOffer(sources[0], 'Claim 200 credits'));
  assert.throws(() => parseOffer(sources[3], 'Sign in for 300 million tokens'));
  const deep = parseOffer(sources[2], 'DeepSeek-V4.1-Flash-1017 extended to October 31 at 24:00 in 2026', now);
  assert.equal(deep.endAt, '2026-10-31T16:00:00Z');
});
test('daily windows use source timezone, not machine timezone', () => {
  assert.equal(claimWindow(offer(), new Date('2026-10-27T01:59:00Z')), '2026-10-26');
  assert.equal(claimWindow(offer(), new Date('2026-10-27T02:00:00Z')), '2026-10-27');
});
test('notifications have stable dedup keys and suppress stale, future, expired and quiet offers', () => {
  const quiet = { enabled: false, from: '00:00', to: '23:59' };
  const events = notificationEvents([offer()], now, quiet);
  assert.equal(events[0].kind, 'change');
  assert.equal(events[1].kind, 'claim');
  assert.equal(notificationEvents([offer()], new Date(+now + 60000), quiet)[0].key, events[0].key);
  for (const change of [{ sourceState: 'stale' }, { endAt: '2026-10-26T00:00:00Z' }, { startAt: '2026-10-28T00:00:00Z' }, { checkedAt: '2026-10-20T00:00:00Z' }]) assert.equal(notificationEvents([{ ...offer(), ...change }], now, quiet).length, 0);
  const local = new Date(2026, 9, 27, 23, 30);
  assert.equal(notificationEvents([offer()], local, { enabled: true, from: '22:00', to: '08:00' }).length, 0);
});
test('network and unknown format preserve published cache without renewing verification', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vibehub-offers-'));
  try {
    await mkdir(join(root, 'offers'));
    await writeFile(join(root, 'offers/index.json'), JSON.stringify({ offers: [] }));
    const previous = offer();
    // Simulate an ephemeral CI checkout recovering its previous Pages deployment.
    const fetcher = async url => url.startsWith('https://previous.invalid/') && url.endsWith('/qoder-daily-credits.json') ? new Response(JSON.stringify(previous)) : new Response('changed page', { status: 200 });
    await collectOffers(root, fetcher, new Date(+now + 3600000), 'https://previous.invalid/feed');
    const cached = JSON.parse(await readFile(join(root, 'offers/qoder-daily-credits.json')));
    assert.equal(cached.sourceState, 'stale');
    assert.equal(cached.checkedAt, previous.checkedAt);
    assert.equal(cached.verifiedAt, previous.verifiedAt);
    assert.equal(cached.publishedAt, previous.publishedAt);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'offers/index.json'))).offers, [previous.offerId]);
    await collectOffers(root, async () => { throw Error('offline'); }, new Date(+now + 7200000));
    assert.equal(JSON.parse(await readFile(join(root, 'offers/qoder-daily-credits.json'))).checkedAt, previous.checkedAt);
  } finally { await rm(root, { recursive: true, force: true }); }
});
