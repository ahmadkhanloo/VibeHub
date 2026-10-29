import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('startup refresh, concurrent manual requests and failed refresh retain validated content', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    host.__mock.feedCalls = 0;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any) => {
      if (command !== 'feed_sync') return original(command, args);
      host.__mock.feedCalls++;
      if (host.__mock.failFeed) throw Error('Offline fixture');
      await new Promise(resolve => setTimeout(resolve, 100));
      const data = await import('/src/lib/catalog.ts');
      const catalog = structuredClone({ apps: data.apps, providers: data.providers, offers: data.bundledCatalog.offers });
      const guides: Record<string, string> = {};
      for (const app of catalog.apps) for (const lang of ['fa', 'en']) guides[`${app.id}/${lang}`] = data.guideText(app.id, lang)!;
      return { ok: true, updated: true, detail: 'Fixture feed', catalog, guides };
    };
  });
  await page.goto('/settings?section=updates');
  await expect(page.getByRole('heading', {name:'Settings',exact:true})).toBeVisible();
  expect(await page.evaluate(() => (window as any).__mock.feedCalls)).toBe(0);
  await page.evaluate(async () => {
    const { ipc } = await import('/src/services/ipc.ts');
    const url = JSON.parse(localStorage.getItem('vibehub.settings.v1')!).feedBaseUrl;
    await Promise.all([ipc.feedSync(url), ipc.feedSync(url)]);
  });
  expect(await page.evaluate(() => (window as any).__mock.feedCalls)).toBe(1);
  const before = await page.evaluate(() => localStorage.getItem('vibehub.content.v1'));
  await page.evaluate(() => { (window as any).__mock.failFeed = true; });
  await page.locator('summary').filter({hasText:/^Advanced$/}).click();
  await page.getByRole('button', { name: 'Check content updates (catalog/guides/offers)', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('vibehub.content.v1'))).toBe(before);
});
