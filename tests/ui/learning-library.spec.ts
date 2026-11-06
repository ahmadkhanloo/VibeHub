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

test('app guides show the Claude Code path and inline official screenshots in Persian', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  await page.goto('/guides/claude-code');
  await expect(page.getByRole('heading', { name: 'Claude Code CLI', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'بازگشت به آموزش‌ها', exact: true })).toBeVisible();
  await expect(page.locator('.guide img').first()).toBeVisible();
  await page.locator('.guide img').first().scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.guide img').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('tutorial screenshot zoom restores focus and works offline on a narrow Persian screen', async ({ page, context }) => {
  await mockNative(page, 'ready', 'fa');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learning/claude-permissions');
  const figure = page.locator('.guide figure').first();
  const image = figure.locator('button img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(figure.getByRole('button', { name: 'منبع تصویر', exact: true })).toBeVisible();
  const enlarge = figure.getByRole('button', { name: /^بزرگ‌نمایی:/ });
  await context.setOffline(true);
  await enlarge.focus();
  await page.keyboard.press('Enter');
  await expect(figure.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(figure.getByRole('dialog')).not.toBeVisible();
  await expect(enlarge).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.setOffline(false);
  await page.screenshot({ path: 'output/tutorials/claude-permissions-fa-narrow.png', fullPage: true });
});

test('official VS Code screenshots render in English in light and dark mode', async ({ page }) => {
  await mockNative(page);
  await page.goto('/learning/claude-vscode');
  const images = page.locator('.guide figure > button img');
  await expect(images).toHaveCount(2);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  for (const mode of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: mode });
    await page.evaluate(mode => document.documentElement.dataset.mode = mode, mode);
    await images.first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/tutorials/claude-vscode-en-${mode}.png`, fullPage: true });
    await page.locator('.guide figure').first().getByRole('button', { name: /^Enlarge:/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close ×', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
});

for (const language of ['fa', 'en']) {
  test(`all Claude feature lessons decode their inline screenshots in ${language}`, async ({ page }) => {
    await mockNative(page, 'ready', language);
    for (const slug of ['workflow', 'permissions', 'memory', 'skills', 'mcp', 'agents', 'sessions', 'plugins', 'vscode']) {
      await page.goto(`/learning/claude-${slug}`);
      const images = page.locator('.guide figure > button img');
      await expect(images.first()).toBeVisible();
      for (const image of await images.all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      }
      if (slug === 'mcp' || slug === 'agents') {
        await images.first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `output/tutorials/claude-${slug}-${language}.png` });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test('app-specific screenshots decode and distinguish local captures from official sources', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  for (const app of ['qoder', 'zcode', 'deepseek-harness', 'antigravity-ide', 'chatgpt', 'opencode', 'mimocode', 'freebuff', 'freebuff-desktop']) {
    await page.goto(`/learning/${app}`);
    const images = page.locator('.guide figure > button img');
    await expect(images.first()).toBeVisible();
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
    if (app === 'antigravity-ide') {
      await expect(page.getByText('اسکرین‌شات محیط واقعی؛ ثبت:', { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'راهنمای رسمی برنامه', exact: true })).toBeVisible();
    }
    if (app === 'zcode') {
      await images.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'output/tutorials/zcode-fa.png' });
    }
  }
});
