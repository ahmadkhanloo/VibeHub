import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('the sidebar links directly to each destination and legacy routes remain usable', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
  for (const [label, route] of [['API notebook','/connections/api'],['Proxy','/connections/proxy'],['News and offers','/offers'],['Terminal & Persian text','/terminal'],['Diagnostics','/doctor'],['Learn','/learning']]) {
    await expect(sidebar.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', route);
  }
  await expect(sidebar.getByRole('link', { name: /More tools/i })).toHaveCount(0);
  for (const [legacy, destination] of [['/tools','/'],['/accounts','/'],['/connections','/connections/api'],['/proxy','/connections/proxy'],['/settings?panel=terminal','/terminal']]) {
    await page.goto(legacy);
    await expect.poll(() => new URL(page.url()).pathname).toBe(destination);
  }
});

test('restored theme family and accent survive reload', async ({ page }) => {
  await mockNative(page);
  await page.goto('/settings');
  await expect(page.locator('.vh-theme-preview')).toHaveCount(8);
  await page.locator('button[data-theme="nord"][data-mode="dark"]').click();
  await page.getByRole('button', { name: 'Emerald', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'emerald');
});

test('optional setup can be reopened and exited without blocking the workspace', async ({ page }) => {
  await mockNative(page);
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'Make VibeHub yours' })).toBeVisible();
  await page.getByRole('button', { name: 'Set up later', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
});

test('terminal changes require confirmation and retain the restore action', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    let applied = false;
    host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
      if (cmd === 'terminal_detect') return { hasOhMyPosh: true, hasNerdFont: true, profilePath: 'C:/Fixture/profile.ps1', themeApplied: applied };
      if (cmd === 'terminal_apply_theme' || cmd === 'terminal_undo') {
        host.__mock.calls.push({ cmd, args }); applied = cmd === 'terminal_apply_theme';
        return { ok: true, detail: 'Fixture terminal change' };
      }
      return original(cmd, args);
    };
  });
  await page.goto('/terminal');
  const apply = page.getByRole('button', { name: 'Apply theme to the PowerShell profile', exact: true });
  await apply.click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__mock.calls.some((c: any) => c.cmd === 'terminal_apply_theme'))).toBe(false);
  await apply.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Restore prompt settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(apply).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => ['terminal_apply_theme', 'terminal_undo'].includes(c.cmd)).map((c: any) => c.cmd))).toEqual(['terminal_apply_theme', 'terminal_undo']);
});
