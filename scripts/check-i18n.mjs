#!/usr/bin/env node
// fa/en translation-key parity check (plan §3.2). Compares every namespace
// JSON under apps/desktop/src/i18n/{fa,en} key-by-key and fails on drift.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = join(fileURLToPath(new URL('..', import.meta.url)), 'apps/desktop/src/i18n');
let failures = 0;

function flatten(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...flatten(v, key));
    else out.push(key);
  }
  return out;
}

const langs = {};
for (const lang of ['fa', 'en']) {
  const dir = join(base, lang);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  const merged = {};
  for (const f of files) {
    const ns = f.replace('.json', '');
    merged[ns] = JSON.parse(await readFile(join(dir, f), 'utf8'));
  }
  langs[lang] = { merged, files };
}

const faKeys = new Set(flatten(langs.fa.merged));
const enKeys = new Set(flatten(langs.en.merged));
const nsFa = new Set(Object.keys(langs.fa.merged));
const nsEn = new Set(Object.keys(langs.en.merged));

for (const ns of nsFa) if (!nsEn.has(ns)) { console.error(`FAIL namespace '${ns}' missing in en`); failures++; }
for (const ns of nsEn) if (!nsFa.has(ns)) { console.error(`FAIL namespace '${ns}' missing in fa`); failures++; }
for (const k of faKeys) if (!enKeys.has(k)) { console.error(`FAIL key '${k}' missing in en`); failures++; }
for (const k of enKeys) if (!faKeys.has(k)) { console.error(`FAIL key '${k}' missing in fa`); failures++; }
for (const k of faKeys) {
  const fa = k.split('.').reduce((o, p) => o?.[p], langs.fa.merged);
  const en = k.split('.').reduce((o, p) => o?.[p], langs.en.merged);
  if (typeof fa === 'string' && fa === en && /[a-z]{4,}/i.test(fa) && !/^[A-Z0-9\s.-]+$/.test(fa)) {
    console.warn(`WARN '${k}' identical in fa and en (may be untranslated)`);
  }
}

if (failures) { console.error(`\n${failures} parity failure(s)`); process.exit(1); }
console.log(`i18n parity OK (${faKeys.size} keys, namespaces: ${[...nsFa].join(', ')})`);
