// Qoder RTL — verification tool. Talks to the same DevTools port the launcher
// opens, so it proves what the user's eyes would otherwise have to check.
//
//   node doctor.mjs --targets   inventory of CDP targets (proves frame coverage)
//   node doctor.mjs --probe     find the real Persian text nodes and their classes
//   node doctor.mjs --check     assert the RTL rules are live (exit 1 if not)
//   node doctor.mjs --shot      before/after PNG of the chat area
//
// Add --verbose to see raw JSON.

import { mkdirSync, writeFileSync } from 'node:fs';
import { CSS_TEXT, STYLE_ID } from './style.mjs';

const PORT = Number(process.env.QODER_RTL_PORT) || 9225;
const BASE = `http://127.0.0.1:${PORT}`;
const MODE = (process.argv[2] || '--check').replace(/^--/, '');
const VERBOSE = process.argv.includes('--verbose');

const PERSIAN_RE = '[\\u0600-\\u06FF\\uFB80-\\uFEFC]';

const log = (...a) => console.log(...a);
const dump = (o) => {
  if (VERBOSE) console.log(JSON.stringify(o, null, 2));
};

async function httpJson(path) {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const cdp = { ws, nextId: 1, pending: new Map(), handlers: new Map(), violations: [] };
    const connectionTimer = setTimeout(() => { ws.close(); reject(new Error('DevTools connection timed out')); }, 5000);
    const failPending = () => {
      clearTimeout(connectionTimer);
      for (const pending of cdp.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('DevTools connection closed')); }
      cdp.pending.clear();
    };
    cdp.on = (m, fn) => (cdp.handlers.get(m) || cdp.handlers.set(m, []).get(m)).push(fn);
    cdp.send = (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = cdp.nextId++;
        const timer = setTimeout(() => { cdp.pending.delete(id); reject(new Error(`DevTools request timed out: ${method}`)); }, 5000);
        cdp.pending.set(id, { resolve, reject, timer });
        const msg = { id, method, params };
        if (sessionId) msg.sessionId = sessionId;
        ws.send(JSON.stringify(msg));
      });
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && cdp.pending.has(msg.id)) {
        const pending = cdp.pending.get(msg.id);
        clearTimeout(pending.timer);
        if (msg.error) pending.reject(new Error(`DevTools rejected request: ${msg.error.message}`));
        else pending.resolve(msg.result ?? {});
        cdp.pending.delete(msg.id);
        return;
      }
      if (msg.method === 'Log.entryAdded' && msg.params?.entry?.source === 'violation') {
        cdp.violations.push(msg.params.entry.message);
      }
      for (const fn of cdp.handlers.get(msg.method) || []) fn(msg.params || {}, msg.sessionId);
    });
    ws.addEventListener('open', () => { clearTimeout(connectionTimer); resolve(cdp); });
    ws.addEventListener('close', failPending);
    ws.addEventListener('error', () => { failPending(); reject(new Error('Cannot open DevTools connection')); });
  });
}

/** Attach to every interesting target and return [{sessionId,label,type,url}]. */
async function sessions(cdp) {
  const list = [];
  const seenTargets = new Set();
  cdp.on('Target.attachedToTarget', (p) => {
    const i = p.targetInfo || {};
    if (!p.sessionId || i.url?.startsWith('devtools://')) return;
    if (!['page', 'iframe', 'webview', 'other'].includes(i.type || 'other')) return;
    seenTargets.add(i.targetId);
    list.push({ sessionId: p.sessionId, type: i.type, url: i.url || '', label: i.title || i.url || i.targetId });
  });
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  await cdp.send('Target.setAutoAttach', { autoAttach: true, flatten: true, waitForDebuggerOnStart: false });
  await new Promise((r) => setTimeout(r, 400));
  const { targetInfos = [] } = await cdp.send('Target.getTargets');
  for (const t of targetInfos) {
    if (!['page', 'iframe', 'webview', 'other'].includes(t.type)) continue;
    if (t.url?.startsWith('devtools://') || seenTargets.has(t.targetId)) continue;
    const r = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    if (r.sessionId) {
      seenTargets.add(t.targetId);
      list.push({ sessionId: r.sessionId, type: t.type, url: t.url || '', label: t.title || t.url || t.targetId });
    }
  }
  for (const s of list) {
    await cdp.send('Page.enable', {}, s.sessionId);
    await cdp.send('Log.enable', {}, s.sessionId);
    await cdp.send('Runtime.enable', {}, s.sessionId);
  }
  return [...new Map(list.map((s) => [s.sessionId, s])).values()];
}

