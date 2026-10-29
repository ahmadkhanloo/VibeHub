import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('API test requires confirmation and unauthenticated local models do not claim a key was authenticated', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const original = (window as any).__TAURI_INTERNALS__.invoke;
    (window as any).__TAURI_INTERNALS__.invoke = (cmd: string, args: any) => {
      if (cmd === 'provider_connection_test') {
        (window as any).__mock.calls.push({cmd,args});
        return Promise.resolve({dnsResolved:true,httpResponse:true,authRequired:false,authValidated:false,modelResponded:true,httpStatus:200});
      }
      return original(cmd,args);
    };
  });
  await page.goto('/models');
  await page.getByRole('button',{name:'Test connection',exact:true}).click();
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'provider_connection_test').length)).toBe(0);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'provider_connection_test').length)).toBe(0);
  await page.getByRole('button',{name:'Test connection',exact:true}).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(page.getByText('Key authenticated: Not required for this connection')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'provider_connection_test')))
    .toEqual([{cmd:'provider_connection_test',args:{id:'connection-local'}}]);
});
