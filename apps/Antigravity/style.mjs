import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildScopedDirectionAlignmentCss } from '../rtl-direction.mjs';
import { buildIdempotentStyleSource, buildScopedTextCss, embedVazirmatnFonts } from '../rtl-style.mjs';

export const PROSE_ROOTS = ['[data-testid="planner-response-text"]', '[data-testid="user-input-step"]'];
const TEXT_BLOCKS = ':is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary)';
const CODE_DESCENDANT = ':not(:where(pre *,code *,kbd *,samp *,var *,output *,[role="terminal"] *, .monaco-editor *, .xterm *))';
const COMPOSER = '[data-lexical-editor="true"][aria-label="Message input"]';

export const STYLE_ID = 'vibehub-antigravity-rtl-v1';
export const OBSERVER_KEY = '__vibehubAntigravityRtlStyleObserver';
export const PROSE_SELECTORS = PROSE_ROOTS.flatMap((root) => [
  `${root} ${TEXT_BLOCKS}${CODE_DESCENDANT}`,
  `${root} div.whitespace-pre-wrap${CODE_DESCENDANT}`,
]);
export const COMPOSER_SELECTORS = [COMPOSER, `${COMPOSER} ${TEXT_BLOCKS}`];
export const GUARD_SELECTORS = [
  ...PROSE_ROOTS.map((root) => `${root} :is(pre,code,kbd,samp,var,output,[role="terminal"],.monaco-editor,.xterm)`),
  `${COMPOSER} :is(pre,code,kbd,samp,var,output)`,
];
export const AUTO_DIRECTION_SELECTOR = [...PROSE_SELECTORS, ...COMPOSER_SELECTORS].join(',');

function fontAssetDirectory() {
  // The launcher starts the injector in this adapter folder. The repository
  // fallback keeps direct development and tests independent of the shell cwd.
  const localAssets = path.resolve(process.cwd(), 'assets');
  if (existsSync(path.join(localAssets, 'Vazirmatn-Regular.woff2'))) return localAssets;
  return path.resolve(process.cwd(), 'apps', 'Antigravity', 'assets');
}

const FONT_CSS = embedVazirmatnFonts(fontAssetDirectory());
const BODY_CSS = [
  buildScopedTextCss({
    prose: PROSE_SELECTORS,
    composers: COMPOSER_SELECTORS,
    guards: GUARD_SELECTORS,
  }),
  buildScopedDirectionAlignmentCss(PROSE_ROOTS),
].filter(Boolean).join('\n');

export const CSS_TEXT = [FONT_CSS, BODY_CSS].filter(Boolean).join('\n');
const LEGACY_OBSERVER_KEY = '__vibehubAntigravityRtl';

export function injectSource(fontFaces = FONT_CSS) {
  const managedSource = buildIdempotentStyleSource({
    styleId: STYLE_ID,
    css: [fontFaces, BODY_CSS].filter(Boolean).join('\n'),
    observerKey: OBSERVER_KEY,
    autoDirectionSelector: AUTO_DIRECTION_SELECTOR,
  });
  return `(() => {
  const boot = () => {
    if (!window.__APP_CONFIG__ || window.__APP_CONFIG__.productName !== 'antigravity') return;
    const legacyCleanup = window[${JSON.stringify(LEGACY_OBSERVER_KEY)}];
    if (typeof legacyCleanup === 'function') legacyCleanup();
    ${managedSource}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();`;
}

export const INJECT_JS = injectSource();
