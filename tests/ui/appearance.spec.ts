import { test, expect, type Page } from '@playwright/test';
import { mockNative } from './mock';

/** The quiet-workbench invariants: one command bar, one primary action per tile,
 *  no clipped metadata, a working text-size preference and grouped navigation. */

async function settle(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test('the shell is one command bar with a grouped sidebar', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await settle(page);

  // A single bar of chrome: the old 44px titlebar + 66px topbar stack is gone.
  await expect(page.locator('.vh-window-titlebar')).toHaveCount(0);
  const bar = page.locator('.vh-topbar');
  await expect(bar).toHaveCount(1);
  expect((await bar.boundingBox())!.height).toBeLessThanOrEqual(56);

  // Group captions stay for screen readers only; visually the groups split by
  // one fading hairline per captioned group (workbench.css vh-nav-sep).
  const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(page.locator('.vh-nav .sr-only')).toHaveCount(2);
  await expect(page.locator('.vh-nav-sep')).toHaveCount(2);
  for (const label of ['Apps', 'Helper tools', 'Accounts', 'API notebook', 'Proxy', 'Learning path', 'Tool guides', 'News']) {
    await expect(sidebar.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  // Every rail row stays on one line, so the group rhythm is predictable.
  const wrapped = await page.locator('.vh-nav-label').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length > 1).length);
  expect(wrapped).toBe(0);
});

test('each app tile carries one primary action and unclipped metadata', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/');
  await settle(page);

  const tiles = page.locator('.vh-app-tile');
  expect(await tiles.count()).toBeGreaterThan(0);
  for (const tile of await tiles.all()) {
    await expect(tile.locator('.vh-button-primary')).toHaveCount(1);
    const run = tile.locator('.vh-launch-actions > button').first();
    await expect(run).toBeVisible();
    // A settled install shows no status at all; when a state is shown it is a quiet
    // dot + word, never a filled pill competing with the launch button.
    for (const status of await tile.locator('.vh-app-status').all()) {
      expect(await status.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    }
  }

  for (const width of [1280, 960]) {
    await page.setViewportSize({ width, height: 860 });
    const clipped = await page.locator('.vh-meta-value').evaluateAll(nodes =>
      nodes.filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.textContent),
    );
    expect(clipped, `clipped metadata at ${width}px`).toEqual([]);
  }
});

test('the text-size preference scales the interface and survives a reload', async ({ page }) => {
  await mockNative(page);
  await page.goto('/settings');
  await settle(page);

  const fontSize = () => page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  const medium = await fontSize();

  await page.getByRole('group', { name: 'Text size' }).getByRole('button', { name: 'Large' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'lg');
  expect(await fontSize()).toBeGreaterThan(medium);

  await page.reload();
  await settle(page);
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'lg');
  expect(await fontSize()).toBeGreaterThan(medium);

  await page.getByRole('group', { name: 'Text size' }).getByRole('button', { name: 'Small' }).click();
  expect(await fontSize()).toBeLessThan(medium);
});

test('the day/night scene stays the switch but fits the command bar', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await settle(page);
  const toggle = page.locator('.vh-topbar').getByRole('switch', { name: 'Day and night' });
  await expect(toggle).toBeVisible();
  // The illustrated scene is the switch, at a size that fits the 56px bar.
  await expect(toggle).toHaveClass(/vh-daynight/);
  const box = (await toggle.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(64);
  expect(box.height).toBeLessThanOrEqual(32);
});

test('settings keeps data actions and the version card in one tab', async ({ page }) => {
  await mockNative(page);
  await page.goto('/settings?section=data');
  await settle(page);
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByText(/^VibeHub/).first()).toBeVisible();
  await expect(panel.getByRole('button', { name: /Wipe local cache/i })).toBeVisible();
});