async function evalJson(cdp, sessionId, fnSource, arg) {
  const expression = `(async () => { const f = ${fnSource}; return await f(${JSON.stringify(arg)}); })()`;
  const r = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}

// ---- page-side programs -------------------------------------------------

const PROBE_JS = `() => {
  const FA = new RegExp('${PERSIAN_RE}');
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode()) && out.length < 12) {
    const t = (n.nodeValue || '').trim();
    if (!t || !FA.test(t)) continue;
    const el = n.parentElement;
    if (!el) continue;
    const chain = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && chain.length < 6) {
      const cls = (cur.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 4).join('.');
      chain.push(cur.tagName.toLowerCase() + (cur.id ? '#' + cur.id : '') + (cls ? '.' + cls : ''));
      cur = cur.parentElement;
    }
    const cs = getComputedStyle(el);
    out.push({ text: t.slice(0, 40), chain, direction: cs.direction, bidi: cs.unicodeBidi, align: cs.textAlign, font: cs.fontFamily.split(',')[0] });
  }
  return { url: location.href, hasSheet: !!document.getElementById('${STYLE_ID}'), nodes: out };
}`;

const CHECK_JS = `async (sheetText) => {
  const FA = new RegExp('${PERSIAN_RE}');
  const res = { ok: true, failures: [], notes: {} };
  const styleEl = document.getElementById('${STYLE_ID}');
  const adopted = (document.adoptedStyleSheets || []).some((s) => s.__qoderRtl === true);
  res.notes.sheet = { styleTag: !!styleEl, adopted };
  if (!styleEl && !adopted) res.failures.push('stylesheet not present in this frame');

  // 1) real app text nodes must be plaintext now
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n, checked = 0, wrong = 0;
  while ((n = w.nextNode()) && checked < 20) {
    const t = (n.nodeValue || '').trim();
    if (!t || !FA.test(t) || !n.parentElement) continue;
    const el = n.parentElement;
    if (el.closest('pre,code,textarea,[contenteditable]')) continue;
    const cs = getComputedStyle(el);
    checked++;
    if (cs.unicodeBidi !== 'plaintext' && cs.unicodeBidi !== 'isolate') { wrong++; }
  }
  res.notes.persianNodes = { checked, notPlaintext: wrong };
  if (checked > 0 && wrong > 0) res.failures.push(wrong + '/' + checked + ' Persian nodes are not plaintext');

  // 2) deterministic proof: in RTL the first glyph sits at the right edge
  const p = document.createElement('p');
  p.textContent = 'یک دو سه';
  p.style.cssText = 'position:fixed;left:0;top:0;font-size:32px;padding:8px;background:#000;color:#fff;z-index:99999';
  document.body.appendChild(p);
  const box = p.getBoundingClientRect();
  const first = document.createRange();
  first.setStart(p.firstChild, 0);
  first.setEnd(p.firstChild, 1);
  const f = first.getBoundingClientRect();
  p.remove();
  const distanceFromRight = Math.abs(box.right - f.right);
  res.notes.firstGlyphDistanceFromRightPx = Math.round(distanceFromRight * 100) / 100;
  if (distanceFromRight > 4) res.failures.push('probe paragraph still renders LTR (first glyph ' + Math.round(distanceFromRight) + 'px from the right edge)');

  // 3) font really loaded
  try {
    await document.fonts.load('16px Vazirmatn');
    res.notes.vazirmatn = document.fonts.check('16px Vazirmatn');
  } catch (e) { res.notes.vazirmatn = 'error: ' + e.message; }
  if (res.notes.vazirmatn !== true) res.failures.push('Vazirmatn not available (degrades to Tahoma)');

  // 4) the guard keeps code LTR
  const code = document.createElement('pre');
  code.textContent = 'const x = 1;';
  document.body.appendChild(code);
  const ccs = getComputedStyle(code);
  res.notes.codeGuard = { bidi: ccs.unicodeBidi, align: ccs.textAlign };
  if (ccs.unicodeBidi !== 'isolate') res.failures.push('code guard not applied: ' + ccs.unicodeBidi);
  code.remove();

  if (sheetText) res.notes.cssBytes = sheetText.length;
  return res;
}`;

