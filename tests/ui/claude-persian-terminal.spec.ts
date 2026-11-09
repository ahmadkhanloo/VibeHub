import { test, expect } from '@playwright/test';
import { mockNative } from './mock';
test('adds and selects an API connection from the Claude launch panel', async ({page}) => {
 await mockNative(page,'ide-cli');
 await page.goto('/app/claude-code?tab=launch');
 const panel=page.getByRole('region',{name:'Persian writing in Claude'});
 const add=panel.getByRole('button',{name:'Add connection',exact:true});
 await expect(add).toBeVisible();
 await add.click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByLabel('Provider and connection type')).toHaveValue('openrouter');
 await expect(dialog.locator('option[value=nvidia]')).toHaveAttribute('disabled', '');
 await dialog.getByLabel('Provider and connection type').selectOption('radeon-cloud');
 await expect(dialog.getByLabel('Base URL')).toHaveValue('https://developer.amd.com.cn/radeon/api/v1');
 await dialog.getByLabel('Model ID').fill('fixture-model');
 await dialog.getByLabel('API key').fill('fixture-key');
 await dialog.getByRole('button',{name:'Save connection'}).click();
 await expect(dialog).toBeHidden();
 await expect(panel.getByRole('combobox').first().locator('option:checked')).toHaveText(/Radeon Cloud.*fixture-model/);
 const id=await panel.getByRole('combobox').first().inputValue();
 await panel.getByRole('button',{name:'Run normally',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__mock.calls.filter((x:any)=>x.cmd==='launch_app').at(-1)?.args.req.connectionId)).toBe(id);
});
for (const language of ['en','fa']) {
 test('direct Persian Claude launch in '+language, async ({page}) => {
  await mockNative(page,'ide-cli',language);
  await page.goto('/app/claude-code?tab=launch');
  const panel=page.getByRole('region',{name:language==='fa'?'نوشتار فارسی در Claude':'Persian writing in Claude'});
  await expect(panel).toBeVisible();
  await panel.getByRole('button',{name:language==='fa'?'اجرای فارسی':'Run in Persian',exact:true}).click();
  await expect(panel.getByRole('status')).toBeVisible();
  const req=await page.evaluate(()=>(window as any).__mock.calls.filter((x:any)=>x.cmd==='launch_app').at(-1)?.args.req);
  expect(req.appId).toBe('claude-code'); expect(req.rtl).toBe(true);
  expect(JSON.stringify(req)).not.toMatch(/API_KEY|AUTH_TOKEN/);
  if(language==='fa') await page.screenshot({path:'output/claude-direct-launch-fa.png',fullPage:true});
 });
}
test('normal Claude launch remains available without Persian plugin',async({page})=>{
 await mockNative(page,'ide-cli'); await page.goto('/app/claude-code?tab=launch');
 const panel=page.getByRole('region',{name:'Persian writing in Claude'});
 await panel.getByRole('button',{name:'Run normally',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__mock.calls.filter((x:any)=>x.cmd==='launch_app').at(-1)?.args.req.rtl)).toBe(false);
});
test('model selection survives reload and reaches the shared launch button without a secret',async({page})=>{
 await mockNative(page,'ide-cli'); await page.goto('/app/claude-code?tab=launch');
 const panel=page.getByRole('region',{name:'Persian writing in Claude'});
 await panel.getByRole('combobox').first().selectOption('connection-local');
 await panel.getByRole('combobox').nth(1).selectOption('bearer');
 await page.reload();
 await expect(panel.getByRole('combobox').first()).toHaveValue('connection-local');
 await panel.getByRole('button',{name:'Run in Persian',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__mock.calls.filter((x:any)=>x.cmd==='launch_app').at(-1)?.args.req.connectionId)).toBe('connection-local');
 const req=await page.evaluate(()=>(window as any).__mock.calls.filter((x:any)=>x.cmd==='launch_app').at(-1)?.args.req);
 expect(req.authHeader).toBe('bearer');expect(req).not.toHaveProperty('key');
 await page.screenshot({path:'output/claude-direct-launch-en.png',fullPage:true});
});
test('shared Persian card launch uses the selected connection',async({page})=>{
 await mockNative(page,'ide-cli'); await page.goto('/app/claude-code?tab=launch');
 const panel=page.getByRole('region',{name:'Persian writing in Claude'});
 await panel.getByRole('combobox').first().selectOption('connection-local');
 await page.getByRole('button',{name:'Run RTL Claude Code CLI',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__mock.calls.filter((x:any)=>x.cmd==='launch_app').at(-1)?.args.req.connectionId)).toBe('connection-local');
});
