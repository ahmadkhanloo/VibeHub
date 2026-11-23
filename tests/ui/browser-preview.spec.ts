import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('browser mode never overrides an existing native transport', async ({ page }) => {
  await mockNative(page);
  await page.goto('http://127.0.0.1:1422/');
  await expect(page.getByRole('heading', { name: 'ZCode', exact: true })).toBeVisible();
  await expect(page.locator('#browser-preview-banner')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Qoder', exact: true })).toHaveCount(0);
});

test('browser development exposes separate launch actions and a read-only Codex accounts preview', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:1422/');
  await expect(page.locator('#browser-preview-banner')).toBeVisible();
  const qoder = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Qoder', exact: true }) });
  await expect(qoder).toBeVisible();
  await expect(page.getByRole('heading', { name: '۷ برنامهٔ نصب‌شده', exact: true })).toHaveCount(1);
  const metadata = qoder.locator('.vh-app-meta');
  await expect(metadata).toContainText('پروکسی');
  await expect(metadata).toContainText('راست‌چین');
  await metadata.hover();
  await expect(page.getByRole('tooltip')).toContainText('وضعیت VPN');
  await metadata.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(qoder.getByRole('button', {name: 'اجرا Qoder', exact:true})).toBeVisible();
  await expect(qoder.getByRole('button', {name: 'اجرای RTL Qoder', exact:true})).toBeVisible();
  await expect(page.getByTestId('app-tile-opencode').getByRole('button', { name: 'اجرای RTL OpenCode', exact: true })).toBeEnabled();
  await qoder.getByRole('button', { name: 'اجرای RTL Qoder', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'launch_app' && call.args.req.appId === 'qoder' && call.args.req.rtl))).toBe(true);
  await page.locator('a[href="/settings"]').click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goto('http://127.0.0.1:1422/accounts');
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(page.getByRole('heading', { name: 'حساب‌های واقعی در نسخه دسکتاپ' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_accounts' || (call.cmd === 'codex_accounts' && call.args.action !== 'list')))).toBe(false);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'output/playwright/browser-development.png' });
});
