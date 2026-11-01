import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('legacy per-app account tabs fall back to launch without reading or changing stored accounts', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/qoder?tab=accounts');
  await expect(page).toHaveURL(/\/app\/qoder$/);
  await expect(page.getByRole('tab', { name: /Accounts/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Local fixture', exact: true })).toHaveCount(0);
  await page.goto('/app/zcode?tab=accounts');
  await expect(page).toHaveURL(/\/app\/zcode$/);
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_accounts' && ['list', 'delete', 'switch'].includes(call.args.action)))).toBe(false);
});

test('the app page keeps normal and RTL controls separate without account UI', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/zcode');
  await expect(page.getByRole('button', { name: 'Run ZCode', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run RTL ZCode', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: /account/i })).toHaveCount(0);
});