const SHOT_JS = `() => {
  const FA = new RegExp('${PERSIAN_RE}');
  let best = null;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) {
    const t = (n.textContent || '');
    if (!FA.test(t)) continue;
    const r = n.getBoundingClientRect();
    if (r.width < 100 || r.height < 40) continue;
    if (!best || r.width * r.height < best.area) best = { el: n, area: r.width * r.height, rect: r };
  }
  if (!best) return null;
  let host = best.el;
  while (host.parentElement && host.parentElement.getBoundingClientRect().height < best.el.getBoundingClientRect().height * 1.2) host = host.parentElement;
  const r = host.getBoundingClientRect();
  return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height };
}`;

// ---- modes ---------------------------------------------------------------

async function main() {
  let version;
  try {
    version = await httpJson('/json/version');
  } catch (e) {
    log(`Qoder is not listening on ${BASE}.`);
    log('Start it with the Qoder RTL launcher (launch.vbs), not the normal icon.');
    log(`(${e.message})`);
    process.exit(2);
  }
  const cdp = await connect(version.webSocketDebuggerUrl);
  const list = await sessions(cdp);
  if (MODE === 'check' && !list.length) throw new Error('No reachable Qoder frames; RTL is not verified');

  if (MODE === 'targets') {
    const rest = await httpJson('/json/list');
    log(`browser: ${version.Browser}  port: ${PORT}`);
    log(`/json/list: ${rest.length} targets, types: ${[...new Set(rest.map((t) => t.type))].join(', ')}`);
    log(`autoAttach sessions: ${list.length}`);
    for (const s of list) log(`  ${s.type.padEnd(7)} ${s.label.slice(0, 90)}`);
    const pages = rest.filter((t) => t.type === 'page').length;
    const frames = list.filter((s) => s.type !== 'page').length;
    log(`=> ${pages} page target(s), ${frames} non-page session(s) reachable`);
    return;
  }

  let failures = 0;
  for (const s of list) {
    try {
      if (MODE === 'probe') {
        const r = await evalJson(cdp, s.sessionId, PROBE_JS);
        log(`\n== ${s.type} ${s.label}`);
        log(`   url: ${r.url.slice(0, 120)}  rtl-sheet: ${r.hasSheet}`);
        for (const node of r.nodes) {
          log(`   "${node.text}"`);
          log(`     ${node.chain.join(' < ')}`);
          log(`     bidi=${node.bidi} dir=${node.direction} align=${node.align} font=${node.font}`);
        }
        if (!r.nodes.length) log('   (no Persian text node in this frame)');
      } else if (MODE === 'check') {
        const r = await evalJson(cdp, s.sessionId, CHECK_JS, CSS_TEXT);
        const bad = r.failures.length;
        failures += bad;
        log(`\n== ${s.type} ${s.label}`);
        log(`   ${JSON.stringify(r.notes)}`);
        for (const f of r.failures) log(`   FAIL ${f}`);
        if (!bad) log('   OK');
      } else if (MODE === 'shot') {
        const clip = await evalJson(cdp, s.sessionId, SHOT_JS);
        if (!clip || clip.width < 20) continue;
        mkdirSync('.qa', { recursive: true });
        for (const [name, on] of [['before', false], ['after', true]]) {
          await evalJson(cdp, s.sessionId, `() => { window.__qoderRtlEnabled(${on}); return true; }`);
          await new Promise((r) => setTimeout(r, 250));
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 2 } }, s.sessionId);
          if (shot.data) {
            writeFileSync(`.qa/${name}.png`, Buffer.from(shot.data, 'base64'));
            log(`wrote .qa/${name}.png (${Math.round(shot.data.length * 0.75 / 1024)} KB) frame ${clip.width}x${clip.height}`);
          }
        }
        await evalJson(cdp, s.sessionId, `() => { window.__qoderRtlEnabled(true); return true; }`);
        return;
      }
    } catch (e) {
      failures++;
      log(`\n== ${s.type} ${s.label}\n   probe failed: ${e.message}`);
    }
  }

  if (MODE === 'check') {
    if (cdp.violations.length) log(`\nCSP violations seen: ${cdp.violations.length}`);
    log(failures ? `\nRESULT: ${failures} failing check(s)` : '\nRESULT: all frames pass');
    process.exit(failures ? 1 : 0);
  }
}

main().catch((e) => {
  log('doctor error:', e.message);
  process.exit(1);
});
