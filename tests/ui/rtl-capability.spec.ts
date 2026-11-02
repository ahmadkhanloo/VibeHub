import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

async function exposeApp(page: Parameters<typeof mockNative>[0], id: string, product?: string) {
  await page.addInitScript(({ appId, runtimeProduct }) => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any = {}) => {
      if (command === 'detect_apps') {
        const found = await original(command, args);
        return [...found.filter((app: any) => app.id !== appId), { id: appId, installed: true, path: `C:/Fixtures/${appId}.exe`, via: 'fixture' }];
      }
      if (command === 'rtl_components') {
        const found = await original(command, args);
        return [...found.filter((component: any) => component.id !== appId), { id: appId, available: true, configured: true, ...(runtimeProduct ? { product: runtimeProduct } : {}) }];
      }
      return original(command, args);
    };
  }, { appId: id, runtimeProduct: product });
}

test('OpenCode controls follow the available adapter while its verification badge remains unknown', async ({ page }) => {
  await mockNative(page);
  await exposeApp(page, 'opencode');
  await page.goto('/app/opencode');
  await expect(page.getByRole('button', { name: 'Run RTL OpenCode', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run RTL OpenCode', exact: true })).toBeEnabled();
  await expect(page.getByText('Unknown', { exact: true }).first()).toBeVisible();
});

test('ordinary ChatGPT cannot inherit Codex RTL from the shared app ID', async ({ page }) => {
  await mockNative(page);
  await exposeApp(page, 'chatgpt', 'chatgpt');
  await page.goto('/app/chatgpt');
  await expect(page.getByRole('heading', { name: 'ChatGPT / Codex' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /RTL.*ChatGPT/i })).toHaveCount(0);
});

test('Codex RTL visibility requires the explicit runtime product variant', async ({ page }) => {
  await mockNative(page);
  await exposeApp(page, 'chatgpt', 'codex');
  await page.goto('/app/chatgpt');
  await expect(page.getByRole('button', { name: 'Run RTL ChatGPT / Codex', exact: true })).toBeVisible();
  await expect(page.getByText('Unsupported', { exact: true }).first()).toBeVisible();
});
