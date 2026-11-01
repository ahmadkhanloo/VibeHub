import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('one learning destination keeps legacy guides active and only collapsed icons have tooltips', async ({ page }) => {
  await mockNative(page);
  await page.goto('/guides/qoder');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Guides', exact: true })).toHaveCount(0);
  const learn = nav.getByRole('link', { name: 'Learn', exact: true });
  await expect(learn).toHaveClass(/is-active/);
  await learn.hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await learn.hover();
  await expect(page.getByRole('tooltip')).toHaveText('Learn');
  await page.goto('/learning');
  await expect(page.getByRole('heading', { name: 'Common workflow', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'App-specific guides', exact: true })).toBeVisible();
});

test('diagnostic groups are visible before running and settle independently including failures and reruns', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    let attempt = 0;
    host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
      if (cmd === 'doctor_run') {
        attempt++;
        if (attempt === 1) {
          await new Promise(resolve => { host.__finishDoctor = resolve; });
          throw Error('Fixture prerequisite failure');
        }
        return [{ id: 'node', label: { en: 'node', fa: 'node' }, status: 'pass', detail: 'fixture' }];
      }
      return original(cmd, args);
    };
  });
  await page.goto('/doctor');
  const native = page.locator('[data-check-group="native"]');
  const apps = page.locator('[data-check-group="apps"]');
  await expect(native.getByText('Ready', { exact: true })).toBeVisible();
  await expect(apps.getByText('Ready', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await expect(native.getByText('Checking…', { exact: true })).toBeVisible();
  await expect(apps.getByText('Ready', { exact: true })).toHaveCount(0);
  await expect(apps.getByRole('heading', { name: 'Installed apps and paths', exact: true })).toBeVisible();
  await expect(native.getByText('Checking…', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).__finishDoctor());
  await expect(native.getByText('Error: Fixture prerequisite failure', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await expect(native.getByText('Error: Fixture prerequisite failure', { exact: true })).toHaveCount(0);
  await expect(native.getByRole('heading', { name: 'node', exact: true })).toBeVisible();
});

test('Persian shaping host installation requires confirmation, exposes failures and refreshes detection', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    let installed = false, attempt = 0;
    host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
      if (cmd === 'terminal_detect') return { hasOhMyPosh: false, hasNerdFont: false, themeApplied: false, hasPersianTerminal: installed };
      if (cmd === 'terminal_install_persian') {
        host.__mock.calls.push({ cmd });
        if (++attempt === 1) throw Error('Fixture download failed');
        installed = true;
        return { ok: true, detail: 'Installed fixture host' };
      }
      return original(cmd, args);
    };
  });
  await page.goto('/terminal');
  const install = page.getByRole('button', { name: 'Install RtlTerminal for PowerShell', exact: true });
  await install.click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'terminal_install_persian').length)).toBe(0);
  await install.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.locator('summary').click();
  await expect(dialog.getByText('Error: Fixture download failed', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(install).toBeDisabled();
  await expect(page.getByText('سلام، فارسی را پیوسته می‌نویسم.', { exact: true })).toBeVisible();
});

for (const language of ['fa', 'en']) {
  test(`learning and diagnostics stay readable in both sidebar states (${language})`, async ({ page }) => {
    await mockNative(page, 'ready', language);
    await page.addInitScript(() => {
      const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
      host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => cmd === 'terminal_detect'
        ? { hasOhMyPosh: false, hasNerdFont: false, themeApplied: false, hasPersianTerminal: false }
        : original(cmd, args);
    });
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/learning', '/doctor', '/terminal']) {
        await page.goto(route);
        await expect(page.locator('main h1')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `output/playwright/consolidated-${route.slice(1)}-${language}-${width}.png`, fullPage: true });
      }
    }
  });
}
