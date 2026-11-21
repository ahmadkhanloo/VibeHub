import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from '@playwright/test';
import {
  AUTO_DIRECTION_SELECTOR,
  COMPOSER_SELECTORS,
  CSS_TEXT,
  INJECT_SOURCE,
  PROSE_ROOTS,
  PROSE_SELECTORS,
  STYLE_ID,
} from '../apps/DeepSeekHarness/style.mjs';
import { isDeepSeekHarnessPageTarget } from '../apps/DeepSeekHarness/cdp-targets.mjs';

test('DeepSeek Harness scopes bidi and local fonts to observed app prose and composer surfaces', async () => {
  const regular = await readFile(new URL('../apps/DeepSeekHarness/assets/Vazirmatn-Regular.woff2', import.meta.url));
  const bold = await readFile(new URL('../apps/DeepSeekHarness/assets/Vazirmatn-Bold.woff2', import.meta.url));

  assert.equal(STYLE_ID, 'deepseek-harness-rtl-fix-v3');
  assert.match(CSS_TEXT, /font-family:'Vazirmatn'/);
  assert.match(CSS_TEXT, /font-weight:400/);
  assert.match(CSS_TEXT, /font-weight:700/);
  assert.ok(CSS_TEXT.includes(regular.toString('base64')));
  assert.ok(CSS_TEXT.includes(bold.toString('base64')));
  assert.deepEqual(PROSE_SELECTORS, [
    '[class*="_markdown_"] :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary):not(:where(pre *,code *,kbd *,samp *,var *,output *,[data-terminal] *,[data-diff] *,[data-read] *,[data-search] *))',
    '[class*="_bubble_"] [data-slot="conversation.user.text.node"]',
    '[class*="_bubble_"] [class*="_plainRun_"]',
  ]);
  assert.deepEqual(COMPOSER_SELECTORS, [
    '[data-composer-input="true"][contenteditable="true"][role="textbox"]',
    '[data-composer-input="true"][contenteditable="true"][role="textbox"] :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary)',
  ]);
  assert.deepEqual(PROSE_ROOTS, ['[class*="_bubble_"]', '[class*="_markdown_"]']);
  for (const root of PROSE_ROOTS) assert.ok(AUTO_DIRECTION_SELECTOR.includes(root));
  // The installer resolves each root's direction and writes an explicit dir value,
  // because :dir() stops matching once a descendant uses plaintext bidi.
  assert.match(INJECT_SOURCE, /resolveDirection/);
  assert.match(INJECT_SOURCE, /setAttribute\('dir'/);
  assert.doesNotMatch(CSS_TEXT, /\}:dir\(/);
  assert.match(AUTO_DIRECTION_SELECTOR, /data-composer-input="true"/);
  assert.match(CSS_TEXT, /unicode-bidi:plaintext/);
  assert.match(CSS_TEXT, /\[class\*="_markdown_"\] :is\(td,th\)/);
  assert.match(CSS_TEXT, /\[class\*="_markdown_"\].*\[data-terminal\]/s);
  assert.doesNotMatch(CSS_TEXT, /\[class\*="editor"\]|\[role="tablist"\]/);
  assert.doesNotMatch(CSS_TEXT, /font-family\s*:\s*revert/i);
  assert.match(INJECT_SOURCE, /INSTALLER_SIGNATURE/);
  assert.match(INJECT_SOURCE, /deepseek-harness-rtl-fix-v3/);
  assert.match(INJECT_SOURCE, /new MutationObserver/);

  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><head><style>
      body{font:16px Arial,sans-serif;direction:ltr}
      [data-terminal]{font-family:Consolas,monospace}
    </style></head><body>
      <div class="_markdown_1ypvv_5" id="message">
        <h2 id="persian-heading">پلن Codex برای API</h2>
        <p id="mixed">سلام API 123 نیم‌فاصله</p>
        <p id="english">English API 123</p>
        <p id="numbered">۱- مرحله اول فهرست</p>
        <ul id="persian-list"><li id="list-item">مرحلهٔ دوم</li></ul>
        <table><tr><td id="table-cell">سلول API</td></tr></table>
        <blockquote><p id="quote">نقل‌قول فارسی</p></blockquote>
        <p id="link"><a href="https://example.invalid">لینک API</a></p>
        <pre id="code"><code>const path = 'C:\\project\\file.ts';</code></pre>
        <div data-diff id="diff"><pre>+ const value = 1;</pre></div>
        <div data-terminal id="terminal">$ echo hello</div>
      </div>
      <div id="persian-node">
        <div class="_userRow_x" id="user-row">
          <div class="_userStack_x">
            <div class="_bubble_44yfq_1" id="persian-prompt"><span class="_root_x"><span data-slot="conversation.user.text.node"><span class="_plainRun_fbulu_6" id="persian-prompt-run">برای همه اپ‌ها این را برطرف کن</span></span></span></div>
          </div>
        </div>
      </div>
      <div id="english-node">
        <div class="_userRow_y" id="user-row-english">
          <div class="_userStack_y">
            <div class="_bubble_44yfq_1" id="english-prompt"><span class="_root_y"><span data-slot="conversation.user.text.node"><span class="_plainRun_fbulu_6" id="english-prompt-run">Fix this for every app please</span></span></span></div>
          </div>
        </div>
      </div>
      <div data-composer-input="true" contenteditable="true" role="textbox" id="composer">سلام API</div>
      <div class="_markdown_1ypvv_5" id="tooltip"><div class="_bubble_44yfq_1" id="bubble">tooltip</div></div>
      <p id="outside">outside English</p>
      <div class="_markdown_1ypvv_5" id="dynamic"></div>
    </body></html>`);

    await page.evaluate((source) => { (0, eval)(source); (0, eval)(source); }, INJECT_SOURCE);
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
      // Where the first text line starts decides whether a prompt reads RTL:
      // an RTL container leaves a wide gap on the left, an LTR one on the right.
      const lineGaps = (selector) => {
        const element = document.querySelector(selector);
        const box = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 2);
        if (!rects.length) return null;
        const left = Math.min(...rects.map((rect) => rect.left));
        const right = Math.max(...rects.map((rect) => rect.right));
        return { leftGap: Math.round(left - box.left), rightGap: Math.round(box.right - right) };
      };
      return {
        styleCount: [...document.querySelectorAll('style')].filter((style) => style.id === styleId).length,
        observerCount: Number(Boolean(window.__vibehubDeepSeekHarnessRtlStyleObserver)),
        heading: get('#persian-heading'),
        mixed: get('#mixed'),
        english: get('#english'),
        numbered: get('#numbered'),
        list: get('#list-item'),
        persianList: get('#persian-list'),
        table: get('#table-cell'),
        quote: get('#quote'),
        link: get('#link'),
        composer: get('#composer'),
        streamed: get('#streamed'),
        code: get('#code'),
        diff: get('#diff'),
        terminal: get('#terminal'),
        outside: get('#outside'),
        bubble: get('#bubble'),
        prompt: get('#persian-prompt'),
        promptRun: get('#persian-prompt-run'),
        promptGaps: lineGaps('#persian-prompt'),
        englishPrompt: get('#english-prompt'),
        englishPromptGaps: lineGaps('#english-prompt'),
        messageGaps: lineGaps('#mixed'),
      };
    }, STYLE_ID);

    assert.equal(result.styleCount, 1);
    assert.equal(result.observerCount, 1);
    assert.equal(result.heading.direction, 'rtl');
    assert.equal(result.heading.dir, 'rtl');
    assert.equal(result.mixed.direction, 'rtl');
    assert.equal(result.mixed.unicodeBidi, 'plaintext');
    assert.equal(result.mixed.dir, 'rtl');
    assert.equal(result.english.direction, 'ltr');
    assert.equal(result.english.dir, 'ltr');
    // A line that starts with a Persian digit keeps its RTL paragraph direction.
    assert.equal(result.numbered.direction, 'rtl');
    // List items carry the paragraph direction, which is what places the marker.
    assert.equal(result.list.dir, 'rtl');
    assert.equal(result.list.direction, 'rtl');
    assert.equal(result.table.textAlign, 'center');
    assert.equal(result.quote.direction, 'rtl');
    assert.equal(result.link.direction, 'rtl');
    assert.equal(result.composer.direction, 'rtl');
    assert.equal(result.composer.dir, 'rtl');
    assert.equal(result.streamed.direction, 'rtl');
    assert.match(result.mixed.font, /Vazirmatn/);
    assert.match(result.composer.font, /Vazirmatn/);
    assert.equal(result.code.direction, 'ltr');
    assert.match(result.code.font, /monospace/i);
    assert.equal(result.diff.direction, 'ltr');
    assert.equal(result.terminal.direction, 'ltr');
    assert.match(result.terminal.font, /Consolas/);
    assert.equal(result.outside.direction, 'ltr');
    assert.match(result.outside.font, /Arial/);
    assert.match(result.bubble.font, /Arial/);

    // The prompt bubble owns the paragraph direction, so Persian hugs the right.
    assert.equal(result.prompt.dir, 'rtl');
    assert.equal(result.prompt.direction, 'rtl');
    assert.match(result.promptRun.font, /Vazirmatn/);
    assert.equal(result.promptRun.unicodeBidi, 'plaintext');
    assert.ok(result.promptGaps, 'persian prompt produced line boxes');
    assert.ok(result.promptGaps.rightGap < result.promptGaps.leftGap, `persian prompt starts on the left: ${JSON.stringify(result.promptGaps)}`);
    // An English prompt in the same container stays left-to-right.
    assert.equal(result.englishPrompt.dir, 'ltr');
    assert.equal(result.englishPrompt.direction, 'ltr');
    assert.ok(result.englishPromptGaps, 'english prompt produced line boxes');
    assert.ok(result.englishPromptGaps.leftGap < result.englishPromptGaps.rightGap, `english prompt starts on the right: ${JSON.stringify(result.englishPromptGaps)}`);

    await page.addInitScript(INJECT_SOURCE);
    await page.goto(`data:text/html,${encodeURIComponent('<!doctype html><html><head><meta charset="utf-8"></head><body><div class="_markdown_1ypvv_5"><p id="after-reload">مرحلهٔ بازگشت</p></div></body></html>')}`);
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

test('DeepSeek Harness attaches only app renderer pages', () => {
  assert.equal(isDeepSeekHarnessPageTarget({ type: 'page', url: 'dsh-app://app/' }), true);
  assert.equal(isDeepSeekHarnessPageTarget({ type: 'page', url: 'dsh-app://app/workspace?tab=1' }), true);
  assert.equal(isDeepSeekHarnessPageTarget({ type: 'page', url: 'about:blank' }), false);
  assert.equal(isDeepSeekHarnessPageTarget({ type: 'page', url: 'devtools://devtools/bundled/inspector.html' }), false);
  assert.equal(isDeepSeekHarnessPageTarget({ type: 'iframe', url: 'dsh-app://app/preview' }), false);
  assert.equal(isDeepSeekHarnessPageTarget({ type: 'worker', url: 'dsh-app://app/worker' }), false);
});
