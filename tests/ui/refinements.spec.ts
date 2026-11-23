import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('global search keeps Ctrl+K and appearance uses the preview gallery and independent system control', async ({ page }) => {
  await mockNative(page); await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Control+k');
  const search = page.getByRole('dialog', { name: 'Search…' });
  await expect(search.getByRole('searchbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
  await expect(page.locator('.vh-theme-preview')).toHaveCount(8);
  await expect(page.getByRole('combobox', {name:'Mode', exact:true})).toHaveCount(0);
  await expect(page.getByRole('combobox', {name:'Theme family', exact:true})).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Terminal', exact: true })).toHaveCount(0);
  await page.locator('button[data-theme="graphite"][data-mode="dark"]').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(page.getByRole('switch', { name: 'Use the system light or dark setting', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Persian', exact: true })).toBeVisible();
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

test('an app without account support redirects to launch without exposing profile deletion', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/opencode?tab=accounts');
  await expect(page).toHaveURL(/\/app\/opencode$/);
  await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_accounts'))).toBe(false);
});

test('an empty account list exposes no destructive control', async ({ page }) => {
  await mockNative(page);
  // Qoder now owns an accounts tab, but nothing captured means nothing deletable.
  await page.goto('/app/qoder?tab=accounts');
  await expect(page.getByRole('tab', { name: /Accounts/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Delete/i })).toHaveCount(0);
});
