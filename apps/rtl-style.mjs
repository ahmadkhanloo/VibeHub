import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FONT_FILES = [
  ['Vazirmatn-Regular.woff2', 400],
  ['Vazirmatn-Bold.woff2', 700],
];

function assetPath(assetDirectory, fileName) {
  if (assetDirectory instanceof URL) {
    if (assetDirectory.protocol !== 'file:') throw new TypeError('Vazirmatn assets must be local files');
    const directory = assetDirectory.href.endsWith('/') ? assetDirectory : new URL(`${assetDirectory.href}/`);
    return fileURLToPath(new URL(fileName, directory));
  }
  if (typeof assetDirectory !== 'string' || !assetDirectory.trim()) {
    throw new TypeError('assetDirectory must be a local path or file URL');
  }
  return path.join(path.resolve(assetDirectory), fileName);
}

export function embedVazirmatnFonts(assetDirectory) {
  return FONT_FILES.map(([fileName, weight]) => {
    const font = readFileSync(assetPath(assetDirectory, fileName)).toString('base64');
    return `@font-face{font-family:'Vazirmatn';src:url(data:font/woff2;base64,${font}) format('woff2');font-style:normal;font-weight:${weight};font-display:swap}`;
  }).join('\n');
}

function selectors(values) {
  const list = Array.isArray(values) ? values : typeof values === 'string' ? [values] : [];
  return [...new Set(list.map((selector) => String(selector).trim()).filter(Boolean))];
}

export function buildScopedTextCss({ prose = [], composers = [], guards = [], family = 'Vazirmatn' } = {}) {
  const textSelectors = [...new Set([...selectors(prose), ...selectors(composers)])];
  const protectedSelectors = selectors(guards);
  const quotedFamily = `'${String(family).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
  const rules = [];

  if (textSelectors.length) {
    rules.push(`${textSelectors.join(',')} { font-family:${quotedFamily},system-ui,sans-serif!important; unicode-bidi:plaintext!important; text-align:start!important; }`);
  }
  if (protectedSelectors.length) {
    rules.push(`${protectedSelectors.join(',')} { direction:ltr!important; unicode-bidi:isolate!important; text-align:initial!important; }`);
  }
  return rules.join('\n');
}

export function buildIdempotentStyleSource({
  styleId,
  css,
  observerKey,
  autoHeadingSelector,
  autoDirectionSelector,
  shadowHostSelectors = [],
} = {}) {
  if (typeof styleId !== 'string' || !styleId.trim()) throw new TypeError('styleId is required');
  if (typeof observerKey !== 'string' || !observerKey.trim()) throw new TypeError('observerKey is required');

  const shadowSelectors = selectors(shadowHostSelectors);
  const directionSelectors = [...new Set([
    ...selectors(autoHeadingSelector),
    ...selectors(autoDirectionSelector),
  ])];
  return `(() => {
  const STYLE_ID = ${JSON.stringify(styleId)};
  const CSS_TEXT = ${JSON.stringify(String(css ?? ''))};
  const OBSERVER_KEY = ${JSON.stringify(observerKey)};
  const SHADOW_HOST_SELECTORS = ${JSON.stringify(shadowSelectors)};
  const AUTO_DIRECTION_SELECTOR = ${JSON.stringify(directionSelectors.join(','))};
  const INSTALLER_SIGNATURE = JSON.stringify({
    styleId: STYLE_ID,
    css: CSS_TEXT,
    shadowHostSelectors: SHADOW_HOST_SELECTORS,
    autoDirectionSelector: AUTO_DIRECTION_SELECTOR,
  });

  const findStyle = (root) => {
    if (!root || typeof root.querySelectorAll !== 'function') return null;
    return [...root.querySelectorAll('style')].find((style) => style.id === STYLE_ID) || null;
  };
  const installStyle = (root) => {
    if (!root) return;
    const mount = root.nodeType === 9 ? (root.head || root.documentElement) : root;
    if (!mount) return;
    let style = findStyle(root);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS_TEXT;
      mount.appendChild(style);
    } else if (style.textContent !== CSS_TEXT) {
      style.textContent = CSS_TEXT;
    }
  };
  const markAutoDirections = (root) => {
    if (!AUTO_DIRECTION_SELECTOR || !root || typeof root.querySelectorAll !== 'function') return;
    const mark = (element) => {
      if (!element.hasAttribute('dir')) element.setAttribute('dir', 'auto');
    };
    if (root.nodeType === 1 && root.matches(AUTO_DIRECTION_SELECTOR)) mark(root);
    for (const element of root.querySelectorAll(AUTO_DIRECTION_SELECTOR)) mark(element);
  };
  const matchingHosts = (root) => {
    if (!root || typeof root.querySelectorAll !== 'function' || !SHADOW_HOST_SELECTORS.length) return [];
    const hosts = new Set();
    const matches = (element) => SHADOW_HOST_SELECTORS.some((selector) => element.matches(selector));
    if (root.nodeType === 1 && matches(root)) hosts.add(root);
    for (const selector of SHADOW_HOST_SELECTORS) {
      for (const host of root.querySelectorAll(selector)) hosts.add(host);
    }
    return [...hosts];
  };
  const installShadowRoots = (root, visited = new Set()) => {
    for (const host of matchingHosts(root)) {
      const shadowRoot = host.shadowRoot;
      if (!shadowRoot || visited.has(shadowRoot)) continue;
      visited.add(shadowRoot);
      installStyle(shadowRoot);
      markAutoDirections(shadowRoot);
      installShadowRoots(shadowRoot, visited);
    }
  };
  const installDocument = () => {
    installStyle(document);
    markAutoDirections(document);
    installShadowRoots(document);
  };

  installDocument();
  const previousObserver = window[OBSERVER_KEY];
  if (previousObserver && previousObserver.__vibehubInstallerSignature !== INSTALLER_SIGNATURE) {
    if (typeof previousObserver.disconnect === 'function') previousObserver.disconnect();
    delete window[OBSERVER_KEY];
  }
  if (!window[OBSERVER_KEY]) {
    const observer = new MutationObserver((records) => {
      installStyle(document);
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          markAutoDirections(node);
          installShadowRoots(node);
        }
      }
    });
    observer.observe(document, { childList: true, subtree: true });
    observer.__vibehubInstallerSignature = INSTALLER_SIGNATURE;
    window[OBSERVER_KEY] = observer;
  }
})();`;
}
