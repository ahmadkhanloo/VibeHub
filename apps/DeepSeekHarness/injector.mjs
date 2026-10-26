// Injects RTL rules into DeepSeek Harness through its local Chromium DevTools port.
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildAutoHeadingDirectionScript, DIRECTION_ALIGNMENT_CSS } from '../rtl-direction.mjs';

const PORT = Number(process.env.DEEPSEEK_HARNESS_RTL_PORT) || 9228;
const LOCK_PORT = PORT + 1;
const BASE = `http://127.0.0.1:${PORT}`;
const STYLE_ID = 'deepseek-harness-rtl-fix-v2';
const HERE = dirname(fileURLToPath(import.meta.url));

function fontCss() {
  const faces = [['Vazirmatn-Regular.woff2', 400], ['Vazirmatn-Bold.woff2', 700]];
  return faces.map(([name, weight]) => {
    const data = readFileSync(join(HERE, 'assets', name)).toString('base64');
    return `@font-face{font-family:'Vazirmatn';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:U+0600-06FF,U+FB80-FBFF,U+FE70-FEFF,U+200C;}`;
  }).join('\n');
}

const CSS = `${fontCss()}
${DIRECTION_ALIGNMENT_CSS}
:is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary),
[class*="_markdown_"] :is(div,span,a,b,strong,em),
[class*="bubble"] :is(div,span),
[data-composer-input="true"] {
  unicode-bidi: plaintext;
  text-align: start;
  font-family: 'Vazirmatn', Tahoma, 'Segoe UI', sans-serif;
}
:is(pre,code,kbd,samp,var,output),
:is(pre,code,kbd,samp,var,output) *,
:is([class*="terminal"],[class*="editor"],[role="tablist"],[role="tab"]) {
  unicode-bidi: isolate !important;
  direction: ltr !important;
  text-align: initial !important;
  font-family: revert !important;
}`;

const INJECT = `(() => {
  const id = ${JSON.stringify(STYLE_ID)};
  const css = ${JSON.stringify(CSS)};
  ${buildAutoHeadingDirectionScript('deepseek-harness-rtl-heading-direction-v1')}
  const apply = () => {
    const root = document.head || document.documentElement;
    if (!root) return false;
    let style = document.getElementById(id);
    if (!style) { style = document.createElement('style'); style.id = id; root.appendChild(style); }
    style.textContent = css;
    return true;
  };
  if (!apply()) document.addEventListener('DOMContentLoaded', apply, { once: true });
})();`;

const lock = createServer();
lock.once('error', () => {
  console.log('[deepseek-harness-rtl] injector already running, exiting.');
  process.exit(0);
});
lock.listen(LOCK_PORT, '127.0.0.1');

const attached = new Set();
let nextId = 1;

function connect(wsUrl, onMessage) {
  const ws = new WebSocket(wsUrl);
  ws.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    onMessage(message);
  });
  return new Promise((resolve) => {
    ws.addEventListener('open', () => resolve(ws), { once: true });
    ws.addEventListener('error', () => resolve(null), { once: true });
  });
}

async function pageTargets() {
  try {
    const response = await fetch(`${BASE}/json/list`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return [];
    return (await response.json()).filter((target) =>
      target.type === 'page' && target.webSocketDebuggerUrl && target.url.startsWith('dsh-app://app/'));
  } catch {
    return [];
  }
}

async function attach(target) {
  if (attached.has(target.id)) return;
  attached.add(target.id);
  const pending = new Map();
  const ws = await connect(target.webSocketDebuggerUrl, (message) => {
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  if (!ws) { attached.delete(target.id); return; }
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.addEventListener('close', () => attached.delete(target.id));
  await send('Page.enable');
  await send('Runtime.evaluate', { expression: INJECT });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT });
  console.log(`[deepseek-harness-rtl] injected ${target.title || target.url}`);
}

function watchBrowser(wsUrl) {
  return new Promise(async (resolve) => {
    const ws = await connect(wsUrl, (message) => {
      if (message.method === 'Target.targetCreated') {
        const target = message.params?.targetInfo;
        if (target?.type === 'page' && target.url?.startsWith('dsh-app://app/')) {
          attach({ id: target.targetId, title: target.title, url: target.url,
            webSocketDebuggerUrl: `${BASE}/devtools/page/${target.targetId}` });
        }
      }
    });
    if (!ws) { resolve(); return; }
    ws.addEventListener('close', resolve, { once: true });
    const id = nextId++;
    ws.send(JSON.stringify({ id, method: 'Target.setDiscoverTargets', params: { discover: true } }));
  });
}

console.log(`[deepseek-harness-rtl] waiting on port ${PORT}`);
setInterval(async () => {
  for (const target of await pageTargets()) await attach(target);
}, 2000);

for (;;) {
  try {
    const response = await fetch(`${BASE}/json/version`, { signal: AbortSignal.timeout(2000) });
    const info = response.ok ? await response.json() : null;
    if (info?.webSocketDebuggerUrl) await watchBrowser(info.webSocketDebuggerUrl);
  } catch (error) {
    console.log('[deepseek-harness-rtl] connection error:', error.message);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
