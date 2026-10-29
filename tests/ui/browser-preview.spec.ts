import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('browser mode never overrides an existing native transport', async ({ page }) => {
  await mockNative(page);
  await page.goto('http://127.0.0.1:1422/');
  await expect(page.getByRole('heading', { name: 'ZCode', exact: true })).toBeVisible();
  await expect(page.locator('#browser-preview-banner')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Qoder', exact: true })).toHaveCount(0);
});

test('browser development boots without test injection and clearly simulates RTL', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:1422/');
  await expect(page.locator('#browser-preview-banner')).toBeVisible();
  const qoder = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Qoder', exact: true }) });
  await expect(qoder).toBeVisible();
  await qoder.getByRole('button', {name: 'حالت اجرای Qoder', exact:true}).click();
  await qoder.getByRole('combobox').selectOption('rtl');
  await qoder.getByRole('button', { name: 'اجرای راست‌چین Qoder', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'launch_app' && call.args.req.appId === 'qoder' && call.args.req.rtl))).toBe(true);
  await page.locator('a[href="/settings"]').click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goto('http://127.0.0.1:1422/app/chatgpt?tab=accounts');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'حساب‌های واقعی در نسخه دسکتاپ', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ورود با ChatGPT', exact: true })).toHaveCount(0);
  await expect(page.getByText('حسابی ذخیره نشده است', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'output/playwright/browser-development.png' });
});
