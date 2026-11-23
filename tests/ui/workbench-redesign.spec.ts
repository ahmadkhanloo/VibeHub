import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('main sidebar links directly to the tools and learning areas', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
  for (const label of ['Apps', 'Accounts', 'API notebook', 'Proxy', 'Learning path']) {
    await expect(sidebar.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'More' })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Terminal', exact: true })).toHaveCount(0);
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

test('the API notebook keeps compact provider cards in its catalogue view and proxy stays separate', async ({ page }) => {
  await mockNative(page);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/connections/api?view=providers');
  const list = page.locator('.model-workspace-list');
  await expect(list).toBeVisible();
  await expect(list.getByRole('button')).toHaveCount(8);
  await expect(page.getByRole('tab', { name: 'Proxy', exact: true })).toHaveCount(0);
  await page.getByTestId('provider-google').click();
  await page.locator('.model-workspace-detail').getByRole('button', { name: 'Open API key page', exact: true }).click();
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
  await page.goto('/?view=available');
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

test('MiMo and Freebuff are grouped as apps, with Pi installation on its CLI page', async ({ page }) => {
  await mockNative(page);
  await page.goto('/?view=available');
  const apps = page.getByRole('region', { name: 'Apps', exact: true });
  await expect(apps.getByRole('link', { name: /MiMo Code/ })).toBeVisible();
  await expect(apps.getByRole('link', { name: /Freebuff/ }).first()).toBeVisible();
  await page.getByRole('region', { name: 'Terminal tools', exact: true }).getByRole('link', { name: /Pi CLI/ }).click();
  await expect(page.getByText('npm install -g --ignore-scripts @earendil-works/pi-coding-agent')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manual guide', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open official website', exact: true })).toHaveCount(0);
});
