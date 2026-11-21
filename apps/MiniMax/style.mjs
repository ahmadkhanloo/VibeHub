import { buildScopedDirectionAlignmentCss } from '../rtl-direction.mjs';
import { buildIdempotentStyleSource, buildScopedTextCss, embedVazirmatnFonts } from '../rtl-style.mjs';

// Selectors observed in MiniMax Code 3.1.15 (app://./archon). Message bodies
// live in `.message-content` inside `[data-testid="chat-message-list"]` and
// render through `.matrix-markdown`; the composer is a TipTap ProseMirror
// editor under `[data-message-input-root]`. Keep the app's own component-level
// dir attributes (file paths, diff headers, model label) untouched: the
// installer only adds dir=auto where an element has no dir yet.
export const PROSE_ROOTS = ['[data-testid="chat-message-list"]', '.message-content'];
const TEXT_BLOCKS = ':is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary)';
const CODE_SURFACES = ':is(pre,code,kbd,samp,var,output,.code-block,.inline-code,[role="terminal"],[data-testid*="terminal" i],[class*="xterm" i],.monaco-editor)';
const OUTSIDE_CODE = ':not(:where(pre *,code *,kbd *,samp *,var *,output *,.code-block *,[role="terminal"] *,[data-testid*="terminal" i] *,[class*="xterm" i] *,.monaco-editor *))';

export const STYLE_ID = 'vibehub-minimax-rtl-v1';
export const OBSERVER_KEY = '__vibehubMiniMaxRtlStyleObserver';
export const PROSE_SELECTORS = [
  `[data-testid="chat-message-list"] ${TEXT_BLOCKS}${OUTSIDE_CODE}`,
  `.message-content ${TEXT_BLOCKS}${OUTSIDE_CODE}`,
  '.message-content',
  '.matrix-markdown',
];
export const COMPOSER_SELECTORS = [
  '[data-message-input-root] .ProseMirror[contenteditable="true"]',
  '[data-message-input-root] [contenteditable="true"][role="textbox"]',
  '[data-testid="message-input"] [contenteditable="true"]',
  '[data-testid="message-input"] textarea',
  '.mavis-message-input-card .ProseMirror[contenteditable="true"]',
];
export const GUARD_SELECTORS = [
  `.matrix-markdown ${CODE_SURFACES}`,
  `.matrix-markdown ${CODE_SURFACES} :not([dir])`,
  `.message-content ${CODE_SURFACES}`,
  `.message-content ${CODE_SURFACES} :not([dir])`,
];
export const AUTO_DIRECTION_SELECTOR = [...PROSE_ROOTS, ...PROSE_SELECTORS, ...COMPOSER_SELECTORS].join(',');

const CODE_FONT_CSS = `${GUARD_SELECTORS.join(',')} { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace!important; }`;
const CSS_TEXT = [
  embedVazirmatnFonts(new URL('./assets/', import.meta.url)),
  buildScopedTextCss({
    prose: PROSE_SELECTORS,
    composers: COMPOSER_SELECTORS,
    guards: GUARD_SELECTORS,
  }),
  CODE_FONT_CSS,
  buildScopedDirectionAlignmentCss(PROSE_ROOTS),
].filter(Boolean).join('\n');

export function injectSource() {
  return buildIdempotentStyleSource({
    styleId: STYLE_ID,
    css: CSS_TEXT,
    observerKey: OBSERVER_KEY,
    autoDirectionSelector: AUTO_DIRECTION_SELECTOR,
  });
}

export const INJECT_JS = injectSource();
export { CSS_TEXT };
