import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('a pending browser sign-in can be cancelled from the reopened account dialog', async ({ page }) => {
  await mockNative(page, 'codex-login-pending');
  await page.goto('/app/chatgpt?tab=accounts');
  await page.getByRole('button', { name: 'Add an account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add an account' });
  const signIn = dialog.getByRole('button', { name: 'Sign in with ChatGPT' });
  await expect(signIn).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel sign-in' }).click();
  await expect(signIn).toBeEnabled();
});

test('the workspace does not poll account identity or quota in the background', async ({ page }) => {
  await mockNative(page, 'antigravity');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_accounts' || call.cmd === 'codex_accounts'))).toBe(false);
});

test('the legacy accounts route opens the Codex accounts tab', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts');
  await expect(page).toHaveURL(/\/app\/chatgpt\?tab=accounts$/);
  await expect(page.getByRole('tab', { name: 'Accounts' })).toHaveAttribute('aria-selected', 'true');
});
