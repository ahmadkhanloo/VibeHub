import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from '@playwright/test';
import {
  AUTO_DIRECTION_SELECTOR,
  COMPOSER_SELECTORS,
  CSS_TEXT,
  INJECT_JS,
  PROSE_ROOTS,
  PROSE_SELECTORS,
  STYLE_ID,
} from '../apps/Antigravity/style.mjs';
import { isAntigravityPageTarget } from '../apps/Antigravity/cdp-targets.mjs';

test('Antigravity renders observed chat text in Vazirmatn and leaves code/editor/terminal surfaces unchanged', async () => {
  const regular = await readFile(new URL('../apps/Antigravity/assets/Vazirmatn-Regular.woff2', import.meta.url));
  const bold = await readFile(new URL('../apps/Antigravity/assets/Vazirmatn-Bold.woff2', import.meta.url));

  assert.equal(STYLE_ID, 'vibehub-antigravity-rtl-v1');
  assert.deepEqual(PROSE_ROOTS, ['[data-testid="planner-response-text"]', '[data-testid="user-input-step"]']);
  assert.deepEqual(PROSE_SELECTORS, [
    '[data-testid="planner-response-text"] :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary):not(:where(pre *,code *,kbd *,samp *,var *,output *,[role="terminal"] *, .monaco-editor *, .xterm *))',
    '[data-testid="planner-response-text"] div.whitespace-pre-wrap:not(:where(pre *,code *,kbd *,samp *,var *,output *,[role="terminal"] *, .monaco-editor *, .xterm *))',
    '[data-testid="user-input-step"] :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary):not(:where(pre *,code *,kbd *,samp *,var *,output *,[role="terminal"] *, .monaco-editor *, .xterm *))',
    '[data-testid="user-input-step"] div.whitespace-pre-wrap:not(:where(pre *,code *,kbd *,samp *,var *,output *,[role="terminal"] *, .monaco-editor *, .xterm *))',
  ]);
  assert.deepEqual(COMPOSER_SELECTORS, [
    '[data-lexical-editor="true"][aria-label="Message input"]',
    '[data-lexical-editor="true"][aria-label="Message input"] :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary)',
  ]);
  assert.match(CSS_TEXT, /font-family:'Vazirmatn'/);
  assert.match(CSS_TEXT, /font-weight:400/);
  assert.match(CSS_TEXT, /font-weight:700/);
  assert.ok(CSS_TEXT.includes(regular.toString('base64')));
  assert.ok(CSS_TEXT.includes(bold.toString('base64')));
  assert.match(CSS_TEXT, /unicode-bidi:plaintext/);
  assert.match(CSS_TEXT, /\[data-testid="planner-response-text"\] :is\(h1,h2,h3,h4,h5,h6\):dir\(rtl\)/);
  assert.match(CSS_TEXT, /\[data-testid="planner-response-text"\] :is\(td,th\)/);
  assert.match(CSS_TEXT, /\[data-testid="user-input-step"\] :is\(pre,code,kbd,samp,var,output/);
  assert.doesNotMatch(CSS_TEXT, /font-family\s*:\s*revert/i);
  assert.doesNotMatch(CSS_TEXT, /(?:^|\n)\s*\.monaco-editor\s*\{/);
  assert.match(AUTO_DIRECTION_SELECTOR, /data-testid="planner-response-text"/);
  assert.match(AUTO_DIRECTION_SELECTOR, /aria-label="Message input"/);
  assert.match(INJECT_JS, /__APP_CONFIG__\.productName/);
  assert.match(INJECT_JS, /productName !== ['"]antigravity['"]/);
  assert.match(INJECT_JS, /INSTALLER_SIGNATURE/);
  assert.match(INJECT_JS, /new MutationObserver/);

  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      body{font:16px Arial,sans-serif;direction:ltr}
      pre,code,.monaco-editor,[role="terminal"]{font-family:Consolas,monospace}
    </style><script>window.__APP_CONFIG__={productName:'antigravity-ide'}</script></head><body></body></html>`);
    await page.evaluate((source) => { (0, eval)(source); }, INJECT_JS);
    const rejected = await page.evaluate(() => ({
      styleCount: document.querySelectorAll('#vibehub-antigravity-rtl-v1').length,
      observerCount: Number(Boolean(window.__vibehubAntigravityRtlStyleObserver)),
    }));
    assert.deepEqual(rejected, { styleCount: 0, observerCount: 0 });

    await page.evaluate(() => { window.__APP_CONFIG__ = { productName: 'antigravity' }; });
    await page.evaluate((source) => { (0, eval)(source); (0, eval)(source); }, INJECT_JS);
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      body{font:16px Arial,sans-serif;direction:ltr}
      pre,code,.monaco-editor,[role="terminal"]{font-family:Consolas,monospace}
    </style><script>window.__APP_CONFIG__={productName:'antigravity'}</script></head><body>
      <div data-testid="planner-response-text">
        <h2 id="heading">پلن Codex برای API</h2>
        <p id="mixed">سلام API ۱۲۳ نیم‌فاصله</p>
        <p id="english">English API 123</p>
        <div class="whitespace-pre-wrap" id="prewrap">مسیر C:\\project\\file.ts</div>
        <ul><li id="list">مرحلهٔ دوم</li></ul>
        <table><tbody><tr><td id="table-cell">جدول فارسی</td></tr></tbody></table>
        <blockquote><p id="quote">نقل‌قول فارسی</p></blockquote>
        <p><a id="link" href="#fixture">پیوند فارسی</a></p>
        <pre id="code"><code>const path = 'C:\\project\\file.ts';</code></pre>
        <div id="terminal" role="terminal">$ echo hello</div>
      </div>
      <div data-testid="user-input-step"><p id="followup">مرحلهٔ بعدی</p></div>
      <div data-lexical-editor="true" aria-label="Message input" contenteditable="true" role="textbox"><p id="composer-line">سلام API</p></div>
      <p id="outside">outside English</p>
      <div class="monaco-editor" id="editor">const x = 1;</div>
      <div data-testid="planner-response-text" id="stream"></div>
    </body></html>`);
    await page.evaluate((source) => { (0, eval)(source); (0, eval)(source); }, INJECT_JS);
    await page.locator('#stream').evaluate((node) => {
      const paragraph = document.createElement('p');
      paragraph.id = 'streamed';
      paragraph.textContent = 'پاسخ تدریجی فارسی';
      node.append(paragraph);
    });
    await page.waitForFunction(() => document.querySelector('#streamed')?.getAttribute('dir') === 'auto');
    await page.evaluate(() => document.fonts.ready);

    const result = await page.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        const style = getComputedStyle(element);
        return {
          direction: style.direction,
          unicodeBidi: style.unicodeBidi,
          textAlign: style.textAlign,
          font: style.fontFamily,
          dir: element.getAttribute('dir'),
        };
      };
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('#mixed'));
      return {
        styleCount: document.querySelectorAll('#vibehub-antigravity-rtl-v1').length,
        observerCount: Number(Boolean(window.__vibehubAntigravityRtlStyleObserver)),
        heading: read('#heading'),
        mixed: read('#mixed'),
        english: read('#english'),
        prewrap: read('#prewrap'),
        list: read('#list'),
        table: read('#table-cell'),
        quote: read('#quote'),
        link: read('#link'),
        code: read('#code'),
        terminal: read('#terminal'),
        composer: read('#composer-line'),
        streamed: read('#streamed'),
        outside: read('#outside'),
        editor: read('#editor'),
        selectedText: range.toString(),
        font400: document.fonts.check('16px Vazirmatn', 'سلام'),
        font700: document.fonts.check('700 16px Vazirmatn', 'سلام'),
      };
    });

    assert.equal(result.styleCount, 1);
    assert.equal(result.observerCount, 1);
    assert.equal(result.heading.direction, 'rtl');
    assert.equal(result.heading.textAlign, 'right');
    assert.equal(result.heading.dir, 'auto');
    assert.equal(result.mixed.direction, 'rtl');
    assert.equal(result.mixed.unicodeBidi, 'plaintext');
    assert.equal(result.mixed.dir, 'auto');
    assert.equal(result.english.direction, 'ltr');
    assert.equal(result.english.dir, 'auto');
    assert.equal(result.prewrap.direction, 'rtl');
    assert.equal(result.list.direction, 'rtl');
    assert.equal(result.table.textAlign, 'center');
    assert.equal(result.quote.direction, 'rtl');
    assert.equal(result.link.direction, 'rtl');
    assert.equal(result.code.direction, 'ltr');
    assert.match(result.code.font, /Consolas/);
    assert.equal(result.terminal.direction, 'ltr');
    assert.match(result.terminal.font, /Consolas/);
    assert.equal(result.composer.direction, 'rtl');
    assert.equal(result.streamed.direction, 'rtl');
    assert.match(result.mixed.font, /Vazirmatn/);
    assert.match(result.composer.font, /Vazirmatn/);
    assert.match(result.outside.font, /Arial/);
    assert.match(result.editor.font, /Consolas/);
    assert.equal(result.selectedText, 'سلام API ۱۲۳ نیم‌فاصله');
    assert.equal(result.font400, true);
    assert.equal(result.font700, true);

    const context = await browser.newContext();
    const reloadPage = await context.newPage();
    await reloadPage.addInitScript(INJECT_JS);
    await reloadPage.goto(`data:text/html;charset=utf-8,${encodeURIComponent('<!doctype html><html><head><meta charset="utf-8"><script>window.__APP_CONFIG__={productName:"antigravity"}</script></head><body><div data-testid="planner-response-text"><p id="after-reload">مرحلهٔ بازگشت</p></div></body></html>')}`);
    await reloadPage.waitForFunction(() => document.querySelector('#vibehub-antigravity-rtl-v1')?.textContent.length > 1000);
    const afterReload = await reloadPage.evaluate(() => ({
      styleCount: document.querySelectorAll('#vibehub-antigravity-rtl-v1').length,
      observerCount: Number(Boolean(window.__vibehubAntigravityRtlStyleObserver)),
      direction: getComputedStyle(document.querySelector('#after-reload')).direction,
      dir: document.querySelector('#after-reload').getAttribute('dir'),
    }));
    assert.deepEqual(afterReload, { styleCount: 1, observerCount: 1, direction: 'rtl', dir: 'auto' });
    await context.close();
  } finally {
    await browser.close();
  }
});

test('Antigravity attaches local app renderer pages including the current onboarding route', () => {
  assert.equal(isAntigravityPageTarget({ type: 'page', url: 'https://127.0.0.1:62648/' }), true);
  assert.equal(isAntigravityPageTarget({ type: 'page', url: 'https://localhost:62648/' }), true);
  assert.equal(isAntigravityPageTarget({ type: 'page', url: 'https://127.0.0.1:62648/onboarding?login=true' }), true);
  assert.equal(isAntigravityPageTarget({ type: 'page', url: 'https://localhost:62648/conversation/123' }), true);
  assert.equal(isAntigravityPageTarget({ type: 'page', url: 'https://antigravity.google/' }), false);
  assert.equal(isAntigravityPageTarget({ type: 'page', url: 'data:text/html,app' }), false);
  assert.equal(isAntigravityPageTarget({ type: 'iframe', url: 'https://127.0.0.1:62648/' }), false);
  assert.equal(isAntigravityPageTarget({ type: 'worker', url: 'https://127.0.0.1:62648/' }), false);
});
