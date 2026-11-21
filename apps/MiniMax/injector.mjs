// MiniMax Code RTL — injects the RTL stylesheet into the MiniMax Code renderer
// and answers VibeHub's daily-quota service on 127.0.0.1:<port+2>.
//
//   node injector.mjs
//   MINIMAX_RTL_PORT=9240
//
// The quota probe runs inside the app and calls the app's own authenticated
// transport (window.electronAPI.proxyFetch), so the token never leaves the
// renderer. Only numbers cross back to VibeHub.

import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { injectSource } from './style.mjs';
import { isMiniMaxPageTarget } from './cdp-targets.mjs';

const INJECT_JS = injectSource();
const port = Number(process.env.MINIMAX_RTL_PORT) || 9240;
const quotaPort = port + 2;
const appId = 'minimax-code';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Turns the renderer answer into the shape VibeHub stores. Only whitelisted
 * numbers and short labels leave this function.
 */
export function normalizeMiniMaxQuota(payload) {
  const base = {
    status: 'error',
    used: null,
    total: null,
    remaining: null,
    percent: null,
    unit: 'credits',
    resetsAt: null,
    claim: { available: false, claimed: null, points: null, dayNo: null },
    error: null,
  };
  if (!payload || payload.ok !== true) {
    const reason = payload && payload.error;
    if (reason === 'unsupported') return { ...base, status: 'unsupported', error: 'unsupported' };
    if (reason === 'signedOut') return { ...base, status: 'signedOut', error: 'signedOut' };
    return { ...base, error: 'probeFailed' };
  }
  const data = payload.data || {};
  const num = numberOrNull;
  const counters = (used, total, remaining) => {
    let left = remaining;
    if (left === null && total !== null && used !== null) left = Math.round((total - used) * 100) / 100;
    const percent = total && total > 0 && left !== null
      ? Math.round((left / total) * 1000) / 10
      : null;
    return { used, total, remaining: left, percent };
  };
  const plan = counters(num(data.used), num(data.total), num(data.remaining));
  const image = data.image && typeof data.image === 'object'
    ? counters(num(data.image.used), num(data.image.total), num(data.image.remaining))
    : null;
  // The coding pool leads; the free image pool is a second, smaller allowance.
  const headline = plan.total !== null && plan.total > 0 ? plan : (image && image.total !== null && image.total > 0 ? image : plan);
  const unit = headline === image ? 'images' : 'credits';
  const other = headline === plan ? image : plan;
  const claimed = data.claimed === true ? true : data.claimed === false ? false : null;
  // Only the daily check-in can be claimed, so the button follows its answer.
  const claimable = data.signin === true && claimed !== true;
  return {
    status: 'ok',
    used: headline.used,
    total: headline.total,
    remaining: headline.remaining,
    percent: headline.percent,
    unit,
    resetsAt: numberOrNull(data.windowEnd),
    plan: other && other.total !== null && other.total > 0 ? { ...other, unit: other === image ? 'images' : 'credits' } : null,
    claim: {
      available: claimable,
      claimed,
      points: numberOrNull(data.points),
      dayNo: numberOrNull(data.dayNo),
    },
    error: null,
  };
}

