import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockNative } from './mock';

async function accountsFixture(page: Page, language = 'en', ready = true) {
  await mockNative(page, 'antigravity', language);
  await page.addInitScript(({ ready }) => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    const state = host.__mock;
    state.accounts = {
      accounts: [
        { id: 'alpha', name: 'Personal', email: 'personal@example.invalid', plan: 'plus', checkedAt: 1793059200, error: null, windows: [{ bucket: 'codex', name: 'primary', remaining: 5, minutes: 300, resetsAt: 1793077200 }] },
        { id: 'beta', name: 'Work', email: 'work@example.invalid', plan: null, checkedAt: null, error: null, windows: [] },
      ], activeId: 'alpha', pendingId: null, notice: null, settings: { enabled: false, threshold: 1 },
      lastSwitch: 0, cliReady: ready, supportedVersion: '0.148.0', desktopRunning: true, desktopVerified: false, loginPending: false,
    };
    host.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any = {}) => {
      if (cmd === 'plugin:opener|open_url') { state.calls.push({ cmd, args }); return; }
      if (cmd !== 'codex_accounts') return original(cmd, args);
      state.calls.push({ cmd, args });
      const data = state.accounts, payload = args.payload;
      const account = data.accounts.find((a: any) => a.id === payload.id);
      switch (args.action) {
        case 'login': data.loginPending = true; break;
        case 'cancel': data.loginPending = false; break;
        case 'rename': account.name = payload.name; break;
        case 'delete': data.accounts = data.accounts.filter((a: any) => a.id !== payload.id); break;
        case 'settings': data.settings = { enabled: payload.enabled, threshold: payload.threshold }; break;
        case 'refresh':
          if (state.refreshError) throw Error('accounts:timeout synthetic-secret');
          account.checkedAt = 1793059200;
          account.windows = [{ bucket: 'codex', name: 'primary', remaining: 75, minutes: 300, resetsAt: 1793077200 }]; break;
        case 'switch':
          if (payload.confirmRestart || !data.desktopRunning) { data.activeId = payload.id; data.pendingId = null; data.notice = 'switched'; }
          else { data.pendingId = payload.id; data.notice = 'restartRequired'; }
          break;
        case 'dismiss': data.pendingId = null; data.notice = null; break;
      }
      return structuredClone(data);
    };
  }, { ready });
}

