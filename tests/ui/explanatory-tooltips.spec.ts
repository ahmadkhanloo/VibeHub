import { test, expect } from '@playwright/test';
import { mockNative } from './mock';
import { readFileSync } from 'node:fs';
test.use({ hasTouch: true });

for (const language of ['fa', 'en']) {
  test(`decision-critical instructions are visible without opening help (${language})`, async ({ page }) => {
    const copy = (namespace: string) => JSON.parse(readFileSync(`apps/desktop/src/i18n/${language}/${namespace}.json`, 'utf8'));
    await mockNative(page, 'ready', language);
    await page.goto('/settings?panel=terminal');
    const terminal = copy('terminal');
    for (const key of ['previewNote', 'applyWhat', 'undoNote', 'verifyHint']) {
      await expect(page.locator('main p').filter({ hasText: terminal[key] })).toBeVisible();
    }
    await page.goto('/settings?section=data');
    const settings = copy('settingsUx');
    for (const key of ['cacheHint', 'resetHint', 'credentialsHint']) {
      await expect(page.locator('main p').filter({ hasText: settings[key] })).toBeVisible();
    }
    await page.screenshot({ path: `output/explanatory-tooltips/data-reviewed-${language}.png`, fullPage: true });
  });
  test(`settings explanations remain accessible on demand (${language})`, async ({ page }) => {
    await mockNative(page, 'ready', language);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/settings?panel=terminal');
    const help = page.locator('main .vh-info-button').first();
    const text = await help.getAttribute('aria-label');
    expect(text!.length).toBeGreaterThan(15);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await help.focus();
    await expect(page.getByRole('tooltip')).toHaveText(text!);
    const rect = await page.getByRole('tooltip').boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(320);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await help.tap({ force: true });
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `output/explanatory-tooltips/terminal-${language}.png`, fullPage: true });
  });
}
