import { buildScopedDirectionAlignmentCss } from '../rtl-direction.mjs';
import { buildIdempotentStyleSource, buildScopedTextCss, embedVazirmatnFonts } from '../rtl-style.mjs';

// Claude serves its conversation renderer from claude.ai. Keep the candidate
// rules under main and keep code, terminal and editor surfaces LTR. The
// adapter stays disabled until compatibility.json records a live chat check.
export const PROSE_ROOTS = ['main'];
const TEXT_BLOCKS = ':is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary)';
const CODE_SURFACES = ':is(pre,code,kbd,samp,var,output,[role="terminal"],[data-testid*="terminal" i],[class*="xterm" i],.monaco-editor,[class*="code-block" i])';
const MAIN_TEXT = ':not(:where(pre *,code *,kbd *,samp *,var *,output *,[role="terminal"] *,[data-testid*="terminal" i] *,[class*="xterm" i] *, .monaco-editor *,[class*="code-block" i] *))';

export const STYLE_ID = 'vibehub-claude-rtl-v1';
export const OBSERVER_KEY = '__vibehubClaudeRtlStyleObserver';
export const PROSE_SELECTORS = [
  `main article ${TEXT_BLOCKS}${MAIN_TEXT}`,
  `main [data-testid*="message" i] ${TEXT_BLOCKS}${MAIN_TEXT}`,
];
export const COMPOSER_SELECTORS = [
  'main [contenteditable="true"][role="textbox"]',
  'main textarea:not([aria-label*="search" i])',
];
export const GUARD_SELECTORS = [`main ${CODE_SURFACES}`, `main ${CODE_SURFACES} *`];
export const AUTO_DIRECTION_SELECTOR = [...PROSE_SELECTORS, ...COMPOSER_SELECTORS].join(',');

const CSS_TEXT = [
  embedVazirmatnFonts(new URL('./assets/', import.meta.url)),
  buildScopedTextCss({
    prose: PROSE_SELECTORS,
    composers: COMPOSER_SELECTORS,
    guards: GUARD_SELECTORS,
  }),
  buildScopedDirectionAlignmentCss(PROSE_ROOTS),
].filter(Boolean).join('\n');

export function injectSource() {
  const managedSource = buildIdempotentStyleSource({
    styleId: STYLE_ID,
    css: CSS_TEXT,
    observerKey: OBSERVER_KEY,
    autoDirectionSelector: AUTO_DIRECTION_SELECTOR,
  });
  return `(() => {
  if (location.protocol !== 'https:' || location.hostname !== 'claude.ai') return;
  ${managedSource}
})();`;
}

export const INJECT_JS = injectSource();
export { CSS_TEXT };
