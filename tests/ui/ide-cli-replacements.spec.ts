import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('workspace shows the IDE and CLI with normal launch and setup guides', async ({page}) => {
  await mockNative(page, 'ide-cli');
  await page.goto('/');
  await expect(page.getByTestId('app-tile-antigravity-ide')).toBeVisible();
  await expect(page.getByTestId('app-tile-claude-code')).toBeVisible();
  await expect(page.getByTestId('app-tile-antigravity')).toHaveCount(0);
  const desktop = page.getByTestId('app-tile-claude-desktop');
  await expect(desktop).toBeVisible();
  await desktop.getByRole('button', {name:'Run Claude Desktop',exact:true}).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.find((call: any) => call.cmd === 'launch_app')?.args.req)).toEqual({appId:'claude-desktop',rtl:false});
  await page.goto('/app/claude-code?tab=guide');
  await expect(page.getByRole('heading',{name:'Radeon without a Claude account'})).toBeVisible();
  await page.goto('/app/antigravity-ide?tab=guide');
  await expect(page.getByRole('heading',{name:'Iran: network routing and account eligibility'})).toBeVisible();
});

test('older remote feeds cannot hide the replacements or replace their setup guides', async ({page}) => {
  await mockNative(page, 'ide-cli');
  await page.addInitScript(() => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: unknown) => {
      if (command !== 'feed_sync') return original(command, args);
      return {
        ok: true, catalog: {apps: [], providers: [], offers: []}, guides: {},
        learningArticles: {schemaVersion: 1, categories: [], articles: []},
      };
    };
  });
  await page.goto('/learning');
  await page.getByRole('button', {name: 'Refresh content', exact: true}).click();
  await expect(page.getByText('New tutorials and news have been downloaded.')).toBeVisible();
  await page.goto('/');
  await expect(page.getByTestId('app-tile-claude-code')).toBeVisible();
  await expect(page.getByTestId('app-tile-antigravity-ide')).toBeVisible();
  await expect(page.getByTestId('app-tile-claude-desktop')).toBeVisible();
  await page.goto('/app/claude-desktop?tab=guide');
  await expect(page.getByRole('heading',{name:'Test the model in Code'})).toBeVisible();
  await page.goto('/app/claude-code?tab=guide');
  await expect(page.getByRole('heading',{name:'Radeon without a Claude account'})).toBeVisible();
});

test('Claude CLI opens a terminal again instead of trying to focus a desktop executable', async ({page}) => {
  await mockNative(page, 'ide-cli');
  await page.goto('/app/claude-code');
  await page.getByRole('button',{name:'Run Claude Code CLI',exact:true}).click();
  await page.getByRole('button',{name:'Open another terminal Claude Code CLI',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__mock.calls.filter((x:any)=>x.cmd==='launch_app').length)).toBe(2);
});

test('Persian guides explain the working API path and native eligibility limit', async ({page}) => {
  await mockNative(page, 'ide-cli','fa');
  await page.goto('/app/claude-code?tab=guide');
  await expect(page.getByRole('heading',{name:'Radeon بدون حساب Claude'})).toBeVisible();
  await page.goto('/app/antigravity-ide?tab=guide');
  await expect(page.getByRole('heading',{name:'اتصال از ایران: شبکه و حساب دو مرحله‌اند'})).toBeVisible();
});
