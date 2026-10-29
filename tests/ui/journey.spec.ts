import { test, expect, type Page } from '@playwright/test';

type Scenario = 'ready' | 'error' | 'doctor-error';
async function fixture(page: Page, scenario: Scenario, onboardingDone = true) {
  await page.addInitScript(({ scenario, onboardingDone }) => {
    localStorage.setItem('vibehub.settings.v1', JSON.stringify({ language: 'en', onboardingDone, themeFamily: 'graphite', themeMode: 'light', accent: 'auto', nativeNotifications: false }));
    const host = window as unknown as { __TAURI_INTERNALS__: { invoke: (command: string) => Promise<unknown> }; journeyScenario: string; journeyCalls: string[] };
    host.journeyScenario = scenario;
    host.journeyCalls = [];
    host.__TAURI_INTERNALS__ = { invoke: async (command) => {
      host.journeyCalls.push(command);
      if (host.journeyScenario === 'error' && ['detect_apps', 'detect_editors', 'rtl_components'].includes(command)) throw new Error('Fixture scan unavailable');
      if (command === 'doctor_run' && host.journeyScenario === 'doctor-error') throw new Error('Fixture prerequisites unavailable');
      const reads: Record<string, unknown> = {
        app_version: '0.1.0', detect_apps: [{ id: 'zcode', installed: true, version: '1.0', path: 'C:/Fixture/ZCode.exe', via: 'standard-path' }],
        detect_editors: [], rtl_components: [{ id: 'zcode', available: true }], proxy_list: [],
        proxy_config: { globalProfileId: '', requireProxy: false, perApp: {} }, provider_connections: [], launch_state: { phase: 'idle' }, launch_states: {zcode:{phase:'idle'}}, doctor_run: [],
      };
      if (command in reads) return structuredClone(reads[command]);
      throw new Error(`Unexpected native command in journey fixture: ${command}`);
    } };
  }, { scenario, onboardingDone });
}

test('an unsuccessful onboarding check can be retried and the chosen tool opens its own setup', async ({ page }) => {
  await fixture(page, 'error', false);
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Check this computer', exact: true }).click();
  await expect(page.locator('[data-scan-state="error"]')).toBeVisible();
  await page.evaluate(() => { (window as unknown as { journeyScenario: string }).journeyScenario = 'ready'; });
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await expect(page.locator('[data-scan-state="ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('radio', { name: 'ZCode', exact: true }).check();
  await page.getByRole('button', { name: 'Prepare ZCode', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/zcode$/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1') ?? '{}').onboardingDone)).toBe(true);
});

test('guide search has a real empty state and does not invent a review date', async ({ page }) => {
  await fixture(page, 'ready');
  await page.goto('/guides/qoder');
  await expect(page.getByText('Guide review date has not been recorded.', { exact: false })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search guides' }).fill('unfindable-journey-fixture');
  await expect(page.getByRole('heading', { name: 'No sections match your search.' })).toBeVisible();
  await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search guides' }).fill('');
  await expect(page.getByRole('heading', { name: 'Introduction', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Working with coding assistants/ })).toHaveCount(0);
});

test('a missing preferred guide announces and renders the available language', async ({ page }) => {
  await fixture(page, 'ready');
  await page.route('**/qoder/en.md?*', route => route.fulfill({ contentType: 'application/javascript', body: 'export default "";' }));
  await page.goto('/guides/qoder');
  await page.getByRole('searchbox', { name: 'Search guides' }).fill('RTL');
  await expect(page.getByRole('status')).toContainText('Showing Persian instead.');
  await expect(page.locator('[lang="fa-IR"][dir="rtl"]')).toContainText('تزریق');
});

test('native prerequisite failure does not discard independent diagnostic results', async ({ page }) => {
  await fixture(page, 'doctor-error');
  await page.goto('/doctor');
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  for (const details of await page.locator('main details').all()) { if (!await details.getAttribute('open').then(value => value !== null)) await details.locator('summary').first().click(); }
  await expect(page.getByText('1 of 1 catalog tools found', { exact: true })).toBeVisible();
  await expect(page.getByText('0 connections saved. No model request was sent.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('1 bundled adapters available for installed tools; injection was not tested', { exact: true })).toBeVisible();
});

test('offers survive corrupt read-state storage and never ask for notification permission on entry', async ({ page }) => {
  await fixture(page, 'ready');
  await page.addInitScript(() => { localStorage.setItem('vibehub.readOffers', '{invalid'); });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/offers');
  await expect(page.getByRole('heading', { name: 'Offers & News', exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'System notifications (optional)', exact: true })).not.toBeChecked();
  const calls = await page.evaluate(() => (window as unknown as { journeyCalls: string[] }).journeyCalls);
  expect(calls.some((command) => command.includes('notification'))).toBe(false);
  expect(errors).toEqual([]);
});
