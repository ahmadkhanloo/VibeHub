// Selectors observed in OpenCode desktop 2.2.5.
import { buildScopedTextCss } from '../rtl-style.mjs';

export const STYLE_ID = 'vibehub-opencode-rtl-v1';
// The element that holds a typed prompt is a direction root: its own direction
// decides whether start-aligned lines hug the right. Inline code inside it stays
// LTR through its own dir attribute or the isolate guard.
const PROSE_ROOTS = ['[data-component="markdown"]', '[data-slot="user-message-text"]'];
const GUARD_SELECTORS = [
  `${PROSE_ROOTS[0]} :is(pre,code,kbd,samp)`,
  `${PROSE_ROOTS[0]} :is(pre,code,kbd,samp) *`,
];

export const CSS_TEXT = buildScopedTextCss({
  prose: [
    `${PROSE_ROOTS[0]} :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th)`,
    PROSE_ROOTS[1],
  ],
  composers: ['[data-component="composer-editor"][contenteditable="true"]'],
  guards: GUARD_SELECTORS,
});

export function injectSource(fontFaces = '') {
  return `(() => {
    const id = ${JSON.stringify(STYLE_ID)};
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = ${JSON.stringify(CSS_TEXT + fontFaces)};
    (document.head || document.documentElement).appendChild(style);
  })();`;
}
