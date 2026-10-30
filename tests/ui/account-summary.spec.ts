import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('workspace shares account and connection reads and keeps account identity through quota/auth errors', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    const now = Math.floor(Date.now() / 1000);
    host.__mock.accountReads = {};
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any = {}) => {
      if (command === 'detect_apps') return [
        { id: 'qoder', installed: true, path: 'C:/Fixtures/Qoder.exe', version: '0.4.2', via: 'fixture' },
        { id: 'zcode', installed: true, path: 'C:/Fixtures/ZCode.exe', version: '3.16.3', via: 'fixture' },
      ];
      if (command === 'provider_connections') {
        host.__mock.calls.push({ command, args });
        await new Promise(resolve => setTimeout(resolve, 30));
        return structuredClone(host.__mock.connections);
      }
      if (command === 'app_accounts' && args.action === 'list') {
        host.__mock.calls.push({ command, args });
        host.__mock.accountReads[args.appId] = (host.__mock.accountReads[args.appId] ?? 0) + 1;
        await new Promise(resolve => setTimeout(resolve, 30));
        const id = 'account-' + (args.appId === 'qoder' ? 'q'.repeat(24) : 'z'.repeat(24));
        return {
          appId: args.appId,
          accounts: [{
            id,
            name: args.appId === 'qoder' ? 'Qoder account' : 'ZCode account',
            email: `${args.appId}@example.invalid`,
            plan: 'Fixture plan',
            usage: [{ label: 'Credits', remaining: 25, unit: 'percent' }],
            checkedAt: now - 600,
            error: args.appId === 'zcode' ? 'accounts:loginRequired' : null,
            errorCode: args.appId === 'zcode' ? 'loginRequired' : null,
            quotaError: args.appId === 'qoder' ? 'accounts:network' : null,
            quotaErrorCode: args.appId === 'qoder' ? 'network' : null,
          }],
          activeId: id,
          notice: null,
          version: args.appId === 'qoder' ? '0.4.2' : '3.16.3',
          supportedVersion: args.appId === 'qoder' ? '0.4.2' : '3.16.3',
          desktopRunning: false,
          liveSwitchVerified: false,
          capabilities: { canImport: true, canLogin: true, canRefresh: true, canSwitch: false },
        };
      }
      return original(command, args);
    };
  });

  await page.goto('/');

  await expect(page.getByTestId('account-summary-name-qoder')).toHaveText('Qoder account');
  await expect(page.getByTestId('account-summary-name-zcode')).toHaveText('ZCode account');
  await expect(page.getByTestId('account-summary-status-qoder')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByTestId('account-summary-quota-qoder')).toHaveAttribute('data-status', 'error');
  await expect(page.getByTestId('account-summary-stale-qoder')).toBeVisible();
  await expect(page.getByTestId('account-summary-status-zcode')).toHaveAttribute('data-status', 'reauthRequired');
  await expect(page.getByText('Sign in again', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__mock.accountReads)).toEqual({ qoder: 1, zcode: 1 });
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.command === 'provider_connections'))).toHaveLength(1);
});

test('unknown account errors stay generic and do not ask for sign-in again', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any = {}) => {
      if (command === 'detect_apps') return [{ id: 'zcode', installed: true, path: 'C:/Fixtures/ZCode.exe', via: 'fixture' }];
      if (command === 'app_accounts' && args.action === 'list') return {
        appId: 'zcode',
        accounts: [{ id: 'account-zzzzzzzzzzzzzzzzzzzzzzzz', name: 'Saved account', email: 'saved@example.invalid', plan: 'Fixture', usage: [], checkedAt: null, error: 'accounts:externalChanged', errorCode: 'externalChanged' }],
        activeId: 'account-zzzzzzzzzzzzzzzzzzzzzzzz', notice: null, version: '3.16.3', supportedVersion: '3.16.3', desktopRunning: false, liveSwitchVerified: false,
        capabilities: { canImport: true, canLogin: true, canRefresh: true, canSwitch: false },
      };
      return original(command, args);
    };
  });

  await page.goto('/');

  await expect(page.getByTestId('account-summary-name-zcode')).toHaveText('Saved account');
  await expect(page.getByTestId('account-summary-status-zcode')).toHaveAttribute('data-status', 'error');
  await expect(page.getByText('Sign in again', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Account information could not be read.', { exact: true })).toBeVisible();
});

