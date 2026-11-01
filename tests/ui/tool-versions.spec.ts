import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('installed versions stay on app cards without the removed update panel', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any = {}) => {
      if (command === 'detect_apps') return [
        { id: 'opencode', installed: true, version: '1.0.0', via: 'fixture' },
        { id: 'qoder', installed: true, via: 'fixture' },
      ];
      return original(command, args);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('app-tile-opencode').locator('.vh-app-version')).toHaveText('1.0.0');
  await expect(page.getByRole('heading', { name: 'App versions and updates', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check latest', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'latest_tool_version'))).toBe(false);
});
