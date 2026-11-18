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
//
// Daily quota: the same DevTools connection also answers VibeHub on
// 127.0.0.1:<port+2>. The probe runs inside the app's own renderer, reads the
// account usage the app exposes, and returns numbers only. No session file is
// parsed here and no token ever leaves the renderer.

import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { INJECT_JS } from './style.mjs';

const PORT = Number(process.env.QODER_RTL_PORT) || 9225;
const LOCK_PORT = PORT + 1;
const QUOTA_PORT = PORT + 2;
const APP_ID = 'qoder';
const SWEEP_MS = 5000;
const BASE = `http://127.0.0.1:${PORT}`;

const INTERESTING = new Set(['page', 'iframe', 'webview', 'other']);
/** Every DevTools request has a deadline, so one stuck frame cannot stall the daemon. */
const CDP_TIMEOUT_MS = 15_000;

const log = (...a) => console.log('[qoder-rtl]', ...a);

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
      // Without a deadline a detached session would keep this promise pending
      // forever and block the quota service.
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DevTools timeout: ${method}`));
      }, CDP_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      const msg = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      if (this.ws.readyState !== WebSocket.OPEN) {
        clearTimeout(timer);
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
      const { resolve, reject, timer } = this.pending.get(msg.id);
      clearTimeout(timer);
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
/** The live connection, so the quota service can reuse it. */
let activeCdp = null;
/** Sessions whose target is a real page: the quota probe runs in one of them. */
const pageSessions = new Set();

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
  if ((info.type || '') === 'page') pageSessions.add(sessionId);
  hardenSession(cdp, sessionId, label).then(() => injectInto(cdp, sessionId, undefined));
  cdp.on('Runtime.executionContextCreated', (p, sid) => {
    if (sid !== sessionId) return;
    if (p.context && p.context.auxData && p.context.auxData.isDefault === false) return;
    injectInto(cdp, sessionId, p.context && p.context.id);
  });
  cdp.on('Page.frameNavigated', (p, sid) => {
    if (sid !== sessionId || !p.frame || p.frame.parentId) return;
    const seen = done.get(sid);
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

// ---------------------------------------------------------------- quota
//
// The promotion window opens every day at 10:00 Singapore time (UTC+8) and
// closes just before 10:00 the next day, so the offset is fixed year round.
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

export function qoderClaimWindow(at = Date.now()) {
  const local = new Date(at + SINGAPORE_OFFSET_MS);
  const today = new Date(local.getTime());
  today.setUTCHours(10, 0, 0, 0);
  // The window that opened yesterday at 10:00 stays open until today at 10:00,
  // so the next boundary is always the coming 10:00.
  const boundary = local.getTime() < today.getTime() ? today.getTime() : today.getTime() + 24 * 60 * 60 * 1000;
  // Seconds, like every other timestamp VibeHub stores.
  return { available: true, resetsAt: Math.floor((boundary - SINGAPORE_OFFSET_MS) / 1000) };
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Turns the renderer answer into the shape VibeHub stores.
 * Only whitelisted numbers and short labels leave this function: the raw
 * payload (which can carry account details) is never forwarded.
 */
export function normalizeQoderUsage(payload) {
  const window_ = qoderClaimWindow();
  const base = {
    status: 'error',
    used: null,
    total: null,
    remaining: null,
    percent: null,
    unit: 'credits',
    resetsAt: null,
    claim: { available: window_.available, claimed: null, points: null, dayNo: null },
    error: null,
  };
  if (!payload || payload.ok !== true) {
    const reason = payload && payload.error;
    if (reason === 'unsupported') return { ...base, status: 'unsupported', error: 'unsupported' };
    if (reason === 'signedOut') return { ...base, status: 'signedOut', error: 'signedOut' };
    return { ...base, error: 'probeFailed' };
  }
  const data = payload.data || {};
  const buckets = [data.addOn, data.plan].filter(bucket => bucket && typeof bucket === 'object');
  // The daily reward lands in the add-on pool, so that pool is the headline
  // number; the plan allowance is only shown when the add-on pool is empty.
  const primary = buckets.find(bucket => numberOrNull(bucket.total) > 0) || buckets[0] || null;
  const other = buckets.find(bucket => bucket !== primary) || null;
  const bucket = (value) => ({
    used: numberOrNull(value.used),
    total: numberOrNull(value.total),
    remaining: numberOrNull(value.remaining),
    percent: numberOrNull(value.percent),
  });
  const counters = primary ? bucket(primary) : { used: null, total: null, remaining: null, percent: null };
  let remaining = counters.remaining;
  if (remaining === null && counters.total !== null && counters.used !== null) {
    remaining = Math.round((counters.total - counters.used) * 100) / 100;
  }
  const percent = counters.percent ?? (
    counters.total && counters.total > 0 && remaining !== null ? Math.round((remaining / counters.total) * 1000) / 10 : null
  );
  const unit = typeof primary?.unit === 'string' && /^[a-zA-Z]{1,16}$/.test(primary.unit) ? primary.unit : 'credits';
  const claimed = data.claimed === true ? true : data.claimed === false ? false : null;
  // Only the app knows whether a daily reward is waiting. Without that answer
  // nothing is offered, so no button is ever a guess.
  const campaign = data.campaign && typeof data.campaign === 'object' ? data.campaign : null;
  const available = campaign ? campaign.claimable === true : false;
  return {
    status: 'ok',
    used: counters.used,
    total: counters.total,
    remaining,
    percent,
    unit,
    resetsAt: window_.resetsAt,
    claim: { available, claimed, points: null, dayNo: null },
    plan: other && numberOrNull(other.total) > 0 ? bucket(other) : null,
    error: null,
  };
}

/** The page program: runs inside Qoder and returns numbers only. */
const USAGE_JS = `(async () => {
  const api = window.qoderDesktop;
  if (!api || typeof api.getAccountUsage !== 'function') return { ok: false, error: 'unsupported' };
  let usage;
  try {
    usage = await api.getAccountUsage();
  } catch (e) {
    return { ok: false, error: 'signedOut', detail: String((e && e.message) || e) };
  }
  const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
  const pick = (bucket) => {
    if (!bucket || typeof bucket !== 'object') return null;
    const unit = typeof bucket.unit === 'string' && /^[a-zA-Z]{1,16}$/.test(bucket.unit) ? bucket.unit : null;
    return {
      total: num(bucket.total),
      used: num(bucket.used),
      remaining: num(bucket.remaining),
      percent: num(bucket.percentage) ?? num(bucket.percent),
      unit
    };
  };
  const q = (usage && usage.qoderUsage) || {};
  // The app itself knows whether a daily reward is waiting; it only shows the
  // gift when there is something to take.
  let campaign = null;
  try {
    if (typeof api.getCampaignStatus === 'function') {
      const status = await api.getCampaignStatus();
      campaign = {
        claimable: !!(status && status.hasClaimableCampaign === true),
        popup: !!(status && status.shouldShowCampaignPopup === true)
      };
    }
  } catch (e) {
    campaign = null;
  }
  return {
    ok: true,
    data: {
      addOn: pick(q.addOnQuota),
      plan: pick(q.userQuota),
      mode: typeof usage.displayMode === 'string' ? usage.displayMode : null,
      campaign
    }
  };
})()`;

/**
 * The promotion can only be claimed inside the app: Usage panel -> gift icon.
 * The labels are localized, so the click is found by shape and by a narrow set
 * of words, and never on anything that could close the session.
 */
const CLAIM_JS = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const api = window.qoderDesktop;
  // The app decides whether a reward is waiting. Nothing is pressed when it
  // says there is none.
  let claimable = false;
  let popupUrl = null;
  try {
    if (api && typeof api.getCampaignStatus === 'function') {
      const status = await api.getCampaignStatus();
      claimable = !!(status && status.hasClaimableCampaign === true);
      popupUrl = status && typeof status.campaignPopupUrl === 'string' ? status.campaignPopupUrl : null;
    }
  } catch (e) {
    claimable = false;
  }
  if (!claimable) return { ok: false, error: 'nothingToClaim' };
  const visible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const text = (el) => ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.textContent || '')).trim();
  const deny = /sign\\s*out|log\\s*out|signout|logout|delete|remove|quit|exit|خروج|پاک|حذف/i;
  const claimWords = /\\bclaim\\b|redeem|collect|دریافت|ادعا|领取|领取奖励/i;
  const panelWords = /gift|present|reward|promotion|usage|quota|credit|هدیه|رویداد|سهمیه|کردیت/i;
  const lowerLeft = (el) => {
    const r = el.getBoundingClientRect();
    return r.left < window.innerWidth * 0.45 && r.top > window.innerHeight * 0.45;
  };
  const nodesOf = (root) => Array.from(root.querySelectorAll('button,[role="button"],a,summary,[tabindex],[aria-label],[title]'));
  const labelled = (el) => {
    if (!visible(el)) return null;
    const label = text(el);
    if (!label || label.length > 80) return null;
    if (deny.test(label)) return null;
    return label;
  };
  // The claim button may sit in the app or in its campaign surface.
  const roots = [document];
  const findClaim = () => {
    for (const root of roots) {
      const hit = nodesOf(root).find(el => {
        const label = labelled(el);
        return label !== null && claimWords.test(label);
      });
      if (hit) return hit;
    }
    return null;
  };
  const panel = nodesOf(document).filter(el => {
    const label = labelled(el);
    return label !== null && lowerLeft(el) && panelWords.test(label);
  });
  if (panel.length) {
    panel[0].scrollIntoView({ block: 'center' });
    panel[0].click();
    await wait(1200);
  }
  let target = findClaim();
  if (!target && popupUrl && api && typeof api.openCampaignSurface === 'function') {
    try { await api.openCampaignSurface(popupUrl); } catch (e) { /* the app decides what it opens */ }
    await wait(2000);
    for (const frame of Array.from(document.querySelectorAll('iframe'))) {
      try { const doc = frame.contentDocument; if (doc) roots.push(doc); } catch (e) { /* cross-origin */ }
    }
    target = findClaim();
  }
  if (!target) return { ok: false, error: 'claimNotFound' };
  target.scrollIntoView({ block: 'center' });
  target.click();
  await wait(800);
  return { ok: true, data: { clicked: true } };
})()`;

