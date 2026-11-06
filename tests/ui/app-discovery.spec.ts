import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('retired desktop routes point at their replacements', async ({page}) => {
  await mockNative(page);
  for (const [oldId, nextId] of [['claude-desktop','claude-code'], ['antigravity','antigravity-ide']]) {
    await page.goto('/app/'+oldId);
    await expect(page).toHaveURL(new RegExp('/app/'+nextId));
  }
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
