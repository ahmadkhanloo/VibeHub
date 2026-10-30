import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('a newly detected app can set up RTL without launching or closing it', async ({ page }) => {
  await mockNative(page);
  await page.clock.install();
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    host.__installedLater = false;
    host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any = {}) => {
      if (cmd === 'detect_apps') return host.__installedLater ? [{ id: 'qoder', installed: true, path: 'C:/Fixtures/Qoder.exe', via: 'fixture' }] : [];
      if (cmd === 'rtl_setup') return { ok: true, shortcut: 'C:/Fixtures/Qoder RTL.lnk' };
      return original(cmd, args);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('app-tile-qoder')).toHaveCount(0);
  await page.evaluate(() => { (window as any).__installedLater = true; });
  await page.clock.fastForward(5001);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const tile = page.getByTestId('app-tile-qoder');
  await tile.getByRole('button', { name: 'Set up RTL for Qoder', exact: true }).click();
  await page.screenshot({ path: 'output/rtl-setup-confirmation.png', fullPage: true });
  await page.getByRole('dialog').getByRole('button', { name: 'Set up RTL', exact: true }).click();
  await expect(tile.getByRole('button', { name: 'Run with RTL Qoder', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1')!).rtlSetupByApp?.qoder)).toBe(true);
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => ['launch_app', 'stop_rtl'].includes(call.cmd)))).toEqual([]);
});

test('Antigravity exposes experimental RTL setup and keeps failed setup retryable', async ({ page }) => {
  await mockNative(page, 'antigravity');
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any = {}) => {
      if (cmd === 'rtl_setup') throw new Error('Fixture shortcut could not be saved');
      return original(cmd, args);
    };
  });
  await page.goto('/');
  await page.getByTestId('app-tile-antigravity').getByRole('button', { name: 'Set up RTL for Antigravity', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/experimental/i)).toBeVisible();
  await dialog.getByRole('button', { name: 'Set up RTL', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.locator('details summary').click();
  await expect(dialog.getByText('Fixture shortcut could not be saved')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Set up RTL', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1')!).rtlSetupByApp?.antigravity)).not.toBe(true);
});

test('main navigation calls the manual API store a notebook', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'API notebook', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'API notebook', exact: true })).toBeVisible();
});

test('missing bundled RTL offers the full installer without claiming setup succeeded', async ({ page }) => {
  await mockNative(page, 'missing');
  await page.goto('/');
  await page.getByTestId('app-tile-zcode').getByRole('button', { name: 'Set up RTL for ZCode', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/adapter or private runtime is missing/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Set up RTL', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Get the full VibeHub installer', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.cmd === 'plugin:opener|open_url').map((call: any) => call.args.url))).toContain('https://github.com/ahmadkhanloo/VibeHub/releases');
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'rtl_setup'))).toBe(false);
});
