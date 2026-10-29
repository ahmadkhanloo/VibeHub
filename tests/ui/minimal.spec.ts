import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockNative } from './mock';

test('compact launch options support keyboard dismissal without changing saved preferences', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  const options = page.getByRole('button', { name: 'Launch mode for ZCode', exact: true });
  await expect(options).toHaveAttribute('aria-expanded', 'false');
  await options.click();
  const mode = page.getByRole('combobox', { name: 'Launch mode for ZCode', exact: true });
  await mode.selectOption('normal');
  await mode.focus();
  await page.keyboard.press('Escape');
  await expect(options).toBeFocused();
  await expect(options).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1')!).launchModeByApp.zcode)).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Run ZCode', exact: true })).toBeEnabled();
});

test('all eight catalog apps render local brand images with external requests blocked', async ({ page }) => {
  await mockNative(page);
  await page.route('https://**/*', route => route.abort());
  await page.goto('/discover');
  const tiles = page.locator('.vh-catalog-tile');
  await expect(tiles).toHaveCount(8);
  await expect.poll(() => tiles.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await tiles.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).src.startsWith('data:image/') || new URL((image as HTMLImageElement).src).origin === location.origin))).toBe(true);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const openSource = page.getByRole('checkbox', { name: 'Open-source only' });
  await openSource.click();
  await expect(openSource).toBeChecked();
  await expect(page.getByRole('button', { name: 'Filters (1)', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Filters (1)', exact: true }).click();
  await expect(page).toHaveURL(/oss=1/);
});

test('settings terminal deep link opens its panel and cancellation preserves data', async ({ page }) => {
  await mockNative(page);
  await page.goto('/settings?panel=terminal');
  await expect(page.getByRole('tab', { name: 'Terminal', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Data and about', exact: true }).click();
  const reset = page.getByRole('button', { name: 'Reset interface preferences', exact: true });
  await reset.click();
  await page.keyboard.press('Escape');
  await expect(reset).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1')!).onboardingDone)).toBe(true);
});

const routes = ['/', '/discover', '/app/zcode', '/app/zcode?tab=connections', '/app/chatgpt?tab=accounts', '/connections/api', '/connections/proxy', '/settings', '/settings?section=updates', '/app/qoder?tab=guide'];
for (const language of ['fa', 'en']) for (const mode of ['light', 'dark']) {
  test(`minimal interface has no overflow or accessibility violations (${language}, ${mode})`, async ({ page }) => {
    test.setTimeout(180000);
    await mockNative(page, 'antigravity', language);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      await page.evaluate(mode => { document.documentElement.dataset.mode = mode; }, mode);
      for (const width of [320, 768, 960, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const overflow = await page.evaluate(() => {
          const main = document.querySelector('main')!;
          return { page: document.documentElement.scrollWidth > innerWidth, main: main.scrollWidth > main.clientWidth + 1 };
        });
        expect(overflow, `${route} at ${width}px`).toEqual({ page: false, main: false });
        if (route === '/') {
          const columns = await page.locator('.vh-app-grid').evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
          expect(columns).toBe(width === 320 ? 1 : width < 900 ? 2 : width < 1280 ? 3 : 4);
        }
      }
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(scan.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })), route).toEqual([]);
      await page.screenshot({ path: `output/minimal-redesign/verified/${language}-${mode}-${route.slice(1).replace(/[^a-z0-9-]/gi, '-') || 'home'}.png`, animations: 'disabled' });
    }
    expect(errors).toEqual([]);
  });
}

// Long terminal/update action labels must also fit when optional settings are open.
test('expanded settings and model editor fit a narrow window', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/settings?panel=terminal');
  await expect(page.locator('h1').first()).toBeVisible();
  for (const details of await page.locator('main details').all()) {
    const summary = details.locator(':scope > summary');
    if (await summary.isVisible() && await details.getAttribute('open') === null) await summary.click();
  }
  expect(await page.locator('main').evaluate(main => main.scrollWidth <= main.clientWidth + 1)).toBe(true);
  await page.goto('/models');
  await page.getByRole('button', { name: 'افزودن اتصال', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});


test('project launch uses the selected app and records only accepted folders', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/zcode');
  await page.evaluate(() => { (window as any).__mock.selectedFolder = 'C:\\Projects\\پروژه با فاصله'; });
  await page.getByRole('button', { name: 'Choose project folder', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1')!).recentProjects.length)).toBe(1);
  const calls = await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.cmd === 'launch_app'));
  expect(calls[0].args.req).toMatchObject({ appId: 'zcode', cwd: 'C:\\Projects\\پروژه با فاصله' });
  await page.getByRole('button', { name: 'Go to app ZCode', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.some((call: any) => call.cmd === 'launch_app' && call.args.req.focus === true))).toBe(true);
});

test('failed project launch shows recovery and does not pollute recent projects', async ({ page }) => {
  await mockNative(page, 'launchFailed');
  await page.goto('/app/zcode');
  await page.evaluate(() => { (window as any).__mock.selectedFolder = 'C:\\Missing'; });
  await page.getByRole('button', { name: 'Choose project folder', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1')!).recentProjects)).toEqual([]);
});

test('contextual API and proxy selections can be undone after reload', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/zcode?tab=connections');
  const api = page.getByRole('combobox', { name: 'API reference (manual setup)', exact: true });
  await api.selectOption('connection-local');
  await page.reload();
  await expect(api).toHaveValue('connection-local');
  await page.getByRole('button', { name: 'Undo last connection selection', exact: true }).click();
  await expect(api).toHaveValue('');
});
