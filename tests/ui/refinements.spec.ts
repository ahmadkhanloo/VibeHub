import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('compact search keeps Ctrl+K and appearance restores theme choices with three modes', async ({ page }) => {
  await mockNative(page); await page.goto('/settings');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('searchbox').first()).toBeFocused();
  await expect(page.locator('.vh-theme-preview')).toHaveCount(8);
  const mode = page.getByRole('combobox', {name:'Mode', exact:true});
  await mode.selectOption('dark'); await page.reload();
  await expect(mode).toHaveValue('dark');
  await expect(page.getByRole('tab', { name: 'Terminal', exact: true })).toBeVisible();
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
  const expand = page.getByRole('button', { name: /باز کردن نوار کناری/ }).first();
  if (await expand.count()) await expand.click();
  await expect(page.getByText('وایب‌هاب', { exact: true }).first()).toBeVisible();
});

test('desktop profile removal requires confirmation and leaves the signed-in profile alone', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/qoder?tab=accounts');
  await expect(page.getByRole('heading', { name: 'Local fixture', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('signed-in account');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_accounts' && call.args.action === 'delete'))).toBe(false);
  await expect(page.getByRole('heading', { name: 'Local fixture', exact: true })).toBeVisible();
  await page.screenshot({ path: 'output/account-offer-refinements/accounts-en.png', fullPage: true });
});
