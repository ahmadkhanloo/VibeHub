import { test, expect, type Page } from '@playwright/test';
import { mockNative } from './mock';

async function seedFiveAppHome(page: Page, language: 'en' | 'fa', themeMode: 'light' | 'dark') {
  await mockNative(page, 'ready', language);
  await page.addInitScript(({ language, themeMode }: { language: 'en' | 'fa'; themeMode: 'light' | 'dark' }) => {
    const host = window as any;
    host.__mock.language = language;
    host.__mock.themeMode = themeMode;
    const original = host.__TAURI_INTERNALS__.invoke;
    const ids = ['zcode', 'qoder', 'antigravity', 'deepseek-harness', 'mimocode'];
    localStorage.setItem('vibehub.settings.v1', JSON.stringify({
      language: host.__mock.language, density: 'compact', themeMode: host.__mock.themeMode,
    }));
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any = {}) => {
      if (command === 'detect_apps') return ids.map(id => ({
        id, installed: true, path: `C:/Fixtures/${id}.exe`, version: '1.0', via: 'fixture',
      }));
      if (command === 'detect_editors') return [];
      return original(command, args);
    };
  }, { language, themeMode });
}

async function expectFiveRunButtonsVisible(page: Page) {
  for (const id of ['zcode', 'qoder', 'antigravity', 'deepseek-harness', 'mimicode']) {
    const launchButton = page.locator('.vh-app-tile').nth(['zcode', 'qoder', 'antigravity', 'deepseek-harness', 'mimocode'].indexOf(id)).locator('.vh-launch-actions > button').first();
    await expect(launchButton).toBeVisible();
    const box = await launchButton.boundingBox();
    expect(box, `${id} launch control has a layout box`).not.toBeNull();
    expect(box!.y, `${id} launch control begins within the viewport`).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, `${id} launch control ends within the viewport`).toBeLessThanOrEqual(860);
  }
}

test('five compact app launch buttons fit at the 1280 by 860 desktop target', async ({ page }) => {
  await seedFiveAppHome(page, 'en', 'light');
  await page.setViewportSize({ width: 1280, height: 860 });

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const tiles = page.locator('.vh-app-tile');
  await expect(tiles).toHaveCount(5);
  await expectFiveRunButtonsVisible(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const language of ['en', 'fa'] as const) for (const themeMode of ['light', 'dark'] as const) {
  test(`compact home stays within the viewport (${language}, ${themeMode}, including 200% equivalent width)`, async ({ page }) => {
    await seedFiveAppHome(page, language, themeMode);
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.vh-app-tile')).toHaveCount(5);
    await expectFiveRunButtonsVisible(page);
    await page.evaluate(mode => { document.documentElement.dataset.mode = mode; }, themeMode);

    for (const viewport of [{ width: 1280, height: 860 }, { width: 640, height: 430 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.locator('html').evaluate(element => ({
        page: element.scrollWidth > innerWidth,
        main: document.querySelector('main')!.scrollWidth > document.querySelector('main')!.clientWidth + 1,
      }))).toEqual({ page: false, main: false });
    }
  });
}
