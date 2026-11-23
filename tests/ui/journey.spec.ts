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

test('first run opens apps and automatically scans without an onboarding wizard', async ({ page }) => {
  await fixture(page, 'error', false); await page.goto('/');
  await expect(page).toHaveURL(/\/$/); await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(() => { (window as any).journeyScenario = 'ready'; });
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ZCode', exact: true })).toBeVisible();
});

test('legacy guides open the current reader and learning search has an empty state', async ({ page }) => {
  await fixture(page, 'ready');
  await page.goto('/guides/qoder');
  await expect(page).toHaveURL(/learning\/qoder$/);
  await expect(page.getByRole('heading', { name: 'Qoder', exact: true })).toBeVisible();
  await expect(page.getByText('Original source', { exact: true })).toBeVisible();
  await page.goto('/learning');
  await page.getByRole('button', { name: 'Search…', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search scope' }).selectOption('learning');
  await page.getByRole('searchbox', { name: 'Search…', exact: true }).fill('unfindable-journey-fixture');
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('No results found');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('legacy diagnostics opens support and reports a prerequisite failure', async ({ page }) => {
  await fixture(page, 'doctor-error');
  await page.goto('/doctor');
  await expect(page).toHaveURL(/settings\?section=support$/);
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The prerequisite check is unavailable');
  const calls = await page.evaluate(() => (window as any).journeyCalls);
  expect(calls.filter((command: string) => command === 'doctor_run')).toHaveLength(1);
});

test('offers survive corrupt read-state storage and never ask for notification permission on entry', async ({ page }) => {
  await fixture(page, 'ready');
  await page.addInitScript(() => { localStorage.setItem('vibehub.readOffers', '{invalid'); });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/learning?view=news');
  await expect(page).toHaveURL(/learning\?view=news/);
  await page.locator('.vh-news-settings summary').click();
  const notifications = page.getByRole('switch', { name: 'System notifications (optional)', exact: true });
  await expect(notifications).toBeVisible();
  await expect(notifications).not.toBeChecked();
  const calls = await page.evaluate(() => (window as unknown as { journeyCalls: string[] }).journeyCalls);
  expect(calls.some((command) => command.includes('notification'))).toBe(false);
  expect(errors).toEqual([]);
});
