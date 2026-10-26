// Shared by the desktop and standalone RTL launchers.
// `dir=auto` lets the browser resolve each heading's text direction from its
// first strong character, including headings added after the initial load.
export const DIRECTION_ALIGNMENT_CSS = `
:is(h1,h2,h3,h4,h5,h6):dir(rtl){text-align:right!important}
:is(h1,h2,h3,h4,h5,h6):dir(ltr){text-align:left!important}
:is(td,th){text-align:center!important}
:is(td,th) :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,div,span,a,b,strong,em){text-align:center!important}
:is(td,th) :is(h1,h2,h3,h4,h5,h6):dir(rtl){text-align:center!important}
:is(td,th) :is(h1,h2,h3,h4,h5,h6):dir(ltr){text-align:center!important}
`;

export function buildAutoHeadingDirectionScript(observerKey) {
  return `(() => {
  const KEY = ${JSON.stringify(observerKey)};
  if (window[KEY]) return;
  const mark = (root) => {
    if (!root || root.nodeType !== 1) return;
    const addAutoDirection = (heading) => {
      if (!heading.hasAttribute('dir')) heading.setAttribute('dir', 'auto');
    };
    if (/^H[1-6]$/.test(root.tagName)) addAutoDirection(root);
    for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) addAutoDirection(heading);
  };
  mark(document.documentElement);
  const observer = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) mark(node);
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true });
  window[KEY] = observer;
})();`;
}
