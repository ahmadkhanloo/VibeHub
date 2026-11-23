import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('Codex quota windows and account actions use the selected account', async ({ page }) => {
  await mockNative(page);
  await page.clock.install({ time: new Date(2026, 10, 23, 12) });
  await page.addInitScript(() => {
    const host = window as any;
    const invoke = host.__TAURI_INTERNALS__.invoke;
    let activeId = 'one';
    let noticeAt: number | null = null;
    let subscriptionDate: string | null = null;
    host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
      if (cmd !== 'codex_accounts') return invoke(cmd, args);
      host.__mock.calls.push({ cmd, args });
      if (args.action === 'switch') {
        activeId = args.payload.id;
        noticeAt = Math.floor(Date.now() / 1000);
      }
      if (args.action === 'subscriptionDate' && args.payload.id === 'two') subscriptionDate = args.payload.date;
      return { cliReady: true, quotaBatchReady: true, activeId, previousId: 'one', notice: noticeAt && 'switched', noticeAt, settings: { enabled: false, threshold: 1 }, accounts: ['one', 'two'].map(id => ({ id, name: id, email: `${id}@example.invalid`, subscriptionDate: id === 'two' ? subscriptionDate : null, quotaErrorCode: id === 'two' ? 'quotaAuthRejected' : null, windows: [
        { bucket: 'codex', name: 'primary', minutes: 300, remaining: 65, resetsAt: null },
        { bucket: 'codex', name: 'secondary', minutes: 10080, remaining: 25, resetsAt: null },
      ] })) };
    };
  });
  await page.goto('/accounts');
  const card = page.getByTestId('account-two');
  await expect(card.getByText('5-hour')).toBeVisible();
  await expect(card.getByText('Weekly')).toBeVisible();
  await expect(card.getByRole('progressbar')).toHaveCount(2);
  await expect(card.getByText('Codex recognized the account, but the quota service rejected the request.', { exact: false })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Sign in again' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Actions for two' }).click();
  await page.getByRole('button', { name: 'Subscription date' }).click();
  await page.getByLabel('End or renewal date').fill('2026-11-28');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(card.getByText('5 days left', { exact: true })).toBeVisible();
  await expect(card.locator('time[datetime="2026-11-28"]')).toBeVisible();
  await expect(page.getByTestId('account-one').getByText('5 days left')).toHaveCount(0);
  await card.getByRole('button', { name: 'Refresh quota' }).click();
  await card.getByRole('button', { name: 'Switch account' }).click();
  await expect(card.getByText('Active in local Codex credentials')).toBeVisible();
  const toast = page.getByRole('status').filter({ hasText: 'The local Codex account was switched.' });
  await expect(toast).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to one' })).toHaveCount(0);
  await page.clock.runFor(6500);
  await expect(toast).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => ['refresh', 'switch'].includes(call.args?.action)).map((call: any) => [call.args.action, call.args.payload.id]))).toEqual([['refresh', 'two'], ['switch', 'two']]);
});
