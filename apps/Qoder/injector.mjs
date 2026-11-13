// Qoder RTL — injects the RTL stylesheet into every Qoder (Electron) window
// and frame through the Chromium DevTools port the launcher opens.
//
//   node injector.mjs            # run as a background daemon
//   QODER_RTL_PORT=9225          # must match the app's --remote-debugging-port
//
// Coverage: browser-level Target.setAutoAttach{flatten} gives us a session per
// page AND per iframe/webview/OOPIF target; inside each session we inject into
// every execution context (top frame + in-process frames). CSP is bypassed, and
// injection survives reloads via Page.addScriptToEvaluateOnNewDocument.

import { createServer } from 'node:net';
import { INJECT_JS } from './style.mjs';

const PORT = Number(process.env.QODER_RTL_PORT) || 9225;
const LOCK_PORT = PORT + 1;
const SWEEP_MS = 5000;
const BASE = `http://127.0.0.1:${PORT}`;

const INTERESTING = new Set(['page', 'iframe', 'webview', 'other']);

const log = (...a) => console.log('[qoder-rtl]', ...a);

// --- single instance: a second daemon exits instead of double-injecting ---
const lock = createServer();
lock.once('error', (e) => {
  log(`injector lock unavailable (${e.code || e.message}), exiting.`);
  process.exit(0);
});
lock.listen(LOCK_PORT, '127.0.0.1');

// The launcher starts us right after the app's CDP port comes up, so once we
// have seen it, a long silence means the app was closed: exit instead of
// lingering forever as an orphan that keeps the lock and pollutes the logs.
const APP_LINGER_MS = 75_000;
let lastCdpSeen = 0;
let everConnected = false;
let downLogged = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  try {
    const res = await fetch(BASE + path, { signal: AbortSignal.timeout(2000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => this.#onMessage(ev.data));
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const msg = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      if (this.ws.readyState !== WebSocket.OPEN) {
        this.pending.delete(id);
        return reject(new Error('socket closed'));
      }
      this.ws.send(JSON.stringify(msg));
    }).catch((e) => ({ __error: e.message }));
  }

  #onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      return;
    }
    if (msg.method) {
      for (const fn of this.handlers.get(msg.method) || []) {
        try {
          fn(msg.params || {}, msg.sessionId);
        } catch (e) {
          log('handler error', msg.method, e.message);
        }
      }
    }
  }
}

/** Sessions we already made RTL: sessionId -> Set(contextId). */
const done = new Map();
/** targetId -> sessionId, so the 5 s sweep never double-attaches. */
const attached = new Map();
/** sessionId -> human label for the log. */
const labels = new Map();

