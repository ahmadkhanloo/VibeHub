import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { buildIdempotentStyleSource, buildScopedTextCss, embedVazirmatnFonts } from '../../apps/rtl-style.mjs';

const STYLE_ID = 'vibehub-rtl-fixture-style';
const OBSERVER_KEY = '__vibehubRtlFixtureObserver';

test('scoped RTL styles load Vazirmatn and survive repeated installation and appended content', async ({ page }) => {
  const assets = path.resolve('apps/Qoder/assets');
  const css = `${embedVazirmatnFonts(assets)}\n${buildScopedTextCss({
    prose: ['.prose'],
    composers: ['.composer'],
    guards: ['pre', 'code', '.terminal'],
  })}`;
  const source = buildIdempotentStyleSource({
    styleId: STYLE_ID,
    css,
    observerKey: OBSERVER_KEY,
    shadowHostSelectors: ['[data-plan-root]'],
  });

  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 24px; width: 900px; font: 16px Arial, sans-serif; }
    .prose { display: block; min-height: 28px; margin: 8px; border: 1px solid #999; }
    .composer { display: block; width: 500px; height: 44px; }
    pre, code, .terminal { font-family: Consolas, monospace; }
  </style></head><body>
    <section id="messages">
      <p id="fa" class="prose">سلام دنیا API ۱۲۳، نیم‌فاصله</p>
      <p id="en" class="prose">English API 123 punctuation</p>
      <p id="mixed" class="prose">سلام API 123 (mixed)</p>
      <textarea id="composer" class="composer">سلام API</textarea>
      <pre id="code"><code>const path = 'C:\\project\\file.ts';</code></pre>
      <div id="terminal" class="terminal">$ echo hello</div>
      <p id="outside">سلام outside scope</p>
      <div id="existing-plan" data-plan-root></div>
    </section>
  </body></html>`);

  await page.evaluate(() => {
    const host = document.querySelector('#existing-plan')!;
    host.attachShadow({ mode: 'open' }).innerHTML = '<p id="shadow-prose" class="prose">سلام طرح</p>';
  });
  await page.evaluate((script) => { (0, eval)(script); }, source);

  await expect(page.locator('#fa')).toHaveCSS('unicode-bidi', 'plaintext');
  await expect(page.locator('#en')).toHaveCSS('unicode-bidi', 'plaintext');
  await expect(page.locator('#mixed')).toHaveCSS('text-align', 'start');
  await expect(page.locator('#composer')).toHaveCSS('unicode-bidi', 'plaintext');
  await expect(page.locator('#code')).toHaveCSS('direction', 'ltr');
  await expect(page.locator('#terminal')).toHaveCSS('font-family', /Consolas/);
  await expect(page.locator('#outside')).not.toHaveCSS('unicode-bidi', 'plaintext');

  const loadedFonts = await page.evaluate(async () => {
    const faces = await document.fonts.load('400 16px Vazirmatn', 'سلام دنیا');
    return {
      family: getComputedStyle(document.querySelector('#fa')!).fontFamily,
      loaded: faces.some((face) => face.family === 'Vazirmatn'),
      available: document.fonts.check('400 16px Vazirmatn', 'سلام دنیا'),
    };
  });
  expect(loadedFonts.family).toContain('Vazirmatn');
  expect(loadedFonts.loaded).toBe(true);
  expect(loadedFonts.available).toBe(true);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#fa' });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  expect(fonts.some((font: { familyName: string; isCustomFont: boolean; glyphCount: number }) =>
    font.familyName === 'Vazirmatn' && font.isCustomFont && font.glyphCount > 0)).toBe(true);

  const initialCounts = await page.evaluate(({ styleId, observerKey }) => {
    const host = document.querySelector('#existing-plan')!;
    return {
      documentStyles: [...document.querySelectorAll('style')].filter((style) => style.id === styleId).length,
      shadowStyles: [...host.shadowRoot!.querySelectorAll('style')].filter((style) => style.id === styleId).length,
      observerIsMutationObserver: window[observerKey] instanceof MutationObserver,
    };
  }, { styleId: STYLE_ID, observerKey: OBSERVER_KEY });
  expect(initialCounts).toEqual({ documentStyles: 1, shadowStyles: 1, observerIsMutationObserver: true });

  const sameObserverAfterReinstall = await page.evaluate(({ script, observerKey }) => {
    const existing = window[observerKey];
    (0, eval)(script);
    return existing === window[observerKey];
  }, { script: source, observerKey: OBSERVER_KEY });
  expect(sameObserverAfterReinstall).toBe(true);

  await page.evaluate(() => {
    const paragraph = document.createElement('p');
    paragraph.id = 'appended-prose';
    paragraph.className = 'prose';
    paragraph.textContent = 'متن تازه با API 42';
    document.querySelector('#messages')!.append(paragraph);

    const host = document.createElement('div');
    host.id = 'new-plan';
    host.setAttribute('data-plan-root', '');
    host.attachShadow({ mode: 'open' }).innerHTML = '<p id="new-shadow-prose" class="prose">پلن تازه</p>';
    document.querySelector('#messages')!.append(host);
  });

  await expect(page.locator('#appended-prose')).toHaveCSS('unicode-bidi', 'plaintext');
  await expect(page.locator('#new-plan').locator('#new-shadow-prose')).toHaveCSS('unicode-bidi', 'plaintext');
  await expect.poll(() => page.evaluate(({ styleId }) => {
    const root = document.querySelector('#new-plan')!.shadowRoot!;
    return [...root.querySelectorAll('style')].filter((style) => style.id === styleId).length;
  }, { styleId: STYLE_ID })).toBe(1);

  const screenshotDirectory = path.resolve('output/rtl-audit');
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDirectory, 'rtl-rendering.png'), fullPage: true });
  await cdp.detach();
});
