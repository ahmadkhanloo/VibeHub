import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { loadCatalog } from '../packages/catalog/src/index.ts';
import { APP_IDS } from '../packages/core/src/index.ts';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const manifest = id => ({ schemaVersion: 1, id, name: id, kind: 'desktop_agent', platforms: ['windows'],
  summary: {fa:'نمونه', en:'fixture'}, websiteUrl:'https://example.com/', isOpenSource:false,
  freeAccess:'unknown', freeAccessDetails:{fa:'نمونه',en:'fixture'}, requiresSignup:true,
  requiresPaymentCard:null, sourceOfFreeAccess:'https://example.com/', lastVerified:'2026-11-04',
  capabilities:{install:'reported',launch:'reported',rtl:'unsupported',proxy:'unknown',terminal:'unsupported',byok:'unknown'} });

test('Claude Desktop and CLI have separate identities while standalone Antigravity is excluded', () => {
  const catalog = loadCatalog({ apps: ['antigravity','claude-desktop','antigravity-ide','claude-code'].map(manifest), providers:[], offers:[] });
  assert.deepEqual(catalog.apps.map(x => x.id), ['claude-desktop','antigravity-ide','claude-code']);
  assert.ok(APP_IDS.includes('claude-code'));
  assert.ok(APP_IDS.includes('antigravity-ide'));
  assert.ok(APP_IDS.includes('claude-desktop'));
  assert.ok(!APP_IDS.includes('antigravity'));
});

test('bundled replacements advertise their actual interface and include bilingual setup guides', async () => {
  const names = await readdir(new URL('../content/apps/',import.meta.url));
  const records = await Promise.all(names.filter(x => x.endsWith('.json')).map(x => read('content/apps/'+x).then(JSON.parse)));
  const apps = loadCatalog({apps:records,providers:[],offers:[]}).apps;
  assert.equal(apps.find(x=>x.id==='claude-code')?.kind,'cli_agent');
  assert.equal(apps.find(x=>x.id==='antigravity-ide')?.capabilities.rtl,'unsupported');
  assert.equal(apps.find(x=>x.id==='claude-desktop')?.kind,'desktop_agent');
  for (const id of ['claude-code','claude-desktop','antigravity-ide']) for (const lang of ['fa','en']) {
    const guide = await read(`docs/tutorials/${id}/${lang}.md`);
    assert.match(guide,/https:\/\//);
    assert.match(guide,lang==='fa' ? /ایران/ : /Iran/);
  }
  const claude = await read('docs/tutorials/claude-code/en.md');
  assert.match(claude,/developer\.amd\.com\.cn\/radeon\/api/);
  assert.match(claude,/MAX_THINKING_TOKENS/);
});
