import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { CSS_TEXT, INJECT_SOURCE, STYLE_ID } from '../apps/ZCode/style.mjs';
import { isZCodePageTarget } from '../apps/ZCode/cdp-targets.mjs';

test('ZCode applies shared font and bidi rules only to observed chat surfaces and keeps code surfaces LTR', async () => {
  const regular = await readFile(new URL('../apps/ZCode/assets/Vazirmatn-Regular.woff2', import.meta.url));
  const bold = await readFile(new URL('../apps/ZCode/assets/Vazirmatn-Bold.woff2', import.meta.url));

  assert.match(CSS_TEXT, /font-family:'Vazirmatn'/);
  assert.match(CSS_TEXT, /font-weight:400/);
  assert.match(CSS_TEXT, /font-weight:700/);
  assert.ok(CSS_TEXT.includes(regular.toString('base64')));
  assert.ok(CSS_TEXT.includes(bold.toString('base64')));
  assert.match(CSS_TEXT, /\[data-testid="v4-timeline"\]\s+:is\(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th/);
  assert.match(CSS_TEXT, /\[data-testid="v4-composer-input"\]\[contenteditable="true"\]\[role="textbox"\]/);
  assert.match(CSS_TEXT, /unicode-bidi:plaintext/);
  assert.match(CSS_TEXT, /\[data-testid="v4-timeline"\]\s+:is\(pre,code,kbd,samp,var,output\)/);
  assert.doesNotMatch(CSS_TEXT, /\[class\*="terminal"\]|\.monaco-editor|\.xterm/);
  assert.doesNotMatch(CSS_TEXT, /(?:^|\n):is\(h1,h2,h3,h4,h5,h6\):dir\(rtl\)/);

  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><head><style>body{font-family:Arial,sans-serif;direction:ltr}pre,code{font-family:Consolas,monospace}</style></head><body>
      <div data-testid="v4-timeline">
        <p id="persian">سلام، API ۱۲۳ نیم‌فاصله</p>
        <p id="english">English API 123</p>
        <pre id="code"><code>const path = 'C:\\project\\file.ts';</code></pre>
      </div>
      <div data-testid="v4-composer-input" contenteditable="true" role="textbox"><p id="composer-line">سلام API</p></div>
      <p id="outside">سلام outside scope</p>
      <div class="terminal" id="terminal">$ echo hello</div>
      <iframe id="preview" srcdoc="<p>project preview</p>"></iframe>
    </body></html>`);

    const unaffectedBefore = await page.evaluate(() => ({
      outsideBidi: getComputedStyle(document.querySelector('#outside')).unicodeBidi,
      terminalBidi: getComputedStyle(document.querySelector('#terminal')).unicodeBidi,
    }));
    await page.evaluate((source) => { (0, eval)(source); }, INJECT_SOURCE);
    await page.evaluate((source) => { (0, eval)(source); }, INJECT_SOURCE);

    const result = await page.evaluate((styleId) => {
      const css = (selector, property) => getComputedStyle(document.querySelector(selector)).getPropertyValue(property);
      return {
        styleCount: [...document.querySelectorAll('style')].filter((style) => style.id === styleId).length,
        persianBidi: css('#persian', 'unicode-bidi'),
        persianDirection: css('#persian', 'direction'),
        persianFont: css('#persian', 'font-family'),
        englishBidi: css('#english', 'unicode-bidi'),
        englishDirection: css('#english', 'direction'),
        composerBidi: css('#composer-line', 'unicode-bidi'),
        composerDirection: css('#composer-line', 'direction'),
        codeDirection: css('#code', 'direction'),
        codeBidi: css('#code', 'unicode-bidi'),
        codeFont: css('#code', 'font-family'),
        outsideBidi: css('#outside', 'unicode-bidi'),
        outsideFont: css('#outside', 'font-family'),
        terminalBidi: css('#terminal', 'unicode-bidi'),
        terminalFont: css('#terminal', 'font-family'),
        previewStyleCount: [...document.querySelector('#preview').contentDocument.querySelectorAll('style')].filter((style) => style.id === styleId).length,
      };
    }, STYLE_ID);

    const { outsideBidi, terminalBidi, persianFont, ...scopedStyles } = result;
    assert.deepEqual(scopedStyles, {
      styleCount: 1,
      persianBidi: 'plaintext',
      persianDirection: 'rtl',
      englishBidi: 'plaintext',
      englishDirection: 'ltr',
      composerBidi: 'plaintext',
      composerDirection: 'rtl',
      codeDirection: 'ltr',
      codeBidi: 'isolate',
      codeFont: 'Consolas, monospace',
      outsideFont: 'Arial, sans-serif',
      terminalFont: 'Arial, sans-serif',
      previewStyleCount: 0,
    });
    assert.match(persianFont, /Vazirmatn/);
    assert.equal(outsideBidi, unaffectedBefore.outsideBidi);
    assert.equal(terminalBidi, unaffectedBefore.terminalBidi);
  } finally {
    await browser.close();
  }
});

test('ZCode attaches main renderer windows and leaves embedded previews to their own styles', () => {
  assert.equal(isZCodePageTarget({ type: 'page', url: 'file:///ZCode/index.html' }), true);
  assert.equal(isZCodePageTarget({ type: 'page', url: 'about:blank' }), true);
  assert.equal(isZCodePageTarget({ type: 'iframe', url: 'http://127.0.0.1/preview' }), false);
  assert.equal(isZCodePageTarget({ type: 'worker', url: '' }), false);
  assert.equal(isZCodePageTarget({ type: 'page', url: 'devtools://devtools/bundled/inspector.html' }), false);
});
