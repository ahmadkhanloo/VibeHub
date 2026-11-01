import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('the workspace does not poll account identity or quota in the background', async ({ page }) => {
  await mockNative(page, 'antigravity');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_accounts' || call.cmd === 'codex_accounts'))).toBe(false);
});

test('the legacy accounts route returns to Apps without invoking account operations', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Accounts and quotas/i })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_accounts' || call.cmd === 'codex_accounts'))).toBe(false);
});
