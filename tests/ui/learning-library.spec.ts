import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('learning library shows compact article summaries and reads full content on a separate route', async ({ page }) => {
  await mockNative(page);
  await page.goto('/learning');
  await expect(page.getByRole('heading', { name: 'Learn', exact: true })).toBeVisible();
  const card = page.getByRole('link', { name: /Install and manage skills/ });
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading')).toBeVisible();
  await expect(card).not.toContainText('## Install carefully');
  await card.click();
  await expect(page.getByRole('heading', { name: 'Install and manage skills', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to learning', exact: true })).toBeVisible();
  await expect(page.getByText('Original source', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to learning', exact: true }).click();
  await page.getByRole('link', { name: /skill-creator/ }).click();
  await expect(page.getByRole('link', { name: 'Install and manage skills', exact: true }).last()).toBeVisible();
});

test('a new feed lesson and category appear without rebuilding the application', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any) => {
      if (command !== 'feed_sync') return original(command, args);
      if (localStorage.getItem('fixture.feedOffline') === '1') throw new Error('Fixture feed unavailable');
      const catalog = structuredClone({ apps: [], providers: [], offers: [] });
      const guides = {};
      return { ok: true, updated: true, detail: 'Fixture', catalog, guides,
        learningArticles: { schemaVersion: 1, categories: [{ id: 'new-topic', title: { fa: 'موضوع تازه', en: 'New topic' } }],
          articles: [{ id: 'feed-only-lesson', category: 'new-topic', kind: 'guide', order: 1,
            title: { fa: 'آموزش تازه', en: 'New lesson' }, summary: { fa: 'خلاصه', en: 'Summary' }, sourceUrl: 'https://example.com', checkedAt: '2026-11-02', body: { fa: '# متن تازه', en: '# Fresh content' } }] },
        news: { schemaVersion: 1, news: [] } };
    };
  });
  await page.goto('/learning');
  await page.getByRole('button', { name: 'Refresh content', exact: true }).click();
  await page.getByRole('button', { name: 'New topic', exact: true }).click();
  await expect(page.getByRole('link', { name: /New lesson/ })).toBeVisible();
  await page.getByRole('link', { name: /New lesson/ }).click();
  await expect(page.getByText('Fresh content', { exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('fixture.feedOffline', '1'));
  await page.goto('/learning');
  await page.getByRole('button', { name: 'Refresh content', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Fixture feed unavailable');
  const cachedLesson = page.getByRole('link', { name: /New lesson/ });
  await expect(cachedLesson).toBeVisible();
  await cachedLesson.click();
  await expect(page.getByText('Fresh content', { exact: true })).toBeVisible();
});

test('app guides show the Claude Code path and local educational illustrations in Persian', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  await page.goto('/guides/claude-code');
  await expect(page.getByRole('heading', { name: 'Claude Code', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'بازگشت به آموزش‌ها', exact: true })).toBeVisible();
  await expect(page.locator('.guide img').first()).toBeVisible();
  await expect.poll(() => page.locator('.guide img').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
