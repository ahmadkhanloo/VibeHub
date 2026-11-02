import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('Apps lists Antigravity IDE as its own installed editor with normal launch only', async ({ page }) => {
  await mockNative(page, 'antigravity');
  await page.goto('/');
  const ide = page.getByTestId('app-tile-antigravity-ide');
  await expect(ide.getByRole('heading', { name: 'Antigravity IDE', exact: true })).toBeVisible();
  await expect(ide.getByRole('button', { name: 'Run Antigravity IDE', exact: true })).toBeVisible();
  await expect(ide.getByRole('button', { name: /RTL|right-to-left/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Antigravity', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'detect_editors'))).toBe(true);
});

test('failed app discovery remains unknown and offers retry', async ({ page }) => {
  await mockNative(page, 'failed');
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: 'Discover tools', exact: true })).toBeVisible();
  expect(await page.locator('.vh-catalog-tile').count()).toBe(0);
});

test('standalone tutorials stay available alongside external documentation', async ({ page }) => {
  await mockNative(page);
  await page.goto('/guides/extensions');
  await expect(page).toHaveURL(/learning\?category=skills$/);
  await expect(page.locator('h1')).toBeVisible();
  await page.goto('/settings?section=data');
  await page.getByRole('button', { name: 'Open documentation', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'plugin:opener|open_url' && call.args.url.includes('/docs/tutorials')))).toBe(true);
});