/** The page program: runs inside MiniMax Code and returns numbers only. */
const QUOTA_JS = `(async () => {
  const api = window.electronAPI;
  if (!api || typeof api.proxyFetch !== 'function') return { ok: false, error: 'unsupported' };
  const call = async (url, method) => {
    try {
      const res = await api.proxyFetch({
        url,
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? '{}' : undefined,
        responseType: 'text',
        timeout: 8000
      });
      if (!res || !res.ok) return { ok: false, error: 'http' + ((res && res.status) || 0) };
      let data = res.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return { ok: false, error: 'parse' }; } }
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  };
  const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
  // The app reports its own failures inside base_resp, not in the HTTP status.
  const usable = (r) => {
    if (!r || !r.ok) return false;
    const body = (r.data && r.data.data) || r.data || {};
    const base = body.base_resp;
    return !(base && typeof base.status_code === 'number' && base.status_code !== 0);
  };
  const bodyOf = (r) => ((r && r.data && r.data.data) || (r && r.data) || {});
  const [signin, plan, image] = await Promise.all([
    call('https://agent.minimax.io/minimax-cloud/api/v1/signin/status', 'GET'),
    call('https://platform.minimax.io/backend/account/token_plan_credit?business=Agent&device_platform=desktop', 'GET'),
    call('https://agent.minimax.io/minimax-cloud/api/v1/image/free-quota', 'GET'),
  ]);
  if (!usable(signin) && !usable(plan) && !usable(image)) {
    const denied = [signin.error, plan.error, image.error].some((e) => typeof e === 'string' && /401|403|unauthor|forbidden/i.test(e));
    return { ok: false, error: denied ? 'signedOut' : 'probeFailed' };
  }
  const signinBody = usable(signin) ? bodyOf(signin) : null;
  const planBody = usable(plan) ? bodyOf(plan) : null;
  const imageBody = usable(image) ? bodyOf(image) : null;
  // The coding quota of the agent.
  const planUsed = planBody ? num(planBody.used_credits) : null;
  const planTotal = planBody ? num(planBody.total_credits) : null;
  let planRemaining = planBody ? num(planBody.remaining_credits) : null;
  if (planRemaining === null && planTotal !== null && planUsed !== null) planRemaining = planTotal - planUsed;
  // The free image pool is a second, smaller allowance with its own window.
  const imageUsed = imageBody ? num(imageBody.used) : null;
  const imageTotal = imageBody ? num(imageBody.total) : null;
  let imageRemaining = imageBody ? num(imageBody.remaining) : null;
  if (imageRemaining === null && imageTotal !== null && imageUsed !== null) imageRemaining = imageTotal - imageUsed;
  const imageActive = imageBody ? imageBody.active === true : false;
  const windowEnd = imageBody && imageActive ? num(imageBody.end_ms) : null;
  const points = signinBody ? num(signinBody.points) : null;
  const dayNo = signinBody ? (num(signinBody.day_no) ?? num(signinBody.dayNo)) : null;
  const claimResult = signinBody && typeof signinBody.claim_result === 'string' ? signinBody.claim_result : null;
  let claimed = null;
  if (claimResult) {
    if (/already|success|claimed|done/i.test(claimResult)) claimed = true;
    else if (/fail|error|not/i.test(claimResult)) claimed = false;
  }
  return {
    ok: true,
    data: {
      used: planUsed,
      total: planTotal,
      remaining: planRemaining,
      points,
      dayNo,
      claimed,
      signin: signinBody !== null,
      image: imageTotal === null ? null : { used: imageUsed, total: imageTotal, remaining: imageRemaining },
      windowEnd: windowEnd === null ? null : Math.floor(windowEnd / 1000)
    }
  };
})()`;

/** The daily check-in that grants the free quota. */
const CLAIM_JS = `(async () => {
  const api = window.electronAPI;
  if (!api || typeof api.proxyFetch !== 'function') return { ok: false, error: 'unsupported' };
  try {
    const res = await api.proxyFetch({
      url: 'https://agent.minimax.io/minimax-cloud/api/v1/signin/claim',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      responseType: 'text',
      timeout: 12000
    });
    if (!res || !res.ok) {
      const status = (res && res.status) || 0;
      return { ok: false, error: status === 401 || status === 403 ? 'signedOut' : 'claimFailed' };
    }
    let data = res.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return { ok: false, error: 'parse' }; } }
    const body = (data && data.data) || data || {};
    const result = typeof body.claim_result === 'string' ? body.claim_result : null;
    const points = typeof body.points === 'number' ? body.points : null;
    const dayNo = typeof body.day_no === 'number' ? body.day_no : null;
    if (result && /already/i.test(result)) return { ok: true, data: { claimed: true, points, dayNo } };
    if (result && /fail|error/i.test(result)) return { ok: false, error: 'claimFailed' };
    return { ok: true, data: { claimed: true, points, dayNo } };
  } catch (e) {
    return { ok: false, error: 'claimFailed' };
  }
})()`;

const sessions = new Map();

async function evaluateIn(session, expression) {
  const result = await session.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, 20000);
  if (result && result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'probe failed');
  }
  return result && result.result ? result.result.value : undefined;
}

