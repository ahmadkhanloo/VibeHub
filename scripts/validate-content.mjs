#!/usr/bin/env node
// Validates all bundled content against the zod schemas and rejects
// executable/HTML payloads. Exit 1 with a report on any violation.
// Usage: node scripts/validate-content.mjs
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  appManifestSchema,
  providerManifestSchema,
  offerSchema,
  feedIndexSchema,
  assertNoExecutablePayload,
} from '../packages/core/src/schemas.ts';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

async function readJson(path) {
  return JSON.parse(await readFile(join(root, path), 'utf8'));
}

let failures = 0;
const fail = (label, err) => {
  failures++;
  console.error(`FAIL ${label}: ${err instanceof Error ? err.message : err}`);
};

const appIds = [];
for (const f of await readdir(join(root, 'content/apps'))) {
  if (!f.endsWith('.json')) continue;
  const id = f.replace('.json', '');
  appIds.push(id);
  try {
    const parsed = appManifestSchema.parse(await readJson(`content/apps/${f}`));
    console.log(`OK app ${id} (lastVerified ${parsed.lastVerified})`);
  } catch (e) {
    fail(`app ${id}`, e);
  }
}

for (const f of await readdir(join(root, 'content/providers'))) {
  if (!f.endsWith('.json')) continue;
  const id = f.replace('.json', '');
  try {
    const parsed = providerManifestSchema.parse(await readJson(`content/providers/${f}`));
    console.log(`OK provider ${id}`);
  } catch (e) {
    fail(`provider ${id}`, e);
  }
}

const offersDir = join(root, 'content/offers');
const offerFiles = (await readdir(offersDir)).filter((f) => f.endsWith('.json') && f !== 'index.json');
for (const f of offerFiles) {
  try {
    offerSchema.parse(await readJson(`content/offers/${f}`));
    console.log(`OK offer ${f}`);
  } catch (e) {
    fail(`offer ${f}`, e);
  }
}

try {
  const idx = feedIndexSchema.parse(await readJson('content/offers/index.json'));
  const missing = idx.offers.filter((o) => !offerFiles.includes(`${o}.json`));
  if (missing.length) throw new Error(`index lists missing offer files: ${missing.join(', ')}`);
  console.log(`OK feed index (${idx.apps.length} apps, ${idx.offers.length} offers)`);
} catch (e) {
  fail('feed index', e);
}

for (const appId of appIds) {
  for (const lang of ['fa', 'en']) {
    const rel = `docs/tutorials/${appId}/${lang}.md`;
    let text;
    try {
      text = await readFile(join(root, rel), 'utf8');
    } catch {
      fail(`guide ${rel}`, 'missing');
      continue;
    }
    try {
      assertNoExecutablePayload(text);
      console.log(`OK guide ${rel} (${text.split('\n').length} lines)`);
    } catch (e) {
      fail(`guide ${rel}`, e);
    }
  }
}

try {
  const tutorials = await readJson('content/learning/extensions.json');
  if (!Array.isArray(tutorials) || tutorials.length !== 10) throw new Error('Expected seven skills and three plugins');
  const ids = new Set();
  for (const item of tutorials) {
    if (!item.id || ids.has(item.id) || !['skill', 'plugin'].includes(item.kind)) throw new Error('Invalid tutorial identity');
    ids.add(item.id);
    if (!/^https:\/\//.test(item.source) || !/^\d{4}-\d{2}-\d{2}$/.test(item.checked)) throw new Error(`Invalid source/date: ${item.id}`);
    for (const key of ['summary', 'compatibility', 'prerequisites', 'install', 'use', 'remove', 'troubleshoot']) {
      for (const lang of ['fa', 'en']) if (!item[key]?.[lang]?.trim()) throw new Error(`Missing ${key}/${lang}: ${item.id}`);
    }
    assertNoExecutablePayload(JSON.stringify(item));
  }
  console.log(`OK learning tutorials (${tutorials.length})`);
} catch (e) { fail('learning tutorials', e); }

if (failures) {
  console.error(`\n${failures} content validation failure(s)`);
  process.exit(1);
}
console.log('\nAll content valid.');
