import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('changing app while account detection is pending never displays the previous app account', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    const waits: (() => void)[] = [];
    host.__qoderReads = 0;
    host.__releaseQoderAccounts = () => waits.splice(0).forEach(resolve => resolve());
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any = {}) => {
      if (command !== 'app_accounts') return original(command, args);
      if (args.appId === 'qoder' && args.action === 'list') { host.__qoderReads++; await new Promise<void>(resolve => waits.push(resolve)); }
      const result = await original(command, args);
      result.accounts[0].name = args.appId === 'qoder' ? 'Qoder account' : 'ZCode account';
      return result;
    };
  });
  await page.goto('/app/qoder?tab=accounts');
  expect(await page.evaluate(() => (window as any).__qoderReads)).toBe(1);
  await page.getByRole('link', { name: 'Apps', exact: true }).click();
  await page.goto('/app/zcode?tab=accounts');
  await expect(page.getByRole('heading', { name: 'ZCode account', exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).__releaseQoderAccounts());
  await expect(page.getByRole('heading', { name: 'Qoder account', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ZCode account', exact: true })).toBeVisible();
});

test('token balances keep their units, including zero, and quota failures are visible', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host=window as any, original=host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke=async(command:string,args:any={}) => {
      const result=await original(command,args);
      if(command==='app_accounts' && args.appId==='zcode') {
        result.accounts[0].usage=[{label:'Monthly tokens',remaining:1234,unit:'tokens'},{label:'Daily tokens',remaining:0,unit:'tokens'}];
        if(host.__quotaFailure) result.accounts[0].quotaError='accounts:balanceUnavailable';
      }
      return result;
    };
  });
  await page.goto('/app/zcode?tab=accounts');
  await expect(page.getByText('1,234 tokens remaining',{exact:true})).toBeVisible();
  await expect(page.getByText('0 tokens remaining',{exact:true})).toBeVisible();
  await expect(page.getByText('Granted entitlements; this is not the remaining token balance.',{exact:true})).toHaveCount(0);
  await page.evaluate(() => {(window as any).__quotaFailure=true;});
  await page.getByRole('button',{name:'Refresh quota',exact:true}).click();
  await expect(page.getByText('The remaining balance could not be verified. Granted quota is shown separately.',{exact:true})).toBeVisible();
});