async function attach(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;
  const send = (method, params = {}, timeoutMs = 3000) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout')); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  sessions.set(target.id, { ws, pending, send });
  const clean = () => {
    sessions.delete(target.id);
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(Error('CDP closed')); }
    pending.clear();
  };
  ws.addEventListener('close', clean, { once: true });
  ws.addEventListener('error', () => ws.close(), { once: true });
  ws.addEventListener('message', event => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    const item = pending.get(msg.id);
    if (item) {
      pending.delete(msg.id); clearTimeout(item.timer);
      msg.error ? item.reject(Error(msg.error.message)) : item.resolve(msg.result);
    }
    if (msg.method === 'Page.frameNavigated' && !msg.params.frame.parentId)
      void send('Runtime.evaluate', { expression: INJECT_JS }).catch(() => {});
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('CDP connect timeout')), 3000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(Error('CDP connect failed')); }, { once: true });
    });
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT_JS });
    await send('Runtime.evaluate', { expression: INJECT_JS });
    console.log('[minimax-rtl] attached to MiniMax Code renderer');
  } catch (error) { console.error('[minimax-rtl]', error.message); ws.close(); }
}

async function probeQuota() {
  if (!sessions.size) return quotaAnswer({ status: 'appNotRunning', error: 'appNotRunning' });
  let lastError = 'probeFailed';
  for (const session of sessions.values()) {
    try {
      const payload = await evaluateIn(session, QUOTA_JS);
      if (payload && payload.ok === true) return quotaAnswer(normalizeMiniMaxQuota(payload));
      if (payload && payload.error) lastError = payload.error;
    } catch (e) {
      lastError = e.message;
    }
  }
  return quotaAnswer(normalizeMiniMaxQuota({ ok: false, error: lastError }));
}

async function claimDaily() {
  if (!sessions.size) return quotaAnswer({ status: 'appNotRunning', ok: false, error: 'appNotRunning' });
  for (const session of sessions.values()) {
    try {
      const payload = await evaluateIn(session, CLAIM_JS);
      if (payload && payload.ok === true) return quotaAnswer({ status: 'ok', ok: true, error: null, points: payload.data?.points ?? null, dayNo: payload.data?.dayNo ?? null });
      if (payload && payload.error) return quotaAnswer({ status: payload.error, ok: false, error: payload.error });
    } catch {
      // try the next renderer
    }
  }
  return quotaAnswer({ status: 'claimFailed', ok: false, error: 'claimFailed' });
}

// ---------------------------------------------------------- quota service

function runtimeFile() {
  const base = process.env.LOCALAPPDATA;
  if (!base) return null;
  return join(base, 'VibeHub', 'rtl', appId + '.json');
}

function writeRuntimeFile() {
  const file = runtimeFile();
  if (!file) return;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ appId, quotaPort, pid: process.pid, startedAt: Date.now() }));
  } catch (e) {
    console.error('[minimax-rtl] runtime file not written:', e.message);
  }
}

function clearRuntimeFile() {
  const file = runtimeFile();
  if (!file) return;
  try { rmSync(file, { force: true }); } catch { /* a stale file is detected by the failed request */ }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

/** Marks the answer as coming from this injector, so VibeHub trusts nothing else. */
function quotaAnswer(body) {
  return { ...body, service: 'vibehub-quota', appId };
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
  server.on('error', (e) => console.error('[minimax-rtl] quota service unavailable:', e.code || e.message));
  server.listen(quotaPort, '127.0.0.1', () => {
    console.log(`[minimax-rtl] quota service on 127.0.0.1:${quotaPort}`);
    writeRuntimeFile();
  });
}

process.on('exit', clearRuntimeFile);

async function main() {
  const lock = createServer();
  lock.on('error', () => process.exit(1));
  lock.listen(port + 1, '127.0.0.1');
  process.on('SIGINT', () => { clearRuntimeFile(); process.exit(0); });
  process.on('SIGTERM', () => { clearRuntimeFile(); process.exit(0); });
  startQuotaService();
  let misses = 0;
  for (;;) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) throw Error('CDP unavailable');
      const targets = (await response.json()).filter(isMiniMaxPageTarget);
      misses = 0;
      for (const target of targets) if (!sessions.has(target.id)) await attach(target);
    } catch {
      if (++misses >= 3) { clearRuntimeFile(); process.exit(0); }
    }
    await sleep(15000);
  }
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (entry === import.meta.url) {
  main().catch((e) => { console.error('[minimax-rtl]', e.message); process.exit(1); });
}