test('summary model keeps empty, unsupported, auth, quota, zero, unknown, and stale states distinct', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { accountSummaryFromSnapshot } = await import('/src/features/accounts/account-summary.ts');
    const baseAccount = {
      id: 'a', name: 'Saved account', email: 'a@example.invalid', plan: 'Fixture', checkedAt: 1000,
      error: null, errorCode: null, quotaErrorCode: null,
      usage: [{ label: 'Credits', remaining: 20, unit: 'percent' }],
    };
    const snapshot = (account: any = baseAccount, rootErrorCode: string | null = null) => ({
      appId: 'qoder', accounts: account ? [account] : [], activeId: account?.id ?? null, notice: null,
      errorCode: rootErrorCode, version: '0.4.2', supportedVersion: '0.4.2', desktopRunning: false,
      liveSwitchVerified: false, capabilities: { canImport: true, canLogin: true, canRefresh: true, canSwitch: false },
    });
    return {
      empty: accountSummaryFromSnapshot('qoder', snapshot(null)).status,
      unsupported: accountSummaryFromSnapshot('future-app', snapshot()).status,
      reauth: accountSummaryFromSnapshot('qoder', snapshot({ ...baseAccount, errorCode: 'loginRequired' })).status,
      networkError: accountSummaryFromSnapshot('qoder', snapshot({ ...baseAccount, errorCode: 'network' })).status,
      quotaError: accountSummaryFromSnapshot('qoder', snapshot({ ...baseAccount, quotaErrorCode: 'network' })),
      zeroQuota: accountSummaryFromSnapshot('qoder', snapshot({ ...baseAccount, usage: [{ label: 'Credits', remaining: 0, unit: 'percent' }] })).quotaStatus,
      unknownQuota: accountSummaryFromSnapshot('qoder', snapshot({ ...baseAccount, usage: [{ label: 'Credits', remaining: null, unit: 'percent' }] })).quotaStatus,
      stale: accountSummaryFromSnapshot('qoder', snapshot({ ...baseAccount, checkedAt: 699 }), 1000).stale,
    };
  });

  expect(result.empty).toBe('empty');
  expect(result.unsupported).toBe('unsupported');
  expect(result.reauth).toBe('reauthRequired');
  expect(result.networkError).toBe('error');
  expect(result.quotaError).toMatchObject({ status: 'ready', quotaStatus: 'error', accountName: 'Saved account', showingPrevious: true });
  expect(result.zeroQuota).toBe('ready');
  expect(result.unknownQuota).toBe('unknown');
  expect(result.stale).toBe(true);
});

test('a late account response is followed by the queued read after an account-change event', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    host.__mock.accountListCount = 0;
    host.__mock.releaseFirstAccountRead = null;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any = {}) => {
      if (command === 'detect_apps') return [{ id: 'zcode', installed: true, path: 'C:/Fixtures/ZCode.exe', via: 'fixture' }];
      if (command === 'app_accounts' && args.action === 'list') {
        host.__mock.accountListCount += 1;
        const request = host.__mock.accountListCount;
        if (request === 1) await new Promise<void>(resolve => { host.__mock.releaseFirstAccountRead = resolve; });
        const id = 'account-' + 'n'.repeat(24);
        return {
          appId: 'zcode', accounts: [{ id, name: request === 1 ? 'Previous response' : 'Current account', email: 'fixture@example.invalid', plan: 'Fixture', usage: [], checkedAt: Math.floor(Date.now() / 1000), error: null }],
          activeId: id, notice: null, version: '3.16.3', supportedVersion: '3.16.3', desktopRunning: false,
          liveSwitchVerified: false, capabilities: { canImport: true, canLogin: true, canRefresh: true, canSwitch: false },
        };
      }
      return original(command, args);
    };
  });

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as any).__mock.accountListCount)).toBe(1);
  await expect(page.getByTestId('account-summary-zcode')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('vibehub:account-summary-changed', { detail: { appId: 'zcode' } })));
  await page.evaluate(() => (window as any).__mock.releaseFirstAccountRead());

  await expect(page.getByTestId('account-summary-name-zcode')).toHaveText('Current account');
  expect(await page.evaluate(() => (window as any).__mock.accountListCount)).toBe(2);
});
