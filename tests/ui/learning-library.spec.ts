import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('the ordered learning path and product reference open the right articles', async ({ page }) => {
  await mockNative(page);
  await page.goto('/learning');
  await expect(page.getByRole('heading', { name: 'Learning path', level: 1 })).toBeVisible();
  const path = page.getByRole('region', { name: 'Learning path', exact: true }).locator('.vh-learning-row');
  await expect(path).toHaveCount(14);
  expect(await path.evaluateAll(rows => rows.map(row => row.getAttribute('data-article')))).toEqual([
    'programming-basics', 'first-project', 'cli-basics', 'desktop-agent-basics',
    'design-basics', 'testing-basics', 'clean-code', 'git-first-commit', 'git-agent-github', 'skill-basics',
    'claude-code-handbook', 'external-model-api', 'config-deploy', 'release-basics',
  ]);
  for (const [name, start, count] of [['Beginner', 1, 4], ['Intermediate', 5, 6], ['Advanced', 11, 4]] as const) {
    const level = page.getByRole('region', { name, exact: true });
    await expect(level.getByRole('list')).toHaveAttribute('start', String(start));
    await expect(level.getByRole('listitem')).toHaveCount(count);
  }
  await path.first().getByRole('link').click();
  await expect(page.getByText('Lesson 1 of 14')).toBeVisible();
  const courseNav = page.getByRole('navigation', { name: 'Learning path' });
  await expect(courseNav.getByRole('link')).toHaveCount(1);
  await courseNav.getByRole('link', { name: /Next lesson/ }).click();
  await expect(page).toHaveURL(/\/learning\/first-project$/);
  await expect(page.getByText('Lesson 2 of 14')).toBeVisible();
  await expect(courseNav.getByRole('link', { name: /Previous lesson/ })).toHaveAttribute('href', '/learning/programming-basics');
  await page.getByRole('link', { name: 'Back to learning' }).click();
  await expect(page.getByRole('link', { name: /Install and manage skills/ })).toBeVisible();
  await path.getByRole('link', { name: /Connect an external model/ }).click();
  await expect(page.getByRole('heading', { name: /Claude Code CLI: use an Anthropic Messages gateway/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /OpenCode: connect a listed provider/ })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: 'News', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'News', level: 1 })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'News', exact: true })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Tool guides', exact: true }).click();
  await expect(nav.getByRole('link', { name: 'Tool guides', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: /Install and manage skills/ })).toHaveCount(0);
  const card = page.getByRole('link', { name: /Spec Kit: from specification/ });
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading')).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { name: /Spec Kit: from specification/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to reference', exact: true })).toBeVisible();
  await expect(page.getByText('Original source', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to reference', exact: true }).click();
  await expect(page.locator('[data-article="skill-creator"]')).toHaveCount(0);
  await page.locator('[data-article="freebuff"] a').click();
  await page.getByRole('link', { name: /Open Freebuff.* in Apps/ }).click();
  await expect(page).toHaveURL(/\/app\/freebuff\?tab=guide$/);
  await page.getByRole('link', { name: 'Read in Reference' }).click();
  await expect(page).toHaveURL(/\/learning\/freebuff\?view=reference$/);
});

test('a feed adds new lessons without displacing the packaged curriculum', async ({ page }) => {
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
  await expect(page.getByText('New tutorials and news have been downloaded.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Learning path', exact: true }).getByTestId('learning-row')).toHaveCount(14);
  await page.getByLabel('Learning categories').selectOption({ label: 'New topic' });
  await expect(page).toHaveURL(/category=new-topic/);
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

for (const language of ['fa', 'en'] as const) {
  test(`all learning screenshots load in ${language}`, async ({ page }) => {
    test.setTimeout(120_000);
    await mockNative(page, 'ready', language);
    await page.goto('/learning');
    const rows = page.getByRole('region', { name: language === 'fa' ? 'مسیر آموزشی' : 'Learning path', exact: true })
      .getByTestId('learning-row');
    await expect(rows).toHaveCount(14);
    const links = await page.getByTestId('learning-row').getByRole('link')
      .evaluateAll(items => items.map(item => item.getAttribute('href')!));
    for (const href of links) {
      await page.goto(href);
      const images = page.locator('.guide figure > button img');
      await expect(images.first(), href).toBeVisible();
      const loaded = await images.evaluateAll(elements => Promise.all(elements.map(async element => {
        const image = element as HTMLImageElement;
        image.loading = 'eager';
        await image.decode();
        return image.naturalWidth > 0 && image.alt.trim().length > 0;
      })));
      expect(loaded, href).not.toContain(false);
    }
  });
}

test('app guides show the Claude Code path and inline official screenshots in Persian', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  await page.goto('/guides/claude-code');
  await expect(page.getByRole('heading', { name: 'Claude Code CLI', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'بازگشت به مرجع', exact: true })).toBeVisible();
  await expect(page.locator('.guide img').first()).toBeVisible();
  await page.locator('.guide img').first().scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.guide img').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('tutorial screenshot zoom restores focus and works offline on a narrow Persian screen', async ({ page, context }) => {
  await mockNative(page, 'ready', 'fa');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learning/claude-code-handbook');
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
  await page.screenshot({ path: 'output/tutorials/claude-handbook-fa-narrow.png', fullPage: true });
});

test('official VS Code screenshots render in English in light and dark mode', async ({ page }) => {
  await mockNative(page);
  await page.goto('/learning/claude-code-handbook');
  // The handbook is a heavy bundled article; wait for its heading before counting figures.
  await expect(page.getByRole('heading', { name: /Claude Code: the complete CLI handbook/i })).toBeVisible();
  await expect(page.locator('.guide')).toBeVisible();
  const images = page.locator('.guide figure > button img');
  // The handbook bundles every Claude Code section, so it carries all official screenshots.
  expect(await images.count()).toBeGreaterThanOrEqual(8);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  for (const mode of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: mode });
    await page.evaluate(mode => document.documentElement.dataset.mode = mode, mode);
    await images.first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/tutorials/claude-handbook-en-${mode}.png`, fullPage: true });
    await page.locator('.guide figure').first().getByRole('button', { name: /^Enlarge:/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close ×', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
});

for (const language of ['fa', 'en']) {
  test(`all Claude feature lessons decode their inline screenshots in ${language}`, async ({ page }) => {
    await mockNative(page, 'ready', language);
    // The nine feature lessons were merged into one CLI handbook.
    await page.goto('/learning/claude-code-handbook');
    await expect(page.locator('.guide')).toBeVisible();
    const images = page.locator('.guide figure > button img');
    await expect(images.first()).toBeVisible();
    expect(await images.count()).toBeGreaterThanOrEqual(8);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
    await images.first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/tutorials/claude-handbook-${language}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
