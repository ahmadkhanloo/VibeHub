import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('one mixed V2Ray preset assigns MiniMax directly from the proxy center', async ({ page }) => {
  await mockNative(page);
  await page.goto('/connections/proxy');
  const global = page.getByLabel('Global profile');
  const defaultBefore = await global.inputValue();
  await page.getByRole('button', { name: 'Add V2Ray' }).click();
  const profile = page.getByTestId('proxy-profile-v2ray');
  await expect(profile).toContainText('HTTP/HTTPS + SOCKS5');
  await expect(profile).toContainText('127.0.0.1:10808');
  await expect(page.getByRole('button', { name: 'Add V2Ray' })).toHaveCount(0);
  const tool = profile.getByRole('checkbox', { name: 'MiniMax Code' });
  await tool.check();
  await expect(tool).toBeChecked();
  await expect(global).toHaveValue(defaultBefore);
  await page.evaluate(() => { history.pushState({}, '', '/app/minimax-code?tab=connections'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByTestId('tool-proxy').locator('select')).toHaveValue('v2ray');
  await page.getByTestId('tool-proxy').locator('select').selectOption('inherit');
  await page.evaluate(() => { history.pushState({}, '', '/connections/proxy'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(tool).not.toBeChecked();
});
