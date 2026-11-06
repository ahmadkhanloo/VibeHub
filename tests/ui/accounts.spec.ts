import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('Workspace hides retired products without restoring their RTL action', async ({ page }) => {
  await mockNative(page, 'antigravity');
  await page.goto('/');
  await expect(page.getByTestId('app-tile-antigravity-ide')).toHaveCount(0);
  await expect(page.getByTestId('app-tile-claude-code')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Antigravity', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('app-tile-antigravity')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Run RTL Antigravity', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('app-tile-claude-code').locator('.vh-app-logo img').first()).toBeVisible();
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
