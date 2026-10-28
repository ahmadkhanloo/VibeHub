import { createServer } from 'node:net';
import { INJECT_JS } from './style.mjs';

const port = Number(process.env.ANTIGRAVITY_RTL_PORT) || 9231;
const lock = createServer();
lock.on('error', () => process.exit(1));
lock.listen(port + 1, '127.0.0.1');
const sessions = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function isAppTarget(target) {
  if (target.type !== 'page') return false;
  try {
    const url = new URL(target.url);
    return url.protocol === 'https:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
      && url.pathname === '/';
  } catch { return false; }
}

async function attach(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  sessions.set(target.id, ws);
  let nextId = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout')); }, 3000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({id, method, params}));
  });
  const clean = () => {
    sessions.delete(target.id);
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(Error('CDP closed')); }
    pending.clear();
  };
  ws.addEventListener('close', clean, {once:true});
  ws.addEventListener('error', () => ws.close(), {once:true});
  ws.addEventListener('message', event => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    const item = pending.get(msg.id);
    if (item) {
      pending.delete(msg.id); clearTimeout(item.timer);
      msg.error ? item.reject(Error(msg.error.message)) : item.resolve(msg.result);
    }
    if (msg.method === 'Page.frameNavigated' && !msg.params.frame.parentId)
      void send('Runtime.evaluate', {expression:INJECT_JS}).catch(() => {});
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('CDP connect timeout')), 3000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once:true});
      ws.addEventListener('error', () => { clearTimeout(timer); reject(Error('CDP connect failed')); }, {once:true});
    });
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', {source:INJECT_JS});
    await send('Runtime.evaluate', {expression:INJECT_JS});
    console.log('[antigravity-rtl] attached to standalone application');
  } catch (error) { console.error('[antigravity-rtl]', error.message); ws.close(); }
}

let misses = 0;
for (;;) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {signal:AbortSignal.timeout(2000)});
    if (!response.ok) throw Error('CDP unavailable');
    const targets = (await response.json()).filter(isAppTarget);
    misses = 0;
    for (const target of targets) if (!sessions.has(target.id)) await attach(target);
  } catch {
    if (++misses >= 3) process.exit(0);
  }
  await sleep(15000);
}
