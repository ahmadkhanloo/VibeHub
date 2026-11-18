import { buildScopedDirectionAlignmentCss } from '../rtl-direction.mjs';
import { buildIdempotentStyleSource, buildScopedTextCss, embedVazirmatnFonts } from '../rtl-style.mjs';

const MARKDOWN_ROOT = '[class*="_markdown_"]';
const TEXT_BLOCKS = ':is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary)';
// User prompts are rendered as inline plain-text runs, not as markdown blocks, so
// they need their own selectors; the composer keeps the pre-send contract.
const USER_TEXT = '[data-slot="conversation.user.text.node"]';
const USER_ROOT = `[class*="_bubble_"]`;
const RUN_TEXT = '[class*="_plainRun_"]';
const NON_PROSE_DESCENDANT = ':not(:where(pre *,code *,kbd *,samp *,var *,output *,[data-terminal] *,[data-diff] *,[data-read] *,[data-search] *))';
const COMPOSER = '[data-composer-input="true"][contenteditable="true"][role="textbox"]';
// Content containers whose own direction decides where each line starts. Without
// an RTL container, `text-align:start` leaves Persian lines hanging on the left.
export const PROSE_ROOTS = [USER_ROOT, MARKDOWN_ROOT];

export const STYLE_ID = 'deepseek-harness-rtl-fix-v3';
export const OBSERVER_KEY = '__vibehubDeepSeekHarnessRtlStyleObserver';
export const PROSE_SELECTORS = [
  `${MARKDOWN_ROOT} ${TEXT_BLOCKS}${NON_PROSE_DESCENDANT}`,
  `${USER_ROOT} ${USER_TEXT}`,
  `${USER_ROOT} ${RUN_TEXT}`,
];
export const COMPOSER_SELECTORS = [COMPOSER, `${COMPOSER} ${TEXT_BLOCKS}`];
export const GUARD_SELECTORS = [
  `${MARKDOWN_ROOT} :is(pre,code,kbd,samp,var,output,[data-terminal],[data-diff],[data-read],[data-search])`,
  `${MARKDOWN_ROOT} :is(pre,code,kbd,samp,var,output) *`,
];
export const AUTO_DIRECTION_SELECTOR = [
  ...PROSE_ROOTS,
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

// Retire the heading-only observer from the first-generation installer.
const LEGACY_OBSERVERS = ['deepseek-harness-rtl-heading-direction-v1'];
export const INJECT_SOURCE = `(() => {
  for (const key of ${JSON.stringify(LEGACY_OBSERVERS)}) {
    const legacy = window[key];
    if (legacy && typeof legacy.disconnect === 'function') legacy.disconnect();
    try { delete window[key]; } catch {}
  }
})();
${MANAGED_SOURCE}`;