async function evaluateIn(sessionId, expression, timeoutMs = 10_000) {
  if (!activeCdp) throw new Error('no connection');
  const request = activeCdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId
  );
  // The page program talks to the service, so it gets its own deadline: a
  // renderer that never answers must not hold the request open.
  const res = await Promise.race([
    request,
    new Promise((_, reject) => setTimeout(() => reject(new Error('probe timed out')), timeoutMs)),
  ]);
  if (res && res.__error) throw new Error(res.__error);
  if (res && res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'probe failed');
  }
  return res && res.result ? res.result.value : undefined;
}

async function probeQuota() {
  if (!activeCdp || pageSessions.size === 0) {
    return quotaAnswer({ status: 'appNotRunning', error: 'appNotRunning' });
  }
  let lastError = 'probeFailed';
  for (const sessionId of pageSessions) {
    try {
      const payload = await evaluateIn(sessionId, USAGE_JS);
      if (payload && payload.ok === true) return quotaAnswer(normalizeQoderUsage(payload));
      if (payload && payload.error) lastError = payload.error;
    } catch (e) {
      lastError = e.message;
    }
  }
  return quotaAnswer(normalizeQoderUsage({ ok: false, error: lastError }));
}

async function claimDaily() {
  if (!activeCdp || pageSessions.size === 0) {
    return quotaAnswer({ status: 'appNotRunning', ok: false, error: 'appNotRunning' });
  }
  for (const sessionId of pageSessions) {
    try {
      const payload = await evaluateIn(sessionId, CLAIM_JS, 25_000);
      if (payload && payload.ok === true) return quotaAnswer({ status: 'ok', ok: true, error: null });
      if (payload && payload.error) return quotaAnswer({ status: payload.error, ok: false, error: payload.error });
    } catch {
      // try the next page session
    }
  }
  return quotaAnswer({ status: 'claimNotFound', ok: false, error: 'claimNotFound' });
}

