import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const assets = new URL('../apps/Qoder/assets/', import.meta.url);

test('embeds both local Vazirmatn weights', async () => {
  const { embedVazirmatnFonts } = await import('../apps/rtl-style.mjs');
  const css = embedVazirmatnFonts(assets);
  const regular = await readFile(new URL('Vazirmatn-Regular.woff2', assets));
  const bold = await readFile(new URL('Vazirmatn-Bold.woff2', assets));

  assert.match(css, /font-family:\s*['"]Vazirmatn['"]/i);
  assert.match(css, /font-weight:\s*400\b/);
  assert.match(css, /font-weight:\s*700\b/);
  assert.ok(css.includes(regular.toString('base64')));
  assert.ok(css.includes(bold.toString('base64')));
  assert.equal((css.match(/data:font\/woff2;base64,/g) ?? []).length, 2);
});

test('scopes plaintext bidi to supplied content selectors', async () => {
  const { buildScopedTextCss } = await import('../apps/rtl-style.mjs');
  const css = buildScopedTextCss({
    prose: ['#messages > article', '.plan-content'],
    composers: ['textarea[data-chat-input]'],
    guards: ['pre', 'code', '.monaco-editor', '.xterm'],
  });

  assert.match(css, /#messages\s*>\s*article/);
  assert.match(css, /\.plan-content/);
  assert.match(css, /textarea\[data-chat-input\]/);
  assert.match(css, /unicode-bidi:\s*plaintext/i);
  assert.match(css, /text-align:\s*start/i);
  assert.match(css, /font-family:\s*['"]?Vazirmatn/i);
  const protectedRule = css.match(/pre,code,\.monaco-editor,\.xterm\s*\{([^}]*)\}/i)?.[1] ?? '';
  assert.match(protectedRule, /direction:\s*ltr/i);
  assert.match(protectedRule, /unicode-bidi:\s*isolate/i);
  assert.match(protectedRule, /text-align:\s*initial/i);
  assert.doesNotMatch(protectedRule, /font-family\s*:/i);
  assert.doesNotMatch(css, /(?:^|[},\s])(?:html|body|\*)\s*\{/i);
});

test('generated style installer uses stable IDs and an observer key', async () => {
  const { buildIdempotentStyleSource } = await import('../apps/rtl-style.mjs');
  const source = buildIdempotentStyleSource({
    styleId: 'vibehub-rtl-test',
    css: '#messages{unicode-bidi:plaintext}',
    observerKey: '__vibehubRtlTestObserver',
    shadowHostSelectors: ['[data-plan-root]'],
  });

  assert.match(source, /vibehub-rtl-test/);
  assert.match(source, /__vibehubRtlTestObserver/);
  assert.match(source, /data-plan-root/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /ShadowRoot|shadowRoot/);
  assert.match(source, /document\.getElementById|querySelector/);
});
