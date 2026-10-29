import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('returning after externally closing ZCode rechecks status without scanning or launching', async ({ page }) => {
  await mockNative(page, 'running');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Go to app ZCode', exact: true })).toBeEnabled();
  const run = page.getByRole('button', { name: 'Run with RTL ZCode', exact: true });
  const scans = await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.cmd === 'detect_apps').length);
  await page.evaluate(() => { (window as any).__mock.launchStates.zcode = { phase: 'idle' }; window.dispatchEvent(new Event('focus')); });
  await expect(run).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.cmd === 'detect_apps').length)).toBe(scans);
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.cmd === 'launch_app').length)).toBe(0);
  await run.click();
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.cmd === 'launch_app').length)).toBe(1);
});

test('already-open retry checks current process state before allowing a new launch', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const host = window as any, original = host.__TAURI_INTERNALS__.invoke;
    let rejected = false;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any) => {
      if (command === 'launch_app' && !rejected) {
        rejected = true; host.__mock.calls.push({ cmd: command, args });
        host.__mock.launchStates.zcode = { phase: 'running', rtl: false };
        throw Error('VIBEHUB_LAUNCH_ALREADY_OPEN');
      }
      return original(command, args);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Run with RTL ZCode', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(() => { (window as any).__mock.launchStates.zcode = { phase: 'idle' }; });
  await page.getByRole('alert').getByRole('button').click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.filter((call: any) => call.cmd === 'launch_app').length)).toBe(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('running status has an explicit recheck for windows that do not regain focus', async ({ page }) => {
  await mockNative(page, 'running');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Go to app ZCode', exact: true })).toBeEnabled();
  await page.evaluate(() => { (window as any).__mock.launchStates.zcode = { phase: 'idle' }; });
  await page.getByRole('button', { name: 'Check again ZCode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run with RTL ZCode', exact: true })).toBeEnabled();
});