test('apps include standalone Antigravity and never request the general IDE inventory', async ({ page }) => {
  await accountsFixture(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Antigravity', exact: true })).toBeVisible();
  await expect(page.getByText('Visual Studio Code', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Antigravity IDE', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__mock.calls.some((c: any) => c.cmd === 'detect_editors'))).toBe(false);
});

test('failed app discovery offers retry without an IDE fallback', async ({ page }) => {
  await mockNative(page, 'failed');
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__mock.calls.some((c: any) => c.cmd === 'detect_editors'))).toBe(false);
});

test('account switching waits for explicit restart confirmation; cancel sends no confirmation', async ({ page }) => {
  await accountsFixture(page); await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Codex accounts', exact: true })).toBeVisible();
  await expect(page.getByText('Quota information is unknown. Refresh to check.')).toBeVisible();
  const work = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Work', exact: true }) }).last();
  await work.getByRole('button', { name: 'Switch account', exact: true }).click();
  await expect(page.getByText('A Codex account switch is waiting for your restart confirmation.')).toBeVisible();
  await page.getByRole('button', { name: 'Switch and restart', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__mock.calls.some((c: any) => c.cmd === 'codex_accounts' && c.args.payload.confirmRestart))).toBe(false);
  await page.getByRole('button', { name: 'Switch and restart', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(work.getByText('Active locally', { exact: true })).toBeVisible();
});

test('login cancellation, naming, quota failures and automation settings are actionable', async ({ page }) => {
  await accountsFixture(page); await page.goto('/accounts');
  await page.getByRole('button', { name: 'Add an account', exact:true }).click();
  await page.getByRole('button', { name: 'Sign in with ChatGPT', exact: true }).click();
  await expect(page.getByText(/Finish sign-in in the official browser/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel sign-in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel sign-in', exact: true })).toHaveCount(0);
  const work = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Work', exact: true }) }).last();
  await work.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Research');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Research', exact: true })).toBeVisible();
  await page.locator('summary').filter({hasText:/^Automatic switching$/}).click();
  await page.getByRole('switch', { name: 'Enable automatic account switching' }).check();
  await expect(page.getByRole('switch', { name: 'Enable automatic account switching' })).toBeChecked();
  await page.evaluate(() => { (window as any).__mock.refreshError = true; });
  await page.getByRole('button', { name: 'Refresh quota', exact: true }).first().click();
  await expect(page.getByText('Codex did not respond in time.', { exact: true })).toBeVisible();
  await expect(page.getByText('synthetic-secret', { exact: false })).toHaveCount(0);
});

test('missing CLI keeps saved-account viewing and setup guidance available', async ({ page }) => {
  await accountsFixture(page, 'en', false); await page.goto('/accounts');
  await expect(page.getByRole('link', { name: 'CLI setup guide' })).toHaveAttribute('href', '/guides/chatgpt');
  await page.getByRole('button', { name: 'Add an account', exact:true }).click();
  await expect(page.getByRole('button', { name: 'Sign in with ChatGPT', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Personal', exact: true })).toBeVisible();
});

test('accounts default to one percent, import JSON through native picker and scope app support', async ({ page }) => {
  await accountsFixture(page); await page.goto('/accounts');
  await page.locator('summary').filter({hasText:/^Automatic switching$/}).click();
  await expect(page.getByRole('spinbutton')).toHaveValue('1');
  await page.getByRole('button', { name: 'Add an account', exact:true }).click();
  await page.getByRole('button', { name: 'Import account JSON', exact: true }).click();
  const request = await page.evaluate(() => (window as any).__mock.calls.find((c: any) => c.cmd === 'codex_accounts' && c.args.action === 'importJson'));
  expect(request.args.payload).not.toHaveProperty('tokens');
  expect(request.args.payload).not.toHaveProperty('path');
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'App', exact: true }).selectOption('qoder');
  await expect(page.getByText('Local fixture', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import account JSON', exact: true })).toHaveCount(0);
  await expect(page.getByRole('switch')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'App', exact: true }).selectOption('chatgpt');
  await page.getByRole('button', { name: 'Add an account', exact:true }).click();
  await expect(page.getByRole('button', { name: 'Import account JSON', exact: true })).toBeVisible();
});

test('tutorials search skills, disclose compatibility and link to original sources', async ({ page }) => {
  await accountsFixture(page); await page.goto('/guides/extensions');
  await page.getByRole('searchbox', { name: 'Search guides' }).fill('pdf');
  await expect(page.getByRole('heading', { name: 'pdf', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'docx', exact: true })).toHaveCount(0);
  await page.locator('summary').filter({hasText:/^pdf$/}).click();
  await page.getByText('Read installation guide', { exact: true }).click();
  await expect(page.getByText(/skill-installer to install pdf/)).toBeVisible();
  await page.getByRole('button', { name: 'Original source', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__mock.calls.some((c: any) => c.cmd === 'plugin:opener|open_url' && c.args.url.includes('anthropics/skills/tree/main/skills/pdf')))).toBe(true);
  await page.getByRole('searchbox', { name: 'Search guides' }).fill('nothing-matches-this');
  await expect(page.getByRole('heading', { name: 'No matching guides' })).toBeVisible();
});

for (const language of ['en', 'fa']) test(`account page keyboard and accessibility (${language})`, async ({ page }) => {
  await accountsFixture(page, language); await page.goto('/accounts');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(language === 'fa' ? 'حساب‌های Codex' : 'Codex accounts');
  await page.getByRole('button', { name: language === 'fa' ? 'افزودن حساب' : 'Add an account', exact:true }).click();
  await page.getByRole('dialog').getByRole('textbox').focus(); await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: language === 'fa' ? 'ورود با ChatGPT' : 'Sign in with ChatGPT', exact: true })).toBeFocused();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  if (language === 'fa') await page.screenshot({ path: 'output/playwright/accounts-fa.png', fullPage: true });
});
