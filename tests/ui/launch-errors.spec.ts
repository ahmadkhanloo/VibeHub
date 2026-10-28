import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

for (const language of ['fa','en']) test(`Qoder port conflict is a localized inline design-system error (${language})`, async ({ page }) => {
  await mockNative(page, 'ready', language);
  await page.addInitScript(() => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
      if (cmd === 'detect_apps') return [{ id: 'qoder', installed: true, via: 'fixture' }];
      if (cmd === 'launch_app') { host.__mock.calls.push({cmd,args}); throw Error('VIBEHUB_LAUNCH_PORT_BUSY'); }
      return original(cmd,args);
    };
  });
  await page.goto('/');
  const row = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Qoder', exact: true }) });
  await row.getByRole('button', { name: language === 'fa' ? 'اجرای راست‌چین Qoder' : 'Run with RTL Qoder', exact: true }).click();
  const alert = row.getByRole('alert');
  await expect(alert).toHaveClass(/vh-error/);
  await expect(alert).toContainText(language === 'fa' ? 'اتصال لازم برای اجرای راست‌چین درگیر است.' : 'Another launch is using the connection needed for RTL.');
  await expect(alert).not.toContainText('VIBEHUB_');
  await expect(alert).not.toContainText('9226');
  const alertBox = await alert.boundingBox();
  const titleBox = await row.getByRole('heading', { name: 'Qoder', exact: true }).boundingBox();
  expect(alertBox && titleBox && (alertBox.y >= titleBox.y + titleBox.height)).toBeTruthy();
  await expect(row.locator('a[href="/doctor?tool=qoder&kind=app"]')).toBeVisible();
  await alert.getByRole('button').click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'launch_app').length)).toBe(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (language === 'fa') await page.screenshot({ path: 'output/playwright/qoder-friendly-error.png' });
});
