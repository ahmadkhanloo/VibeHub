// Qoder RTL — single source of truth for the stylesheet.
// Shared by injector.mjs (page injection) and doctor.mjs (verification).
//
// Strategy: `unicode-bidi: plaintext` makes each text block pick its own
// direction from its first strong character, so Persian renders RTL and
// English/paths inside the same message stay LTR. Code, terminal, editor,
// file tree and tab strips are carved out with !important so they keep LTR.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildAutoHeadingDirectionScript, DIRECTION_ALIGNMENT_CSS } from '../rtl-direction.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const PROSE = `
:is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary,legend,label)
,[class*="whitespace-pre-wrap"]:not(pre):not(code)
,[class*="markdown"]:not(code):not(pre) :is(div,span,a,b,strong,em,sub,sup)
,[class*="prose"]:not(code):not(pre) :is(div,span,a,b,strong,em)
,[class*="message"]:not(code):not(pre) :is(div,span)
,[class*="chat"]:not(code):not(pre) :is(div,span)
`;

const COMPOSER = `
textarea:not([class*="code"]),[contenteditable="true"]:not([class*="code"])
`;

const GUARD = `
:is(pre,code,kbd,samp,var,output)
,:is(pre,code,kbd,samp,var,output) *
,:is([class*="xterm"],[class*="terminal"],.monaco-editor,[class^="editor-"],[class*=" editor-"],[class*="tree-view"],[class*="sidebar"],[role="tablist"],[role="tab"],[role="menubar"],[role="toolbar"])
,:is([class*="xterm"],[class*="terminal"],.monaco-editor,[class^="editor-"],[class*=" editor-"],[class*="tree-view"],[class*="sidebar"],[role="tablist"],[role="tab"],[role="menubar"],[role="toolbar"]) *
`;

// An older document-start script can survive a Qoder reload while upgrading.
// Keep the current task composer RTL even if that stale broad editor guard runs last.
const COMPOSER_UPGRADE_OVERRIDE = `
.loop-rich-editor[contenteditable="true"][role="textbox"]
`;

const FONT_STACK = `'Vazirmatn','Vazirmatn RTL',Tahoma,'Segoe UI',sans-serif`;

let fontCssCache = null;

function fontFaceCss() {
  if (fontCssCache !== null) return fontCssCache;
  const faces = [
    ['Vazirmatn-Regular.woff2', 400],
    ['Vazirmatn-Bold.woff2', 700],
  ];
  const parts = [];
  for (const [file, weight] of faces) {
    let b64;
    try {
      b64 = readFileSync(join(HERE, 'assets', file)).toString('base64');
    } catch {
      fontCssCache = ''; // fonts missing: bidi fix must survive without them
      return fontCssCache;
    }
    parts.push(
      `@font-face{font-family:'Vazirmatn';font-style:normal;font-weight:${weight};` +
        `font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');` +
        `unicode-range:U+0600-06FF,U+FB80-FBFF,U+FE70-FEFF,U+200C;}`
    );
  }
  fontCssCache = parts.join('\n');
  return fontCssCache;
}

export function buildCss({ font = true } = {}) {
  const rules = [
    `${PROSE}{unicode-bidi:plaintext;text-align:start}`,
    `${COMPOSER}{unicode-bidi:plaintext;text-align:start}`,
    `${GUARD}{unicode-bidi:isolate!important;text-align:initial!important}`,
    `${COMPOSER_UPGRADE_OVERRIDE}{unicode-bidi:plaintext!important;text-align:start!important;font-family:${FONT_STACK}!important}`,
  ];
  if (font) {
    const ff = fontFaceCss();
    if (ff) {
      rules.unshift(ff);
      rules.push(`${PROSE},${COMPOSER}{font-family:${FONT_STACK}}`);
      rules.push(`${GUARD}{font-family:revert!important}`);
    }
  }
  rules.push(DIRECTION_ALIGNMENT_CSS);
  return rules.join('\n');
}

export const STYLE_ID = 'qoder-rtl-fix-v4';

// Runs in the page. Constructed stylesheet + <style> twin: a CSSOM-built sheet
// is not gated by `style-src`, and the <style> element keeps working on engines
// where adoptedStyleSheets is unavailable.
export function injectSource(css) {
  return `(() => {
  const ID = ${JSON.stringify(STYLE_ID)};
  const CSS = ${JSON.stringify(css)};
  ${buildAutoHeadingDirectionScript('qoder-rtl-heading-direction-v1')}
  const apply = () => {
    const root = document.head || document.documentElement;
    if (!root) return false;
    let sheet;
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      const kept = document.adoptedStyleSheets.filter((s) => s.__qoderRtl !== true);
      sheet.__qoderRtl = true;
      document.adoptedStyleSheets = [...kept, sheet];
    } catch (e) {}
    let el = document.getElementById(ID);
    if (!el) {
      el = document.createElement('style');
      el.id = ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = CSS;
    window.__qoderRtlEnabled = (on) => {
      el.disabled = !on;
      try {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
          (s) => s.__qoderRtl !== true || on
        );
      } catch (e) {}
    };
    return true;
  };
  if (apply()) return;
  document.addEventListener('readystatechange', apply, { once: true });
  if (!document.head) {
    new MutationObserver((m, o) => { if (apply()) o.disconnect(); }).observe(
      document.documentElement || document, { childList: true, subtree: true }
    );
  }
})();`;
}

export const CSS_TEXT = buildCss();
export const INJECT_JS = injectSource(CSS_TEXT);
