import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { offerSchema } from '../packages/core/src/schemas.ts';

export const sources = [
  { id: 'qoder-daily-credits', app: 'qoder', url: 'https://docs.qoder.com/events/100credits' },
  { id: 'qoder-qwen-flash', app: 'qoder', url: 'https://docs.qoder.com/events/flashoffer' },
  { id: 'qoder-deepseek-flash', app: 'qoder', url: 'https://docs.qoder.com/events/deepseek-flash-free' },
  { id: 'zcode-public-rewards', app: 'zcode', url: 'https://zcode.z.ai/en/rewards' },
];
export function plainText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
// Deliberately narrow parsers: a changed/unrecognised announcement never becomes a verified offer.
export function parseOffer(source, html, now = new Date()) {
  const text = plainText(html);
  const base = { schemaVersion: 1, offerId: source.id, appId: source.app, sourceUrl: source.url, publishedAt: now.toISOString(), verifiedAt: now.toISOString(), checkedAt: now.toISOString(), sourceState: 'fresh', status: 'verified' };
  let offer;
  if (source.id === 'qoder-daily-credits' && /claim 100 credits/i.test(text) && /30 days/i.test(text) && /manually/i.test(text) && /10:00/.test(text)) {
    offer = { ...base, title: { fa: '۱۰۰ کردیت روزانهٔ Qoder', en: 'Qoder daily 100 Credits' }, summary: { fa: 'برای حساب‌های شخصی؛ هر روز داخل اپ دریافت کنید. هر بسته ۳۰ روز اعتبار دارد.', en: 'Individual accounts can claim once daily in Qoder. Each reward is valid for 30 days.' }, benefit: { quantity: 100, unit: 'credits' }, claim: { required: true, url: source.url, dailyAt: '10:00', timeZone: 'Asia/Singapore', expiresAfterDays: 30 }, eligibility: 'Individual international accounts; excludes Teams and Enterprise.' };
  } else if (source.id === 'qoder-qwen-flash' && /Qwen3\.8-Flash/.test(text) && /extended beyond|remains free after|extended.*September 30/i.test(text) && /end date.*announc|announce.*end date/i.test(text)) {
    offer = { ...base, title: { fa: 'Qwen3.8-Flash رایگان در Qoder', en: 'Qwen3.8-Flash free in Qoder' }, summary: { fa: 'دورهٔ رایگان تمدید شده است؛ پایان آن هنوز اعلام نشده. هزینهٔ سایر مدل‌ها جدا محاسبه می‌شود.', en: 'The free promotion has been extended; an end date has not been announced. Other model calls are billed separately.' }, benefit: { unit: 'free-model', model: 'Qwen3.8-Flash' }, claim: { required: false, url: source.url }, eligibility: 'Individual international accounts; other model calls are excluded.' };
  } else if (source.id === 'qoder-deepseek-flash' && /DeepSeek-V4\.1-Flash-1017/.test(text) && /extended to October 31|extended.*October 31 at 24:00/i.test(text) && /2026/.test(text)) {
    offer = { ...base, title: { fa: 'سهمیهٔ رایگان DeepSeek-Flash در Qoder', en: 'DeepSeek-Flash daily free allowance in Qoder' }, summary: { fa: 'تا پایان ۳۱ اکتبر ۲۰۲۶ به وقت سنگاپور، در محدودهٔ سهمیهٔ روزانه رایگان است؛ پس از اتمام سهمیه هزینه دارد.', en: 'Free within the daily allowance through October 31, 2026, Singapore time. Usage after the allowance is billed.' }, startAt: '2026-10-19T16:00:00Z', endAt: '2026-10-31T16:00:00Z', benefit: { unit: 'free-model', model: 'DeepSeek-V4.1-Flash-1017' }, claim: { required: false, url: source.url }, eligibility: 'Individual international accounts; daily allowances differ by plan.' };
  }
  // ZCode rewards are currently served after login. Do not turn a login page or a historical
  // 300M headline into a public current offer. Add a parser only with an official public fixture.
  if (!offer) throw new Error('Unrecognised official campaign format');
  const revisionFields = { ...offer }; delete revisionFields.publishedAt; delete revisionFields.verifiedAt; delete revisionFields.checkedAt;
  offer.revision = createHash('sha256').update(JSON.stringify(revisionFields)).digest('hex');
  return offerSchema.parse(offer);
}
export async function collectOffers(directory = 'content', fetcher = fetch, now = new Date(), previousFeed = '') {
  const offersDir = resolve(directory, 'offers'); await mkdir(offersDir, { recursive: true });
  const indexPath = resolve(offersDir, 'index.json'); const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const diagnostics = [];
  for (const source of sources) {
    const target = resolve(offersDir, `${source.id}.json`);
    let previous; try { previous = JSON.parse(await readFile(target, 'utf8')); } catch { /* First collection. */ }
    // CI checkouts are ephemeral. Recover the last published item before touching its source.
    if (previousFeed) {
      try {
        const response = await fetcher(`${previousFeed.replace(/\/$/, '')}/offers/${source.id}.json`, { signal: AbortSignal.timeout(10000), redirect: 'error' });
        if (response.ok) {
          const body = await response.text();
          if (body.length > 32768) throw new Error('Previous offer too large');
          const cached = offerSchema.parse(JSON.parse(body));
          if (cached.offerId !== source.id || cached.sourceUrl !== source.url) throw new Error('Previous offer identity mismatch');
          if (!previous || +new Date(cached.checkedAt ?? cached.verifiedAt ?? 0) >= +new Date(previous.checkedAt ?? previous.verifiedAt ?? 0)) previous = cached;
        }
      } catch { /* A first deployment has no previous feed. Never fabricate a verification time. */ }
    }
    try {
      const response = await fetcher(source.url, { signal: AbortSignal.timeout(25000), redirect: 'error', headers: { Accept: 'text/html,text/plain', 'User-Agent': 'VibeHub-offer-check/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader(); if (!reader) throw new Error('Empty source');
      let bytes = 0; const chunks = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Source too large'); } chunks.push(value); }
      const next = parseOffer(source, Buffer.concat(chunks).toString('utf8'), now);
      if (previous) next.publishedAt = previous.publishedAt;
      await writeFile(target, JSON.stringify(next, null, 2) + '\n');
      if (!index.offers.includes(source.id)) index.offers.push(source.id);
      diagnostics.push({ source: source.id, status: 'fresh' });
    } catch {
      if (previous) { previous.sourceState = 'stale'; previous.status = 'reported'; await writeFile(target, JSON.stringify(previous, null, 2) + '\n'); if (!index.offers.includes(source.id)) index.offers.push(source.id); }
      diagnostics.push({ source: source.id, status: 'unavailable-or-unrecognised' });
    }
  }
  index.generatedAt = now.toISOString(); await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
  await mkdir(resolve(directory, 'snapshots'), { recursive: true });
  await writeFile(resolve(directory, 'snapshots/offer-sources.json'), JSON.stringify({ checkedAt: now.toISOString(), sources: diagnostics }, null, 2) + '\n');
  return diagnostics;
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) console.log(await collectOffers(process.argv[2], fetch, new Date(), process.env.PREVIOUS_FEED_URL));
