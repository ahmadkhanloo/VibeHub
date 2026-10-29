import { test, expect } from '@playwright/test';
import { mockNative } from './mock';
import { INJECT_JS, STYLE_ID } from '../../apps/Antigravity/style.mjs';

test('standalone chat RTL stays scoped, supports streaming and cleans up without duplicate observers', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'Apps',exact:true})).toBeVisible();
  await page.setContent(`
    <h1 id="outside">عنوان بیرون از چت</h1>
    <div data-testid="planner-response-text">
      <p id="fa">سلام، نسخهٔ API آماده است.</p><p id="en">Hello API 123.</p>
      <pre><code id="code">const x = 'سلام';</code></pre>
      <table><tr><td><p>ستون اول</p></td></tr></table>
    </div>
    <div data-testid="user-input-step"><div class="whitespace-pre-wrap" id="user">پرسش فارسی</div></div>
    <div contenteditable="true" data-lexical-editor="true" aria-label="Message input"><p id="input">متن ورودی English</p></div>
    <div class="monaco-editor"><p id="editor">کد ویرایشگر</p></div>
  `);
  await page.evaluate(() => {
    (window as any).__APP_CONFIG__ = { productName: 'antigravity' };
    const Original = window.MutationObserver;
    (window as any).__observerCount = 0;
    window.MutationObserver = class extends Original {
      constructor(callback: MutationCallback) { super(callback); (window as any).__observerCount++; }
    };
  });
  const apply = () => page.evaluate(source => { (0, eval)(source); }, INJECT_JS);
  await apply(); await apply();
  await expect(page.locator('#fa')).toHaveCSS('direction', 'rtl');
  await expect(page.locator('#en')).toHaveCSS('direction', 'ltr');
  await expect(page.locator('#user')).toHaveCSS('direction', 'rtl');
  await expect(page.locator('#input')).toHaveCSS('direction', 'rtl');
  await expect(page.locator('#code')).toHaveCSS('direction', 'ltr');
  expect(await page.locator('#outside').getAttribute('dir')).toBeNull();
  expect(await page.locator('#editor').getAttribute('dir')).toBeNull();
  expect(await page.locator(`#${STYLE_ID}`).count()).toBe(1);
  expect(await page.evaluate(() => (window as any).__observerCount)).toBe(1);
  await page.locator('[data-testid="planner-response-text"]').evaluate(el => {
    const p = document.createElement('p'); p.id = 'stream'; p.textContent = 'پاسخ'; el.appendChild(p);
  });
  await expect(page.locator('#stream')).toHaveAttribute('dir', 'auto');
  await page.locator('#stream').evaluate(el => { el.textContent = 'English now'; });
  await expect(page.locator('#stream')).toHaveCSS('direction', 'ltr');
  await page.evaluate(() => (window as any).__vibehubAntigravityRtl());
  expect(await page.locator('[data-vh-ag-dir]').count()).toBe(0);
  expect(await page.locator(`#${STYLE_ID}`).count()).toBe(0);
});

test('injector ignores pages outside standalone Antigravity', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'Apps',exact:true})).toBeVisible();
  await page.setContent('<div data-testid="planner-response-text"><p>سلام</p></div>');
  await page.evaluate(source => { (0, eval)(source); }, INJECT_JS);
  expect(await page.locator(`#${STYLE_ID}`).count()).toBe(0);
});

test('new-document injection waits for product configuration and survives reload', async ({ page }) => {
  await page.route('**/rtl-fixture', route => route.fulfill({contentType:'text/html; charset=utf-8', body:`
    <script>window.__APP_CONFIG__={productName:'antigravity'}</script>
    <div data-testid="planner-response-text"><p id="response">سلام API</p></div>
  `}));
  await page.addInitScript(INJECT_JS);
  await page.goto('/rtl-fixture');
  await expect(page.locator('#response')).toHaveCSS('direction', 'rtl');
  await page.reload();
  await expect(page.locator('#response')).toHaveCSS('direction', 'rtl');
  await expect(page.locator(`#${STYLE_ID}`)).toHaveCount(1);
});


test('standalone Antigravity exposes experimental RTL, defaults to normal and uses app IPC', async ({ page }) => {
  await mockNative(page, 'antigravity');
  await page.goto('/');
  const row = page.locator('article').filter({has:page.getByRole('heading', {name:'Antigravity',exact:true})});
  await row.getByRole('button', {name:'Launch mode for Antigravity',exact:true}).click();
  await expect(row.getByText('Chat RTL · experimental')).toBeVisible();
  await expect(row.getByRole('combobox')).toHaveValue('normal');
  await row.getByRole('combobox').selectOption('rtl');
  await row.getByRole('button', {name:/^Run/}).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'launch_app'))).toEqual([{cmd:'launch_app',args:{req:{appId:'antigravity',rtl:true}}}]);
  expect(await page.evaluate(() => (window as any).__mock.calls.some((c: any) => c.cmd === 'launch_editor'))).toBe(false);
});
