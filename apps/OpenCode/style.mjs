// Selectors observed in OpenCode desktop 2.2.5.
export const STYLE_ID = 'vibehub-opencode-rtl-v1';
export const CSS_TEXT = `
:is([data-component="markdown"],[data-slot="user-message-text"]) :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th),
[data-slot="user-message-text"], [data-component="composer-editor"][contenteditable="true"] { unicode-bidi:plaintext!important;text-align:start!important;font-family:'Vazirmatn',Tahoma,sans-serif!important }
:is([data-component="markdown"],[data-slot="user-message-text"]) :is(pre,code,kbd,samp),
:is([data-component="markdown"],[data-slot="user-message-text"]) :is(pre,code,kbd,samp) * { direction:ltr!important;unicode-bidi:isolate!important;text-align:left!important;font-family:revert!important }
`;
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
