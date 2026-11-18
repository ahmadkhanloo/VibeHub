import { buildScopedDirectionAlignmentCss } from '../rtl-direction.mjs';
import { buildIdempotentStyleSource, buildScopedTextCss, embedVazirmatnFonts } from '../rtl-style.mjs';

const TIMELINE = '[data-testid="v4-timeline"]';
const COMPOSER = '[data-testid="v4-composer-input"][contenteditable="true"][role="textbox"]';
const TEXT_BLOCKS = ':is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary)';
// Message surfaces own the paragraph direction, so Persian lines start on the right.
const DIRECTION_ROOTS = [
  `${TIMELINE} [data-testid*="user-message" i]`,
  `${TIMELINE} [data-testid*="message" i]`,
  `${TIMELINE} [class*="markdown"]`,
  `${TIMELINE} [class*="message-content"]`,
];

export const STYLE_ID = 'zcode-rtl-fix-v3';
export const OBSERVER_KEY = '__vibehubZCodeRtlStyleObserver';
export const AUTO_DIRECTION_SELECTOR = [
  ...DIRECTION_ROOTS,
  `${TIMELINE} ${TEXT_BLOCKS}`,
  COMPOSER,
  `${COMPOSER} ${TEXT_BLOCKS}`,
].join(',');

export const PROSE_SELECTORS = [`${TIMELINE} ${TEXT_BLOCKS}`];
export const COMPOSER_SELECTORS = [COMPOSER, `${COMPOSER} ${TEXT_BLOCKS}`];
export const GUARD_SELECTORS = [`${TIMELINE} :is(pre,code,kbd,samp,var,output)`];

export const CSS_TEXT = [
  embedVazirmatnFonts(new URL('./assets/', import.meta.url)),
  buildScopedTextCss({
    prose: PROSE_SELECTORS,
    composers: COMPOSER_SELECTORS,
    guards: GUARD_SELECTORS,
  }),
  buildScopedDirectionAlignmentCss(TIMELINE),
].filter(Boolean).join('\n');

const MANAGED_SOURCE = buildIdempotentStyleSource({
  styleId: STYLE_ID,
  css: CSS_TEXT,
  observerKey: OBSERVER_KEY,
  autoDirectionSelector: AUTO_DIRECTION_SELECTOR,
});

// Remove the observer used by the older ZCode stylesheet when an already-open
// renderer receives this version of the installer.
const LEGACY_HEADING_OBSERVER = 'zcode-rtl-heading-direction-v1';
export const INJECT_SOURCE = `(() => {
  const legacyObserver = window[${JSON.stringify(LEGACY_HEADING_OBSERVER)}];
  if (legacyObserver && typeof legacyObserver.disconnect === 'function') legacyObserver.disconnect();
  try { delete window[${JSON.stringify(LEGACY_HEADING_OBSERVER)}]; } catch {}
})();
${MANAGED_SOURCE}`;
