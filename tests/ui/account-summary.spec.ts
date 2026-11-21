import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('an expired Codex profile can start and cancel sign-in for that profile', async ({ page }) => {
  await mockNative(page, 'codex-expired-account', 'fa');
  await page.goto('/accounts');
  await expect(page.getByText('برای تازه‌سازی این حساب دوباره وارد شوید.')).toBeVisible();
  const signIn = page.getByRole('button', { name: 'ورود دوباره', exact: true });
  await signIn.click();
  await expect(signIn).toBeDisabled();
  const request = await page.evaluate(() => (window as any).__mock.calls.find(
    ({ cmd, args }: { cmd: string; args: { action?: string } }) => cmd === 'codex_accounts' && args.action === 'login',
  ));
  expect(request.args.payload.id).toBe('account-expired');
  await page.getByRole('button', { name: 'لغو ورود', exact: true }).click();
  await expect(signIn).toBeEnabled();
});

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
  await page.clock.install();
  await mockNative(page, 'antigravity');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  await page.clock.runFor(31_000);
  const accountCalls = await page.evaluate(() => {
    const commands = ['app_accounts', 'codex_accounts', 'claude_accounts', 'app_quota'];
    return (window as any).__mock.calls.filter(({ cmd }: { cmd: string }) => commands.includes(cmd)).map(({ cmd }: { cmd: string }) => cmd);
  });
  expect(accountCalls).toEqual([]);
});

test('the accounts hub opens on the Codex tab by default', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts');
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(page.getByRole('tab', { name: 'ChatGPT / Codex' })).toHaveAttribute('aria-selected', 'true');
});
