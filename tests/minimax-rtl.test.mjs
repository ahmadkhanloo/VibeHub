import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from '@playwright/test';
import {
  AUTO_DIRECTION_SELECTOR,
  COMPOSER_SELECTORS,
  CSS_TEXT,
  INJECT_JS,
  PROSE_SELECTORS,
  STYLE_ID,
} from '../apps/MiniMax/style.mjs';
import { isMiniMaxPageTarget } from '../apps/MiniMax/cdp-targets.mjs';

test('MiniMax Code scopes bidi and local fonts to its observed chat and composer surfaces', async () => {
  const regular = await readFile(new URL('../apps/MiniMax/assets/Vazirmatn-Regular.woff2', import.meta.url));
  const bold = await readFile(new URL('../apps/MiniMax/assets/Vazirmatn-Bold.woff2', import.meta.url));

  assert.equal(STYLE_ID, 'vibehub-minimax-rtl-v1');
  assert.match(CSS_TEXT, /font-family:'Vazirmatn'/);
  assert.match(CSS_TEXT, /font-weight:400/);
  assert.match(CSS_TEXT, /font-weight:700/);
  assert.ok(CSS_TEXT.includes(regular.toString('base64')));
  assert.ok(CSS_TEXT.includes(bold.toString('base64')));
  assert.ok(PROSE_SELECTORS.some((selector) => selector.includes('[data-testid="chat-message-list"]')));
  assert.ok(PROSE_SELECTORS.some((selector) => selector.startsWith('.message-content ')));
  assert.ok(PROSE_SELECTORS.includes('.matrix-markdown'));
  assert.ok(COMPOSER_SELECTORS.some((selector) => selector.includes('[data-message-input-root]')));
  assert.match(AUTO_DIRECTION_SELECTOR, /chat-message-list/);
  assert.match(AUTO_DIRECTION_SELECTOR, /data-message-input-root/);
  assert.match(CSS_TEXT, /unicode-bidi:plaintext/);
  assert.match(CSS_TEXT, /\.matrix-markdown :is\(pre,/);
  assert.match(CSS_TEXT, /direction:ltr!important/);
  assert.match(CSS_TEXT, /monospace/);
  assert.match(INJECT_JS, /INSTALLER_SIGNATURE/);
  assert.match(INJECT_JS, /new MutationObserver/);

  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><head><style>
      body{font:16px Arial,sans-serif;direction:ltr}
      pre,code{font-family:Consolas,monospace}
    </style></head><body>
      <main>
        <div data-testid="chat-message-list">
          <div class="message-content" id="message">
            <div class="matrix-markdown desktop-text-markdown-body" id="markdown">
              <h2 id="persian-heading">پلن MiniMax برای API</h2>
              <p id="mixed">سلام API 123 نیم‌فاصله</p>
              <p id="english">English API 123</p>
              <ul><li id="list-item">مرحلهٔ دوم</li></ul>
              <table><tr><td id="table-cell">سلول API</td></tr></table>
              <blockquote><p id="quote">نقل‌قول فارسی</p></blockquote>
              <p id="link"><a href="https://example.invalid">لینک API</a></p>
              <pre id="code"><code>const path = 'C:\\project\\file.ts';</code></pre>
              <div class="code-block" id="code-block">
                <span data-testid="diff-file-path" dir="rtl" id="path"><span dir="ltr" id="path-inner">src/app/file.ts</span></span>
                <pre><code>+ const value = 1;</code></pre>
              </div>
              <span class="inline-code" id="inline-code">npm install</span>
            </div>
          </div>
          <p id="list-para">متن فهرست</p>
          <div class="matrix-markdown" id="dynamic"></div>
        </div>
        <div data-message-input-root id="composer-root">
          <div class="ProseMirror" contenteditable="true" role="textbox" id="composer">سلام API</div>
        </div>
        <p id="outside">outside English</p>
      </main>
    </body></html>`);

    await page.evaluate((source) => { (0, eval)(source); (0, eval)(source); }, INJECT_JS);
    await page.locator('#dynamic').evaluate((node) => {
      const paragraph = document.createElement('p');
      paragraph.id = 'streamed';
      paragraph.textContent = 'پاسخ تدریجی';
      node.append(paragraph);
    });
    await page.waitForFunction(() => document.querySelector('#streamed')?.getAttribute('dir') === 'rtl');

    const result = await page.evaluate((styleId) => {
      const get = (selector) => {
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
      return {
        styleCount: [...document.querySelectorAll('style')].filter((style) => style.id === styleId).length,
        observerCount: Number(Boolean(window.__vibehubMiniMaxRtlStyleObserver)),
        heading: get('#persian-heading'),
        mixed: get('#mixed'),
        english: get('#english'),
        list: get('#list-item'),
        table: get('#table-cell'),
        quote: get('#quote'),
        link: get('#link'),
        composer: get('#composer'),
        streamed: get('#streamed'),
        code: get('#code'),
        codeBlock: get('#code-block'),
        inlineCode: get('#inline-code'),
        path: get('#path'),
        pathInner: get('#path-inner'),
        outside: get('#outside'),
        listPara: get('#list-para'),
      };
    }, STYLE_ID);

    assert.equal(result.styleCount, 1);
    assert.equal(result.observerCount, 1);
    assert.equal(result.heading.direction, 'rtl');
    assert.equal(result.heading.dir, 'rtl');
    assert.equal(result.heading.textAlign, 'right');
    assert.equal(result.mixed.direction, 'rtl');
    assert.equal(result.mixed.unicodeBidi, 'plaintext');
    assert.equal(result.mixed.dir, 'rtl');
    assert.match(result.mixed.font, /Vazirmatn/);
    assert.equal(result.english.direction, 'ltr');
    assert.equal(result.english.dir, 'ltr');
    assert.equal(result.list.direction, 'rtl');
    assert.equal(result.table.textAlign, 'center');
    assert.equal(result.quote.direction, 'rtl');
    assert.equal(result.link.direction, 'rtl');
    assert.equal(result.listPara.dir, 'rtl');
    assert.equal(result.listPara.direction, 'rtl');
    assert.equal(result.composer.direction, 'rtl');
    assert.equal(result.composer.dir, 'rtl');
    assert.match(result.composer.font, /Vazirmatn/);
    assert.equal(result.streamed.direction, 'rtl');
    assert.equal(result.streamed.dir, 'rtl');
    assert.equal(result.code.direction, 'ltr');
    assert.equal(result.code.unicodeBidi, 'isolate');
    assert.match(result.code.font, /monospace/i);
    assert.equal(result.codeBlock.direction, 'ltr');
    assert.equal(result.inlineCode.direction, 'ltr');
    // The app's own component-level bidi fixes must survive untouched.
    assert.equal(result.path.dir, 'rtl');
    assert.equal(result.path.direction, 'rtl');
    assert.equal(result.pathInner.dir, 'ltr');
    assert.equal(result.pathInner.direction, 'ltr');
    assert.equal(result.outside.direction, 'ltr');
    assert.match(result.outside.font, /Arial/);

    await page.addInitScript(INJECT_JS);
    await page.goto(`data:text/html,${encodeURIComponent('<!doctype html><html><head><meta charset="utf-8"></head><body><div class="message-content"><div class="matrix-markdown"><p id="after-reload">مرحلهٔ بازگشت</p></div></div></body></html>')}`);
    const afterReload = await page.evaluate((styleId) => ({
      styleCount: [...document.querySelectorAll('style')].filter((style) => style.id === styleId).length,
      direction: getComputedStyle(document.querySelector('#after-reload')).direction,
      font: getComputedStyle(document.querySelector('#after-reload')).fontFamily,
      dir: document.querySelector('#after-reload').getAttribute('dir'),
    }), STYLE_ID);
    assert.equal(afterReload.styleCount, 1);
    assert.equal(afterReload.direction, 'rtl');
    assert.equal(afterReload.dir, 'rtl');
    assert.match(afterReload.font, /Vazirmatn/);
  } finally {
    await browser.close();
  }
});

test('MiniMax Code attaches only its own app-scheme renderer pages', () => {
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'app://./archon' }), true);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'app://./archon/' }), true);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'app://./archon?initialUrl=https%3A%2F%2Fexample.invalid' }), true);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'app://./login' }), true);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'app://./onboarding' }), true);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'app://./archon-mini-chat' }), false);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'app://./ppt-preview-renderer' }), false);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'mavis-preview://preview/artifact/index.html' }), false);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'https://agent.minimax.io/' }), false);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'about:blank' }), false);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'devtools://devtools/bundled/inspector.html' }), false);
  assert.equal(isMiniMaxPageTarget({ type: 'iframe', url: 'app://./archon' }), false);
  assert.equal(isMiniMaxPageTarget({ type: 'worker', url: 'app://./archon' }), false);
  assert.equal(isMiniMaxPageTarget({ type: 'page', url: 'not a url' }), false);
});
