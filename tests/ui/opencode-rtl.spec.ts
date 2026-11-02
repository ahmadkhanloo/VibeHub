import { test, expect } from '@playwright/test';
import { injectSource, STYLE_ID } from '../../apps/OpenCode/style.mjs';

test('OpenCode prose uses bidi while code remains LTR and injection stays idempotent', async ({ page }) => {
  await page.setContent('<div data-component="markdown"><p id="prose">سلام API</p><pre><code id="code">let a = 1;</code></pre></div><div id="input" data-component="composer-editor" contenteditable="true">سلام</div><div id="outside">سلام</div>');
  await page.evaluate(source => { (0, eval)(source); (0, eval)(source); }, injectSource());
  await expect(page.locator('#prose')).toHaveCSS('unicode-bidi', 'plaintext');
  await expect(page.locator('#code')).toHaveCSS('direction', 'ltr');
  await expect(page.locator('#input')).toHaveCSS('unicode-bidi', 'plaintext');
  await expect(page.locator('#outside')).not.toHaveCSS('unicode-bidi', 'plaintext');
  await expect(page.locator(`#${STYLE_ID}`)).toHaveCount(1);
});
