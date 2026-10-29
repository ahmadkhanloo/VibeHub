import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('focus does not rescan and active states use one batch per 15 seconds', async ({ page }) => {
  await page.clock.install();
  await mockNative(page, 'running');
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'ZCode', exact:true})).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'launch_states').length)).toBe(1);
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const initialBatches = await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'launch_states').length);
  const scans = await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'detect_apps').length);
  await page.evaluate(() => { for (let i=0;i<10;i++) window.dispatchEvent(new Event('focus')); });
  await page.clock.fastForward(15000);
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'detect_apps').length)).toBe(scans);
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'launch_states').length)).toBe(initialBatches + 1);
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'launch_state').length)).toBe(0);
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable:true, value:'hidden' }));
  await page.clock.fastForward(60000);
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'launch_states').length)).toBe(initialBatches + 1);
});

test('slow process checks do not block inventory or navigation and never overlap', async ({ page }) => {
  await page.clock.install();
  await mockNative(page);
  await page.addInitScript(() => {
    const native = (window as any).__TAURI_INTERNALS__.invoke;
    (window as any).__TAURI_INTERNALS__.invoke = (cmd: string, args: any) => {
      if (cmd === 'launch_states') {
        (window as any).__mock.calls.push({cmd, args});
        return new Promise(resolve => { (window as any).__releaseState = () => resolve({zcode:{phase:'running', rtl:false}}); });
      }
      return native(cmd, args);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'ZCode', exact:true})).toBeVisible();
  await page.getByRole('link', {name:'Settings', exact:true}).click();
  await expect(page).toHaveURL(/settings/);
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.evaluate(() => (window as any).__releaseState());
  await page.clock.runFor(100);
  await page.clock.fastForward(15000);
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'launch_states').length)).toBe(2);
  await page.clock.fastForward(60000);
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'launch_states').length)).toBe(2);
  await page.evaluate(() => (window as any).__releaseState());
});
