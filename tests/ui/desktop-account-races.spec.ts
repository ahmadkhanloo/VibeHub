import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('an app without account support drops the accounts query and never touches the account broker', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/opencode?tab=accounts');
  await expect(page).toHaveURL(/\/app\/opencode$/);
  await expect(page.getByRole('tab', { name: /Accounts/i })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_accounts' || call.cmd === 'codex_accounts'))).toBe(false);
});

test('zcode and qoder expose the accounts tab and only read the account list', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/zcode?tab=accounts');
  await expect(page).toHaveURL(/\/app\/zcode\?tab=accounts$/);
  await expect(page.getByRole('tab', { name: /Accounts/i })).toHaveAttribute('aria-selected', 'true');
  await page.goto('/app/qoder?tab=accounts');
  await expect(page.getByRole('tab', { name: /Accounts/i })).toHaveAttribute('aria-selected', 'true');
  const calls = await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.cmd === 'app_accounts').map((call: any) => call.args.action));
  expect(calls.length).toBeGreaterThan(0);
  // Reading the list is the only account call a freshly opened tab may make.
  expect(calls.every((action: string) => action === 'list')).toBe(true);
});

test('the app page keeps normal and RTL controls separate', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/zcode');
  await expect(page.getByRole('button', { name: 'Run ZCode', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run RTL ZCode', exact: true }).first()).toBeVisible();
});
