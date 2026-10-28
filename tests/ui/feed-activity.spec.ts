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
  await page.goto('/offers');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vibehub.feed.success.v1'))).not.toBeNull();
  expect(await page.evaluate(() => (window as any).__mock.feedCalls)).toBe(1);
  await page.evaluate(async () => {
    const { ipc } = await import('/src/services/ipc.ts');
    const url = JSON.parse(localStorage.getItem('vibehub.settings.v1')!).feedBaseUrl;
    await Promise.all([ipc.feedSync(url), ipc.feedSync(url)]);
  });
  expect(await page.evaluate(() => (window as any).__mock.feedCalls)).toBe(2);
  const before = await page.evaluate(() => localStorage.getItem('vibehub.content.v1'));
  await page.evaluate(() => { (window as any).__mock.failFeed = true; });
  await page.getByRole('button', { name: 'Check offers feed', exact: true }).click();
  await expect(page.getByText('The latest refresh failed. Saved offers remain available; check their source verification time.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('vibehub.content.v1'))).toBe(before);
});
