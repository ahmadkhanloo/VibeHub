import type { Offer } from './index';
export function claimWindow(offer: Offer, now: Date): string | null {
  if (!offer.claim?.required || !offer.claim.dailyAt || !offer.claim.timeZone) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: offer.claim.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '0';
  let date = new Date(Date.UTC(+value('year'), +value('month') - 1, +value('day')));
  if (`${value('hour')}:${value('minute')}` < offer.claim.dailyAt) date = new Date(+date - 86400000);
  return date.toISOString().slice(0, 10);
}
export function notificationEvents(offers: Offer[], now: Date, quiet: { enabled: boolean; from: string; to: string }) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const parse = (value: string) => { const [h = 0, m = 0] = value.split(':').map(Number); return h * 60 + m; };
  const start = parse(quiet.from), end = parse(quiet.to);
  if (quiet.enabled && (start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end)) return [];
  const events: { key: string; offer: Offer; kind: 'change' | 'claim' | 'expiry' }[] = [];
  for (const offer of offers) {
    if (offer.status !== 'verified' || offer.sourceState === 'stale' || offer.sourceState === 'unavailable' || (offer.startAt && +new Date(offer.startAt) > +now) || (offer.endAt && +new Date(offer.endAt) <= +now)) continue;
    if (+now - +new Date(offer.checkedAt ?? offer.verifiedAt) > 48 * 3600000) continue;
    const revision = offer.revision ?? JSON.stringify([offer.summary, offer.endAt, offer.benefit]);
    const window = claimWindow(offer, now);
    events.push({ key: `${offer.offerId}:change:${revision}`, offer, kind: 'change' });
    if (window) events.push({ key: `${offer.offerId}:claim:${window}`, offer, kind: 'claim' });
    if (offer.endAt && +new Date(offer.endAt) - +now <= 86400000) events.push({ key: `${offer.offerId}:expiry:${offer.endAt}`, offer, kind: 'expiry' });
  }
  return events;
}
