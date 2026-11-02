import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('Claude Desktop and manual paths are available when apps are missing', async ({page}) => {
  await mockNative(page);
  await page.goto('/app/claude-desktop');
  await expect(page.getByRole('heading', {name:'Claude Desktop'}).first()).toBeVisible();
  await expect(page.getByRole('button', {name:'Choose app executable'}).first()).toBeVisible();
  await page.getByRole('button', {name:'Choose app executable'}).first().click();
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.cmd === 'app_path').length)).toBe(0);
  await page.evaluate(() => { (window as any).__mock.selectedFolder = 'C:\\Custom folder\\Claude.exe'; });
  await page.getByRole('button', {name:'Choose app executable'}).first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_path' && call.args.appId === 'claude-desktop'))).toBe(true);
  await page.getByRole('tab', {name:'Guide'}).click();
  await expect(page.getByText('Install and open Code')).toBeVisible();
  await page.goto('/app/mimocode');
  await expect(page.getByRole('button', {name:'Choose app executable'}).first()).toBeVisible();
});