async function hardenSession(cdp, sessionId, label) {
  if (done.has(sessionId)) return;
  done.set(sessionId, new Set());
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Log.enable', {}, sessionId);
  await cdp.send('Page.setBypassCSP', { enabled: true }, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const r = await cdp.send(
    'Page.addScriptToEvaluateOnNewDocument',
    { source: INJECT_JS },
    sessionId
  );
  if (r && r.__error) log('newDocument failed on', label, r.__error);
  log('watching', label);
}

async function injectInto(cdp, sessionId, contextId) {
  const seen = done.get(sessionId);
  if (!seen || seen.has(contextId)) return;
  seen.add(contextId);
  const res = await cdp.send(
    'Runtime.evaluate',
    { expression: INJECT_JS, includeCommandLineAPI: false },
    sessionId
  );
  const where = contextId === undefined ? 'main' : `ctx ${contextId}`;
  if (res && res.exceptionDetails) {
    log('inject threw:', labels.get(sessionId), where, res.exceptionDetails.text);
    seen.delete(contextId);
  } else if (!(res && res.__error)) {
    log('injected', labels.get(sessionId) || sessionId, where);
  }
}

function wireSession(cdp, sessionId, info) {
  const label = `${info.type || '?'} ${info.title || info.url || sessionId}`;
  labels.set(sessionId, label);
  if (info.targetId) attached.set(info.targetId, sessionId);
  hardenSession(cdp, sessionId, label).then(() => injectInto(cdp, sessionId, undefined));
  cdp.on('Runtime.executionContextCreated', (p, sid) => {
    if (sid !== sessionId) return;
    if (p.context && p.context.auxData && p.context.auxData.isDefault === false) return;
    injectInto(cdp, sessionId, p.context && p.context.id);
  });
  cdp.on('Page.frameNavigated', (p, sid) => {
    if (sid !== sessionId || !p.frame || p.frame.parentId) return;
    const seen = done.get(sessionId);
    if (seen) seen.clear();
    injectInto(cdp, sessionId, undefined);
  });
}

async function attach(cdp, targetId, info) {
  if (attached.has(targetId)) return;
  attached.set(targetId, 'pending');
  const res = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  if (!res || res.__error) {
    attached.delete(targetId);
    log('attach failed', info.url || targetId, res && res.__error);
    return;
  }
  if (res.sessionId) wireSession(cdp, res.sessionId, { ...info, targetId });
}

async function bootstrapTargets(cdp) {
  const res = await cdp.send('Target.getTargets');
  for (const t of (res && res.targetInfos) || []) {
    if (!INTERESTING.has(t.type) || (t.url || '').startsWith('devtools://')) continue;
    if (attached.has(t.targetId)) continue;
    await attach(cdp, t.targetId, t);
  }
}

async function runOnce() {
  const version = await getJson('/json/version');
  const wsUrl = version && version.webSocketDebuggerUrl;
  if (!wsUrl) return null;
  lastCdpSeen = Date.now();
  everConnected = true;
  downLogged = false;

  const ws = new WebSocket(wsUrl);
  const cdp = new Cdp(ws);
  const closed = new Promise((resolve) => {
    ws.addEventListener('close', resolve);
    ws.addEventListener('error', resolve);
  });

  await new Promise((resolve) => ws.addEventListener('open', resolve));
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  await cdp.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebugger: false,
    flatten: true,
  });

  cdp.on('Target.attachedToTarget', (p) => {
    const info = p.targetInfo || {};
    if (!INTERESTING.has(info.type || 'other')) return;
    if ((info.url || '').startsWith('devtools://')) return;
    if (p.sessionId) wireSession(cdp, p.sessionId, info);
  });
  cdp.on('Target.targetCreated', (p) => {
    const info = p.targetInfo || {};
    if (!INTERESTING.has(info.type || 'other')) return;
    if ((info.url || '').startsWith('devtools://')) return;
    attach(cdp, info.targetId, info);
  });
  cdp.on('Target.detachedFromTarget', (p) => {
    done.delete(p.sessionId);
    for (const [tid, sid] of attached) if (sid === p.sessionId) attached.delete(tid);
  });
  cdp.on('Target.targetDestroyed', (p) => {
    const tid = p.targetId;
    const sid = attached.get(tid);
    if (sid) {
      attached.delete(tid);
      done.delete(sid);
    }
  });

  await bootstrapTargets(cdp);
  log(`connected to Qoder on ${PORT}`);

  const sweep = setInterval(() => {
    lastCdpSeen = Date.now(); // the open browser session itself proves CDP is alive
    bootstrapTargets(cdp).catch(() => {});
  }, SWEEP_MS);
  sweep.unref();

  await closed;
  clearInterval(sweep);
  done.clear();
  attached.clear();
  labels.clear();
  return true;
}

log(`waiting for Qoder on port ${PORT} (start it with the Qoder RTL launcher)...`);
for (;;) {
  try {
    await runOnce();
  } catch (e) {
    // Log the loss once instead of spamming the out log every second.
    if (everConnected && !downLogged) {
      log('connection lost; waiting before exiting:', e.message);
      downLogged = true;
    }
  }
  if (everConnected && Date.now() - lastCdpSeen > APP_LINGER_MS) {
    log('Qoder is gone; injector exiting.');
    process.exit(0);
  }
  await sleep(1000);
}
