import assert from 'node:assert/strict';
import test from 'node:test';
import { CSS_TEXT, injectSource } from '../apps/OpenCode/style.mjs';

test('OpenCode styles target observed message surfaces and protect code', () => {
  assert.match(CSS_TEXT, /data-component="markdown"/);
  assert.match(CSS_TEXT, /data-slot="user-message-text"/);
  assert.match(CSS_TEXT, /unicode-bidi:plaintext/);
  assert.match(CSS_TEXT, /font-family:'Vazirmatn'/);
  assert.match(CSS_TEXT, /direction:ltr/);
  assert.doesNotThrow(() => new Function(injectSource('')));
});
