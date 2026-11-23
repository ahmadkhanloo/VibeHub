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

test('batch quota shows the current check and stops at rate-limiting without a persistent progress count', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any;
    const invoke = host.__TAURI_INTERNALS__.invoke;
    const accounts = ['one', 'two', 'three', 'four'].map(id => ({ id, name: id, email: id + '@example.invalid', windows: [] }));
    host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
      if (cmd !== 'codex_accounts') return invoke(cmd, args);
      host.__mock.calls.push({ cmd, args });
      const data = { cliReady: true, quotaBatchReady: true, settings: { enabled: false, threshold: 1 }, accounts };
      if (args.action !== 'refreshQuota') return data;
      if (args.payload.id === 'one') {
        await new Promise(resolve => { host.__finishQuota = resolve; });
        return { ...data, accounts: [{ ...accounts[0], checkedAt: 1795334400, windows: [] }, ...accounts.slice(1)] };
      }
      return { ...data, quotaBatchCode: 'rateLimited' };
    };
  });
  await page.goto('/accounts');
  const refresh = page.getByRole('button', { name: 'Refresh all', exact: true });
  await refresh.click();
  await expect(refresh).toBeDisabled();
  await expect(page.getByTestId('account-one').getByText('Checking quota', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).__finishQuota());
  await expect(page.getByRole('alert')).toContainText('temporarily limited quota checks');
  await expect(page.getByText(/Checked \d+ of \d+ accounts/)).toHaveCount(0);
  await expect(page.getByText('Checking quota', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__mock.calls
    .filter((call: any) => call.cmd === 'codex_accounts' && call.args.action === 'refreshQuota')
    .map((call: any) => call.args.payload.id))).toEqual(['one', 'two']);
  const columns = (await page.locator('.vh-account-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns)).split(' ');
  expect(columns).toHaveLength(4);
  await page.setViewportSize({ width: 960, height: 860 });
  expect((await page.locator('.vh-account-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns)).split(' ')).toHaveLength(3);
  await page.setViewportSize({ width: 390, height: 860 });
  expect((await page.locator('.vh-account-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns)).split(' ')).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Automatic switching settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Automatic switching settings' })).toBeVisible();
});

test('the account heading help opens from its info icon and dismisses with Escape', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts');
  const title = page.locator('.vh-page-title-row');
  await title.getByRole('heading').hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const info = title.getByRole('button', { name: 'Help', exact: true });
  await info.hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await info.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
});
