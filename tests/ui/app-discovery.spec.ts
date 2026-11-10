import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('Claude Desktop has its own guide and the retired Antigravity route redirects', async ({page}) => {
  await mockNative(page);
  await page.goto('/app/claude-desktop?tab=connections');
  await page.getByRole('link', {name:'Add and test models in Claude Desktop'}).click();
  await expect(page).toHaveURL(/\/app\/claude-desktop\?tab=guide$/);
  await expect(page.getByRole('heading', {name:'Fix the Cowork reinstall prompt on Windows'})).toBeVisible();
  await page.goto('/app/antigravity');
  await expect(page).toHaveURL(/\/app\/antigravity-ide$/);
  await page.goto('/editor/antigravity');
  await expect(page).toHaveURL(/\/$/);
});

test('Claude CLI and manual paths are available when apps are missing', async ({page}) => {
  await mockNative(page);
  await page.goto('/app/claude-code');
  await expect(page.getByRole('heading', {name:'Claude Code CLI'}).first()).toBeVisible();
  await expect(page.getByRole('button', {name:'Choose app executable'}).first()).toBeVisible();
  await page.getByRole('button', {name:'Choose app executable'}).first().click();
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.cmd === 'app_path').length)).toBe(0);
  await page.evaluate(() => { (window as any).__mock.selectedFolder = 'C:\\Custom folder\\claude.cmd'; });
  await page.getByRole('button', {name:'Choose app executable'}).first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'app_path' && call.args.appId === 'claude-code'))).toBe(true);
  await page.getByRole('tab', {name:'Guide'}).click();
  await expect(page.getByRole('heading', {name:'Radeon without a Claude account'})).toBeVisible();
  await page.goto('/app/mimocode');
  await expect(page.getByRole('button', {name:'Choose app executable'}).first()).toBeVisible();
});
