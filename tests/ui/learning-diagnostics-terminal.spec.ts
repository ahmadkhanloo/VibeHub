import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('one compact learning destination keeps legacy guide links active and only collapsed icons have tooltips', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: 'Learn', exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search learning guides' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'App guides', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Qoder/ }).first()).toBeVisible();
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

test('Persian host links to the official download and reports detected installations', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: unknown) => {
      if (cmd === 'terminal_detect') return {
        hasOhMyPosh: false, hasNerdFont: false, themeApplied: false,
        hasPersianTerminal: sessionStorage.getItem('persianHostInstalled') === 'true',
      };
      return original(cmd, args);
    };
  });
  await page.goto('/terminal');
  await page.getByRole('button', { name: 'Open latest release download page', exact: true }).click();
  const calls = await page.evaluate(() => (window as any).__mock.calls);
  expect(calls).toContainEqual(expect.objectContaining({
    cmd: 'plugin:opener|open_url',
    args: expect.objectContaining({ url: 'https://github.com/mirbehnam/RtlTerminal/releases/latest' }),
  }));
  expect(calls.some((call: any) => call.cmd === 'terminal_install_persian')).toBe(false);
  await page.evaluate(() => sessionStorage.setItem('persianHostInstalled', 'true'));
  await page.reload();
  await expect(page.getByText('Installed; check Persian rendering', { exact: true }).first()).toBeVisible();
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
    for (const width of [390, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/learning', '/offers', '/doctor', '/terminal']) {
        await page.goto(route);
        await expect(page.locator('main h1')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `output/playwright/consolidated-${route.slice(1)}-${language}-${width}.png`, fullPage: true });
      }
    }
    await page.evaluate(() => {
      const key = 'vibehub.settings.v1';
      const settings = JSON.parse(localStorage.getItem(key) ?? '{}');
      settings.themeMode = 'dark';
      localStorage.setItem(key, JSON.stringify(settings));
    });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/learning', '/offers', '/terminal']) {
        await page.goto(route);
        await expect(page.locator('main h1')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `output/playwright/dark-${route.slice(1)}-${language}-${width}.png`, fullPage: true });
      }
    }
  });
}
