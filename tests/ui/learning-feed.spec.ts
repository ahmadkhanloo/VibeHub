import { test, expect } from '@playwright/test';
import { mockNative } from './mock';
import { readFile } from 'node:fs/promises';

test('new tutorials arrive from the feed, survive offline reload and reject malformed updates', async ({ page }) => {
  await mockNative(page);
  const bundled = JSON.parse(await readFile('content/learning/extensions.json', 'utf8'));
  await page.addInitScript((template) => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any) => {
      if (command !== 'feed_sync') return original(command, args);
      if (sessionStorage.getItem('offline')) throw Error('Offline fixture');
      const data = await import('/src/lib/catalog.ts');
      const item = { ...template, id: 'fixture-extension', name: 'Fixture Extension', kind: 'extension' };
      if (host.__mock.badLearning) item.source = 'javascript:alert(1)';
      const catalog = structuredClone({ apps: data.apps, providers: data.providers, offers: data.bundledCatalog.offers });
      const guides = Object.fromEntries(catalog.apps.flatMap(app => ['fa', 'en'].map(lang => [`${app.id}/${lang}`, data.guideText(app.id, lang as 'fa' | 'en')!])));
      return { ok: true, updated: true, detail: 'Fixture', catalog, guides,
        ...(host.__mock.oldFeed ? {} : { learning: host.__mock.emptyLearning ? [] : [item] }) };
    };
  }, bundled[0]);
  await page.goto('/guides/extensions');
  await expect(page.getByRole('heading', { name: 'Fixture Extension', exact: true })).toBeVisible();
  const before = await page.evaluate(() => localStorage.getItem('vibehub.content.v1'));
  await page.evaluate(() => { (window as any).__mock.badLearning = true; });
  await page.getByRole('button', { name: 'Update tutorials', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('vibehub.content.v1'))).toBe(before);
  await page.evaluate(() => { (window as any).__mock.badLearning = false; (window as any).__mock.oldFeed = true; });
  await page.getByRole('button', { name: 'Update tutorials', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Content refresh completed' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fixture Extension', exact: true })).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('offline', '1'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Fixture Extension', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Update tutorials', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fixture Extension', exact: true })).toBeVisible();
  await page.evaluate(() => { sessionStorage.removeItem('offline'); (window as any).__mock.emptyLearning = true; });
  await page.getByRole('button', { name: 'Update tutorials', exact: true }).click();
  await expect(page.getByText('No matching guides', { exact: true })).toBeVisible();
  await page.evaluate(async () => { const data = await import('/src/lib/catalog.ts'); data.clearContentCache(); });
  await expect(page.getByRole('heading', { name: 'frontend-design', exact: true })).toBeVisible();
});
