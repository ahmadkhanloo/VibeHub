import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('workspace distinguishes the next-launch proxy from a manual API reference and flags missing profiles', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    host.__mock.config = { globalProfileId: 'local', requireProxy: false, perApp: { qoder: 'deleted-profile', zcode: 'inherit' } };
    localStorage.setItem('vibehub.settings.v1', JSON.stringify({
      language: 'en', density: 'compact', themeMode: 'light',
      apiConnectionByApp: { qoder: 'deleted-connection', zcode: 'connection-local' },
    }));
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any = {}) => {
      if (command === 'detect_apps') return [
        { id: 'qoder', installed: true, path: 'C:/Fixtures/Qoder.exe', version: '0.4.2', via: 'fixture' },
        { id: 'zcode', installed: true, path: 'C:/Fixtures/ZCode.exe', version: '3.16.3', via: 'fixture' },
      ];
      if (command === 'proxy_config') return structuredClone(host.__mock.config);
      return original(command, args);
    };
  });

  await page.goto('/');

  await expect(page.getByTestId('proxy-summary-qoder')).toHaveAttribute('data-status', 'missing');
  await expect(page.getByTestId('proxy-summary-qoder')).toContainText('The saved proxy profile is unavailable.');
  await expect(page.getByTestId('proxy-summary-qoder')).not.toContainText('Inherit global');
  await expect(page.getByTestId('proxy-summary-zcode')).toContainText('Inherit global · Local route');
  await expect(page.getByTestId('api-reference-qoder')).toContainText('API reference; manual setup');
  await expect(page.getByTestId('api-reference-qoder')).toContainText('The saved API reference is unavailable.');
  await expect(page.getByTestId('api-reference-zcode')).toContainText('Local Ollama');
});

test('handshake is a connection test, and changing a profile during a running app defers it to next launch', async ({ page }) => {
  await mockNative(page, 'running');
  await page.addInitScript(() => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    host.__mock.config = { globalProfileId: 'local', requireProxy: false, perApp: { zcode: 'inherit' } };
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any = {}) => {
      if (command === 'proxy_config') return structuredClone(host.__mock.config);
      if (command === 'proxy_test') {
        host.__mock.calls.push({ cmd: command, args });
        return { level: args.level, ok: true, detail: 'Handshake accepted', testedAt: new Date().toISOString() };
      }
      return original(command, args);
    };
  });

  await page.goto('/app/zcode?tab=connections');
  await page.getByRole('button', { name: /Protocol handshake/ }).click();
  await expect(page.getByText('Connection test succeeded: Handshake accepted', { exact: true })).toBeVisible();
  await expect(page.getByText(/Proxy active/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Profile name', exact: true }).fill('Renamed route');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Connection test succeeded: Handshake accepted', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Saved. This applies on the next launch; the open app remains running.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go to app ZCode', exact: true })).toBeVisible();
});
