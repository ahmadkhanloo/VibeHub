import { buildScopedDirectionAlignmentCss } from '../rtl-direction.mjs';
import { buildIdempotentStyleSource, buildScopedTextCss, embedVazirmatnFonts } from '../rtl-style.mjs';

const MARKDOWN_ROOT = '[class*="_markdown_"]';
const TEXT_BLOCKS = ':is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary)';
const NON_PROSE_DESCENDANT = ':not(:where(pre *,code *,kbd *,samp *,var *,output *,[data-terminal] *,[data-diff] *,[data-read] *,[data-search] *))';
const COMPOSER = '[data-composer-input="true"][contenteditable="true"][role="textbox"]';

export const STYLE_ID = 'deepseek-harness-rtl-fix-v2';
export const OBSERVER_KEY = '__vibehubDeepSeekHarnessRtlStyleObserver';
export const PROSE_SELECTORS = [`${MARKDOWN_ROOT} ${TEXT_BLOCKS}${NON_PROSE_DESCENDANT}`];
export const COMPOSER_SELECTORS = [COMPOSER, `${COMPOSER} ${TEXT_BLOCKS}`];
export const GUARD_SELECTORS = [
  `${MARKDOWN_ROOT} :is(pre,code,kbd,samp,var,output,[data-terminal],[data-diff],[data-read],[data-search])`,
];
export const AUTO_DIRECTION_SELECTOR = [
  ...PROSE_SELECTORS,
  ...COMPOSER_SELECTORS,
].join(',');

export const CSS_TEXT = [
  embedVazirmatnFonts(new URL('./assets/', import.meta.url)),
  buildScopedTextCss({
    prose: PROSE_SELECTORS,
    composers: COMPOSER_SELECTORS,
    guards: GUARD_SELECTORS,
  }),
  buildScopedDirectionAlignmentCss(MARKDOWN_ROOT),
].filter(Boolean).join('\n');

const MANAGED_SOURCE = buildIdempotentStyleSource({
  styleId: STYLE_ID,
  css: CSS_TEXT,
  observerKey: OBSERVER_KEY,
  autoDirectionSelector: AUTO_DIRECTION_SELECTOR,
});

// Remove the old heading-only observer from already-open renderer pages.
const LEGACY_HEADING_OBSERVER = 'deepseek-harness-rtl-heading-direction-v1';
export const INJECT_SOURCE = `(() => {
  const legacyObserver = window[${JSON.stringify(LEGACY_HEADING_OBSERVER)}];
  if (legacyObserver && typeof legacyObserver.disconnect === 'function') legacyObserver.disconnect();
  try { delete window[${JSON.stringify(LEGACY_HEADING_OBSERVER)}]; } catch {}
})();
${MANAGED_SOURCE}`;
