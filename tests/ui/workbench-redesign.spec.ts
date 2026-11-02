import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('main sidebar links directly to the tools and learning areas', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
  for (const label of ['Apps', 'API notebook', 'Proxy', 'News and offers', 'Terminal & Persian text', 'Diagnostics', 'Learn']) {
    await expect(sidebar.getByRole('link', { name: label })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'More' })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Accounts and quotas' })).toHaveCount(0);
});

test('collapsed sidebar exposes its expand control on logo hover and keyboard focus', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  const logo = page.getByRole('button', { name: 'Expand sidebar', exact: true });
  const expandIcon = logo.locator('.vh-sidebar-logo-expand');
  await expect(logo).toHaveAttribute('aria-expanded', 'false');
  await logo.hover();
  await expect(expandIcon).toHaveCSS('opacity', '1');
  await expect(logo).toHaveAttribute('aria-expanded', 'false');
  await logo.focus();
  await expect(expandIcon).toHaveCSS('opacity', '1');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Collapse sidebar', exact: true })).toBeVisible();
});

test('API notebook uses compact local provider cards and keeps proxy as a separate destination', async ({ page }) => {
  await mockNative(page);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/connections/api');
  const grid = page.locator('.vh-provider-grid');
  await expect(grid).toBeVisible();
  await expect(grid.locator('[data-testid^="provider-"]')).toHaveCount(12);
  expect(await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(4);
  await expect(page.getByRole('tab', { name: 'Proxy', exact: true })).toHaveCount(0);
  const google = page.getByTestId('provider-google');
  await expect(google.locator('img')).toHaveAttribute('src', /google/);
  await expect.poll(() => google.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await google.getByRole('button', { name: 'Open API key page', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'plugin:opener|open_url' && call.args.url === 'https://aistudio.google.com/apikey'))).toBe(true);
  await page.getByRole('link', { name: 'Proxy', exact: true }).click();
  await expect(page).toHaveURL(/\/connections\/proxy$/);
  await expect(page.getByRole('heading', { name: 'Proxy Center', exact: true })).toBeVisible();
});

test('apps page omits the intro and recent projects, and add-app view only lists uninstalled apps', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await expect(page.getByText('Launch and prepare the tools installed on this computer.')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Projects' })).toHaveCount(0);
  await page.goto('/discover');
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /filters/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ZCode', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Qoder', exact: true })).toBeVisible();
});

test('installed app keeps normal launch available and hides unsupported RTL setup', async ({ page }) => {
  await mockNative(page, 'missing');
  await page.goto('/');
  const zcode = page.locator('[data-testid="app-tile-zcode"]');
  await expect(zcode.getByRole('button', { name: 'Run ZCode' })).toBeVisible();
  await expect(zcode.getByRole('button', { name: 'Set up RTL for ZCode' })).toHaveCount(0);
  await expect(zcode.getByRole('link', { name: 'Prepare ZCode' })).toBeVisible();
});
