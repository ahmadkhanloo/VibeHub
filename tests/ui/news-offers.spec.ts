import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('news is the default tab and separates publication from source verification', async ({ page }) => {
  await mockNative(page, 'ready', 'en');
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any) => {
      if (command !== 'feed_sync') return original(command, args);
      const data = await import('/src/lib/catalog.ts');
      const catalog = structuredClone(data.bundledCatalog);
      const guides = Object.fromEntries(catalog.apps.flatMap((app: any) => ['fa', 'en'].map(lang => [`${app.id}/${lang}`, data.guideText(app.id, lang)!])));
      return { ok: true, updated: true, detail: 'Fixture', catalog, guides,
        news: { schemaVersion: 1, news: [{ id: 'fixture-news', appId: 'qoder', title: { fa: 'خبر آزمایشی', en: 'Fixture news' }, summary: { fa: 'خلاصهٔ خبر', en: 'News summary' }, body: { fa: 'متن خبر', en: 'News body' }, publishedAt: '2026-11-02', checkedAt: '2026-11-02', sourceUrl: 'https://example.com' }] } };
    };
  });
  await page.goto('/offers');
  await page.getByRole('button', { name: 'Refresh news and offers', exact: true }).click();
  await expect(page.getByRole('button', { name: /^News/ })).toHaveAttribute('aria-pressed', 'true');
  const item = page.getByRole('group').filter({ hasText: 'Fixture news' });
  await expect(item.getByText('News summary', { exact: true }).first()).toBeVisible();
  await expect(item.getByText('Qoder', { exact: true })).toBeVisible();
  await expect(item.getByText('Unread', { exact: true })).toBeVisible();
  await expect(item.getByText('News body', { exact: true })).toBeHidden();
  await item.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(item.getByText('News body', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Offers/ }).click();
  await expect(page.getByRole('button', { name: /^Current/ })).toHaveAttribute('aria-pressed', 'true');
});

test('an offer checked outside the 48-hour window does not get a fresh verification badge', async ({ page }) => {
  await mockNative(page, 'ready', 'en');
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any) => {
      if (command !== 'feed_sync') return original(command, args);
      const data = await import('/src/lib/catalog.ts');
      const catalog = structuredClone(data.bundledCatalog);
      catalog.offers = catalog.offers.filter((offer: any) => offer.offerId === 'qoder-qwen-flash');
      catalog.offers[0].checkedAt = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
      const guides = Object.fromEntries(catalog.apps.flatMap((app: any) => ['fa', 'en'].map(lang => [`${app.id}/${lang}`, data.guideText(app.id, lang)!])));
      return { ok: true, updated: true, detail: 'Fixture', catalog, guides, news: { schemaVersion: 1, news: [] } };
    };
  });
  await page.goto('/offers');
  await page.getByRole('button', { name: 'Refresh news and offers', exact: true }).click();
  await page.getByRole('button', { name: /^Offers/ }).click();
  const offer = page.getByRole('group').filter({ hasText: 'Qwen3.8-Flash free in Qoder' });
  await expect(offer.getByText('Reported / needs verification', { exact: true })).toBeVisible();
  await expect(offer.getByText('Verified', { exact: true })).toHaveCount(0);
});
