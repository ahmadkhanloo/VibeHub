import { test, expect } from '@playwright/test';
import { mockNative } from './mock';
import { readFile } from 'node:fs/promises';

test('downloaded Git lessons remain readable after a failed refresh and reload', async ({ page }) => {
  const index = JSON.parse(await readFile('content/learning/index.json', 'utf8'));
  const articles = await Promise.all(index.articles.filter((item: any) => item.category === 'git').map(async (item: any) => {
    const { contentPath, ...article } = item;
    return { ...article, body: { fa: await readFile(`${contentPath}/fa.md`, 'utf8'), en: await readFile(`${contentPath}/en.md`, 'utf8') } };
  }));
  await mockNative(page, 'ready', 'fa');
  await page.addInitScript(feed => {
    const host = window as any, invoke = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any) => {
      if (command !== 'feed_sync') return invoke(command, args);
      if (localStorage.getItem('git.offline')) throw new Error('Git feed unavailable');
      return { ok: true, updated: true, detail: 'Git fixture', catalog: { apps: [], providers: [], offers: [] }, guides: {}, learningArticles: feed, news: { schemaVersion: 1, news: [] } };
    };
  }, { schemaVersion: 1, categories: index.categories.filter((item: any) => item.id === 'git'), articles });
  await page.goto('/learning?category=git');
  await page.getByRole('button', { name: 'بروزرسانی محتوا', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('git.offline', '1'));
  await page.reload();
  await page.getByRole('button', { name: 'بروزرسانی محتوا', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Git feed unavailable');
  await page.locator('.vh-learning-row').first().click();
  await expect(page.locator('article')).toContainText('دو نسخهٔ فایل');
});

test('Git lessons retain their category, reset scroll, and open resources externally', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  await page.addInitScript(() => {
    const host = window as any, invoke = host.__TAURI_INTERNALS__.invoke;
    host.__openedUrls = [];
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any) => {
      if (command === 'plugin:opener|open_url') { host.__openedUrls.push(args.url); return; }
      return invoke(command, args);
    };
  });
  await page.goto('/learning');
  await page.getByRole('button', { name: 'گیت و مدیریت تغییرات', exact: true }).click();
  await expect(page.locator('.vh-learning-row')).toHaveCount(3);
  await page.screenshot({ path: 'output/git-learning/category-fa.png' });
  await page.locator('.vh-learning-row').first().click();
  await expect(page).toHaveURL(/git-first-commit\?category=git/);
  await expect(page.locator('pre').first()).toHaveAttribute('dir', 'ltr');
  await page.getByRole('link', { name: /قدم بعدی: درس ۲/ }).click();
  await expect(page).toHaveURL(/git-agent-github\?category=git/);
  await expect.poll(() => page.locator('.vh-main').evaluate(el => el.scrollTop)).toBe(0);
  await page.getByRole('link', { name: /قدم بعدی: درس ۳/ }).click();
  await expect(page).toHaveURL(/git-practice-resources\?category=git/);
  await page.screenshot({ path: 'output/git-learning/resources-fa.png' });
  await page.getByRole('button', { name: 'بازکردن در مرورگر', exact: true }).first().focus();
  await expect(page.getByRole('button', { name: 'بازکردن در مرورگر', exact: true }).first()).toBeFocused();
  await page.getByRole('button', { name: 'بازکردن در مرورگر', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__openedUrls)).toContain('https://learngitbranching.js.org/?locale=fa');
  await page.getByRole('link', { name: 'بازگشت به آموزش‌ها', exact: true }).click();
  await expect(page).toHaveURL(/learning\?category=git/);
  await expect(page.locator('.vh-learning-row')).toHaveCount(3);
});

for (const language of ['fa', 'en']) for (const mode of ['light', 'dark']) for (const width of [390, 768, 1280]) {
  test(`Git reader ${language} ${mode} ${width}`, async ({ page }) => {
    await mockNative(page, 'ready', language);
    await page.addInitScript(mode => {
      const key = 'vibehub.settings.v1';
      const settings = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({ ...settings, themeMode: mode }));
    }, mode);
    await page.setViewportSize({ width, height: 860 });
    await page.goto('/learning/git-first-commit?category=git');
    await expect(page.locator('article')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.vh-main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.locator('pre').first()).toHaveCSS('direction', 'ltr');
    await expect(page.locator('article')).toHaveAttribute('dir', language === 'fa' ? 'rtl' : 'ltr');
    await page.screenshot({ path: `output/git-learning/${language}-${mode}-${width}.png` });
  });
}
