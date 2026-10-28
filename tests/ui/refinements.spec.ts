import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('compact search keeps Ctrl+K and theme previews persist only on click', async ({ page }) => {
  await mockNative(page);
  await page.goto('/settings');
  const search = page.locator('.vh-search-form');
  await expect(search).toHaveCSS('height', '36px');
  await expect(search).toHaveCSS('width', '240px');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('searchbox').first()).toBeFocused();
  await expect(search).toHaveCSS('width', '320px');
  const previews = page.locator('button').filter({ has: page.locator('.vh-theme-preview') });
  await expect(previews).toHaveCount(8);
  const before = await page.evaluate(() => localStorage.getItem('vibehub.settings.v1'));
  await previews.last().hover();
  expect(await page.evaluate(() => localStorage.getItem('vibehub.settings.v1'))).toBe(before);
  await previews.last().click();
  await expect(previews.last()).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(previews.last()).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Terminal', exact: true }).click();
  await expect(page).toHaveURL(/section=terminal/);
  await page.goBack();
  await expect(page.getByRole('tab', { name: 'Appearance', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: 'output/account-offer-refinements/themes-en.png', fullPage: true });
});

test('Persian brand and tooltip support focus, Escape and touch click', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  await page.goto('/');
  const help = page.locator('.vh-info-button').first();
  await help.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await help.click();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /باز کردن نوار کناری/ }).first().click();
  await expect(page.getByText('وایب‌هاب', { exact: true }).first()).toBeVisible();
});

test('desktop profile removal requires confirmation and leaves the signed-in profile alone', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts');
  await page.getByRole('combobox', { name: 'App', exact: true }).selectOption('qoder');
  await expect(page.getByText('Local fixture', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('signed-in account');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_accounts' && call.args.action === 'delete'))).toBe(false);
  await expect(page.getByText('Local fixture', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'output/account-offer-refinements/accounts-en.png', fullPage: true });
});
