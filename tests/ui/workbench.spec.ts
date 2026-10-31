import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('more tools restores every destination while keeping the main navigation focused', async ({ page }) => {
  await mockNative(page);
  await page.goto('/tools');
  await expect(page.locator('.vh-tool-card')).toHaveCount(10);
  await expect(page.locator('nav .vh-nav-link')).toHaveCount(3);
  for (const route of ['/accounts', '/offers', '/terminal', '/doctor', '/guides', '/guides/extensions', '/learning', '/learning/code-review', '/onboarding', '/settings?section=appearance']) {
    await page.goto('/tools');
    await page.locator(`.vh-tool-card[href="${route}"]`).click();
    await expect(page.locator('h1').first()).toBeVisible();
    if (route === '/terminal') await expect(page).toHaveURL(/settings\?section=terminal/);
    else await expect(page).toHaveURL(new RegExp(route.replace('?', '\\?') + '$'));
  }
});

test('restored theme family and accent survive reload', async ({ page }) => {
  await mockNative(page);
  await page.goto('/settings');
  await expect(page.locator('.vh-theme-preview')).toHaveCount(8);
  await page.getByRole('combobox', { name: 'Theme family', exact: true }).selectOption('nord');
  await page.getByRole('combobox', { name: 'Accent', exact: true }).selectOption('emerald');
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
  await page.getByRole('button', { name: 'Fully undo VibeHub changes', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(apply).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => ['terminal_apply_theme', 'terminal_undo'].includes(c.cmd)).map((c: any) => c.cmd))).toEqual(['terminal_apply_theme', 'terminal_undo']);
});
