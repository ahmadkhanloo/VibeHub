// ZCode RTL — injects an RTL-friendly stylesheet into ZCode (Electron) via CDP.
// Each block (p, li, headings, ...) gets `unicode-bidi: plaintext`, so its
// direction follows its first strong character: Persian -> RTL, English -> LTR.
// Code blocks (pre/code) are excluded on purpose so they stay LTR.

import { createServer } from 'node:net';
import { buildAutoHeadingDirectionScript, DIRECTION_ALIGNMENT_CSS } from '../rtl-direction.mjs';

const PORT = Number(process.env.ZCODE_RTL_PORT) || 9222; // Chromium DevTools port ZCode is started with
const LOCK_PORT = PORT + 1; // ensures only one injector instance runs
const POLL_MS = 2000;   // safety-net sweep; new windows are injected in real time (see watchBrowser)

const CSS = `
${DIRECTION_ALIGNMENT_CSS}
:is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,summary),
textarea,
[contenteditable="true"],
[class*="whitespace-pre-wrap"]:not(pre):not(code) {
  unicode-bidi: plaintext;
  text-align: start;
}
`;

const INJECT_SOURCE = `(() => {
  const ID = 'zcode-rtl-fix-v2';
  const CSS = ${JSON.stringify(CSS)};
  ${buildAutoHeadingDirectionScript('zcode-rtl-heading-direction-v1')}
  const add = () => {
    if (document.getElementById(ID)) return;
    const s = document.createElement('style');
    s.id = ID;
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  };
  if (document.head) add();
  else document.addEventListener('DOMContentLoaded', add, { once: true });
})();`;

// Keep the app-specific lock bound for this process lifetime.
const lock = createServer();
lock.once('error', () => {
  console.log('[zcode-rtl] injector already running, exiting.');
  process.exit(0);
});
lock.listen(LOCK_PORT, '127.0.0.1');

const injected = new Set();

async function listPages() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    if (!res.ok) return [];
    const targets = await res.json();
    return targets.filter(
      (t) => t.type === 'page' && t.webSocketDebuggerUrl && !t.url.startsWith('devtools://'),
    );
  } catch {
    return []; // app not started (yet) via the RTL shortcut
  }
}

function attach(target) {
  return new Promise((resolve) => {
    injected.add(target.id); // immediately, so parallel callers never double-attach
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let nextId = 1;
    const pending = new Map();
    const send = (method, params = {}) =>
      new Promise((res) => {
        const id = nextId++;
        pending.set(id, res);
        ws.send(JSON.stringify({ id, method, params }));
      });

    ws.addEventListener('open', async () => {
      try {
        await send('Page.enable');
        await send('Runtime.evaluate', { expression: INJECT_SOURCE });
        // survives page reloads for as long as this connection lives
        await send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT_SOURCE });
        console.log(`[zcode-rtl] injected: ${target.title || target.url}`);
        resolve();
      } catch (e) {
        console.log(`[zcode-rtl] inject failed on "${target.title}": ${e.message}`);
        resolve();
      }
    });
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result ?? msg.error);
        pending.delete(msg.id);
      }
    });
    ws.addEventListener('close', () => injected.delete(target.id));
    ws.addEventListener('error', () => resolve());
  });
}

// Real-time path: instead of only polling, subscribe to the browser endpoint's
// targetCreated events, so a new window is injected the moment it opens.
function watchBrowser(wsUrl) {
  return new Promise((resolve) => {
    // resolves when the connection drops; the caller retries
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const send = (method, params = {}) =>
      new Promise((res) => {
        const id = nextId++;
        pending.set(id, res);
        ws.send(JSON.stringify({ id, method, params }));
      });

    ws.addEventListener('open', async () => {
      try {
        await send('Target.setDiscoverTargets', { discover: true });
        console.log('[zcode-rtl] watching for new windows in real time');
      } catch {
        resolve(); // the connection will drop and be retried
      }
    });
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result ?? msg.error);
        pending.delete(msg.id);
        return;
      }
      const info = msg.method === 'Target.targetCreated' && msg.params?.targetInfo;
      if (info && info.type === 'page' && !info.url.startsWith('devtools://')) {
        attach({
          id: info.targetId,
          title: info.title,
          url: info.url,
          webSocketDebuggerUrl: `ws://127.0.0.1:${PORT}/devtools/page/${info.targetId}`,
        });
      }
    });
    ws.addEventListener('close', () => resolve());
    ws.addEventListener('error', () => resolve());
  });
}

async function browserWsUrl() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (!res.ok) return null;
    return (await res.json()).webSocketDebuggerUrl || null;
  } catch {
    return null; // app not started (yet) via the RTL shortcut
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`[zcode-rtl] waiting for ZCode on port ${PORT}...`);
setInterval(async () => {
  for (const t of await listPages()) {
    if (!injected.has(t.id)) await attach(t);
  }
}, POLL_MS);

for (;;) {
  const url = await browserWsUrl();
  if (url) await watchBrowser(url);
  await sleep(1000);
}