// ---------------------------------------------------------- quota service

function runtimeFile() {
  const base = process.env.LOCALAPPDATA;
  if (!base) return null;
  return join(base, 'VibeHub', 'rtl', APP_ID + '.json');
}

function writeRuntimeFile() {
  const file = runtimeFile();
  if (!file) return;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ appId: APP_ID, quotaPort: QUOTA_PORT, pid: process.pid, startedAt: Date.now() }));
  } catch (e) {
    log('runtime file not written:', e.message);
  }
}

function clearRuntimeFile() {
  const file = runtimeFile();
  if (!file) return;
  try {
    rmSync(file, { force: true });
  } catch {
    // The file is a hint; a stale one is detected by the failed request.
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

/** Marks the answer as coming from this injector, so VibeHub trusts nothing else. */
function quotaAnswer(body) {
  return { ...body, service: 'vibehub-quota', appId: APP_ID };
}

function startQuotaService() {
  const server = createHttpServer((req, res) => {
    const path = (req.url || '').split('?')[0];
    if (req.method === 'GET' && path === '/quota') {
      probeQuota()
        .then((body) => sendJson(res, 200, body))
        .catch((e) => sendJson(res, 500, { status: 'error', error: 'probeFailed', detail: e.message }));
      return;
    }
    if (req.method === 'POST' && path === '/claim') {
      claimDaily()
        .then((body) => sendJson(res, 200, body))
        .catch((e) => sendJson(res, 500, { status: 'error', ok: false, error: 'probeFailed', detail: e.message }));
      return;
    }
    sendJson(res, 404, { error: 'notFound' });
  });
  server.on('error', (e) => log('quota service unavailable:', e.code || e.message));
  server.listen(QUOTA_PORT, '127.0.0.1', () => {
    log(`quota service on 127.0.0.1:${QUOTA_PORT}`);
    writeRuntimeFile();
  });
}

process.on('exit', clearRuntimeFile);

// The launcher starts us right after the app's CDP port comes up, so once we
// have seen it, a long silence means the app was closed: exit instead of
// lingering forever as an orphan that keeps the lock and pollutes the logs.
const APP_LINGER_MS = 75_000;
let lastCdpSeen = 0;
let everConnected = false;
let downLogged = false;

async function runOnce() {
  const version = await getJson('/json/version');
  const wsUrl = version && version.webSocketDebuggerUrl;
  if (!wsUrl) return null;
  lastCdpSeen = Date.now();
  everConnected = true;
  downLogged = false;

  const ws = new WebSocket(wsUrl);
  const cdp = new Cdp(ws);
  activeCdp = cdp;
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
    pageSessions.delete(p.sessionId);
    for (const [tid, sid] of attached) if (sid === p.sessionId) attached.delete(tid);
  });
  cdp.on('Target.targetDestroyed', (p) => {
    const tid = p.targetId;
    const sid = attached.get(tid);
    if (sid) {
      attached.delete(tid);
      done.delete(sid);
      pageSessions.delete(sid);
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
  pageSessions.clear();
  activeCdp = null;
  return true;
}

async function main() {
  // --- single instance: a second daemon exits instead of double-injecting ---
  const lock = createServer();
  lock.once('error', (e) => {
    log(`injector lock unavailable (${e.code || e.message}), exiting.`);
    process.exit(0);
  });
  lock.listen(LOCK_PORT, '127.0.0.1');
  process.on('SIGINT', () => { clearRuntimeFile(); process.exit(0); });
  process.on('SIGTERM', () => { clearRuntimeFile(); process.exit(0); });
  startQuotaService();
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
      clearRuntimeFile();
      process.exit(0);
    }
    await sleep(1000);
  }
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (entry === import.meta.url) {
  main().catch((e) => {
    log('injector error:', e.message);
    process.exit(1);
  });
}
