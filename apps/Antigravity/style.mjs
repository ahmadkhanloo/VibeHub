// Selectors observed in the standalone Antigravity 2.24 frontend.
// Do not target the IDE, browser previews, artifact editors or terminal surfaces.
export const PROSE = '[data-testid="planner-response-text"], [data-testid="user-input-step"]';
export const INPUT = '[data-lexical-editor="true"][aria-label="Message input"]';
export const STYLE_ID = 'vibehub-antigravity-rtl-v1';
export const CSS_TEXT = `
:is(${PROSE}) :is(p,li,h1,h2,h3,h4,h5,h6,blockquote),
:is(${PROSE}) .whitespace-pre-wrap,
${INPUT}, ${INPUT} p { unicode-bidi:plaintext!important; text-align:start!important }
:is(${PROSE}) :is(pre,code,kbd,samp,[role="terminal"],.monaco-editor),
${INPUT} code { direction:ltr!important; unicode-bidi:isolate!important; text-align:left!important }
:is(${PROSE}) :is(td,th) { text-align:center!important }
`;

export const INJECT_JS = `(() => {
  const boot = () => {
  if (!window.__APP_CONFIG__ || window.__APP_CONFIG__.productName !== 'antigravity') return;
  const KEY = '__vibehubAntigravityRtl';
  if (window[KEY]) return;
  const PROSE = ${JSON.stringify(PROSE)};
  const INPUT = ${JSON.stringify(INPUT)};
  const BLOCKS = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,.whitespace-pre-wrap';
  const EXCLUDE = 'pre,code,kbd,samp,[role="terminal"],.monaco-editor';
  const mark = (el) => {
    if (el.closest(EXCLUDE)) return;
    if (!el.hasAttribute('data-vh-ag-dir')) {
      el.setAttribute('data-vh-ag-dir', el.getAttribute('dir') ?? '');
      el.setAttribute('dir', 'auto');
    }
  };
  const visit = (node) => {
    if (node.nodeType !== 1) return;
    if (node.matches(INPUT) || (node.matches(BLOCKS) && node.closest(PROSE + ',' + INPUT))) mark(node);
    for (const el of node.querySelectorAll(INPUT + ',:is(' + PROSE + ') :is(' + BLOCKS + '),' + INPUT + ' p')) mark(el);
    // Added paragraphs inside an existing message do not contain their scope root.
    if (node.closest(PROSE + ',' + INPUT)) for (const el of node.querySelectorAll(BLOCKS)) mark(el);
  };
  const start = () => {
    if (!document.documentElement) return;
    const style = document.createElement('style');
    style.id = ${JSON.stringify(STYLE_ID)};
    style.textContent = ${JSON.stringify(CSS_TEXT)};
    (document.head || document.documentElement).appendChild(style);
    visit(document.documentElement);
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) visit(node);
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    window[KEY] = () => {
      observer.disconnect(); style.remove();
      for (const el of document.querySelectorAll('[data-vh-ag-dir]')) {
        const old = el.getAttribute('data-vh-ag-dir');
        old ? el.setAttribute('dir', old) : el.removeAttribute('dir');
        el.removeAttribute('data-vh-ag-dir');
      }
      delete window[KEY];
    };
  };
  start();
  };
  // New-document CDP scripts run before Antigravity sets __APP_CONFIG__.
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot, {once:true}) : boot();
})();`;
