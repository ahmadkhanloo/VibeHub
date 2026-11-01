import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('installed versions stay on app cards while update checks report status only', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any = {}) => {
      if (command === 'detect_apps') return [
        { id: 'opencode', installed: true, version: '1.0.0', via: 'fixture' },
        { id: 'freebuff', installed: true, via: 'fixture' },
        { id: 'qoder', installed: true, via: 'fixture' },
      ];
      if (command === 'latest_tool_version') {
        if (args.appId === 'freebuff') throw new Error('offline');
        if (args.installedVersion !== '1.0.0') throw new Error('missing installed version');
        return { version: '1.1.0', comparison: 'newer', source: 'npm: opencode-ai', checkedAt: '2026-10-30T12:00:00Z' };
      }
      return original(command, args);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('app-tile-opencode').locator('.vh-app-version')).toHaveText('1.0.0');
  await page.getByText('App versions and updates').click();
  const opencode = page.locator('li').filter({ hasText: 'OpenCode' });
  const freebuff = page.locator('li').filter({ hasText: 'Freebuff' });
  await opencode.getByRole('button', { name: 'Check latest' }).click();
  await expect(opencode).toContainText('Newer version available');
  await expect(opencode).not.toContainText('1.1.0');
  await expect(opencode).not.toContainText('npm: opencode-ai');
  await freebuff.getByRole('button', { name: 'Check latest' }).click();
  await expect(freebuff).toContainText('Check failed');
  await expect(page.locator('li').filter({ hasText: 'Qoder' })).toContainText('Automatic version source unavailable');
});
