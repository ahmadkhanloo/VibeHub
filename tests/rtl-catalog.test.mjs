import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, filterApps } from '../packages/catalog/src/index.ts';
import { APP_IDS } from '../packages/core/src/index.ts';
import { rtlAdapterAvailable, rtlAdapterConfigured, rtlAdapterSetupSupported } from '../packages/core/src/ux.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFile(join(root, path), 'utf8');

test('adapter readiness follows native availability, with the shared ChatGPT ID gated by runtime product', () => {
  const status = (id, available, configured = false, product) => ({ id, available, configured, ...(product ? { product } : {}) });

  assert.equal(rtlAdapterAvailable('opencode', [status('opencode', true)]), true);
  assert.equal(rtlAdapterAvailable('antigravity', [status('antigravity', true)]), true);
  assert.equal(rtlAdapterAvailable('mimocode', [status('mimocode', false, true)]), false);
  assert.equal(rtlAdapterAvailable('chatgpt', [status('chatgpt', true, true, 'chatgpt')]), false);
  assert.equal(rtlAdapterAvailable('chatgpt', [status('chatgpt', true, true, 'unknown')]), false);
  assert.equal(rtlAdapterAvailable('chatgpt', [status('chatgpt', true, true, 'codex')]), true);
  assert.equal(rtlAdapterConfigured('chatgpt', [status('chatgpt', true, true, 'codex')]), true);
  assert.equal(rtlAdapterConfigured('chatgpt', [status('chatgpt', true, true, 'chatgpt')]), false);
});

test('adapter repair eligibility is separate from installed files and remains product-scoped', () => {
  const missing = { id: 'zcode', available: false, configured: false, setupSupported: true };
  assert.equal(rtlAdapterAvailable('zcode', [missing]), false);
  assert.equal(rtlAdapterSetupSupported('zcode', [missing]), true);
  assert.equal(rtlAdapterSetupSupported('freebuff-desktop', [{ id: 'freebuff-desktop', available: false, configured: false }]), false);
  assert.equal(rtlAdapterSetupSupported('chatgpt', [{ id: 'chatgpt', available: false, configured: false, product: 'codex' }]), false);
});

test('catalog verification is independent of installed adapter readiness', async () => {
  const ux = await read('packages/core/src/ux.ts');
  const details = await read('apps/desktop/src/features/explore/AppDetails.tsx');
  const launchControls = await read('apps/desktop/src/components/LaunchControls.tsx');
  const projects = await read('apps/desktop/src/components/Projects.tsx');
  const summary = await read('apps/desktop/src/components/AppSummary.tsx');
  assert.match(ux, /rtlAdapterAvailable/);
  assert.match(details, /VerificationBadge\s+status=\{app\.capabilities\.rtl\}/);
  assert.match(launchControls, /rtlAdapterAvailable\(/);
  assert.match(projects, /rtlAdapterAvailable\(/);
  assert.match(details, /rtlAdapterConfigured\(/);
  assert.match(details, /rtlAdapterSetupSupported\(/);
  assert.match(summary, /rtlAdapterConfigured\(/);
  for (const source of [details, summary, projects, launchControls, await read('apps/desktop/src/app/tool-context.tsx'), await read('apps/desktop/src/features/home/Home.tsx')]) {
    assert.doesNotMatch(source, /\[['"]antigravity['"],\s*['"]opencode['"]\]/, 'adapter support must not be inferred from these app IDs');
  }
});

test('Freebuff CLI and Desktop have separate validated catalog records and guides', async () => {
  const filenames = await readdir(join(root, 'content/apps'));
  const manifests = await Promise.all(filenames.filter(name => name.endsWith('.json')).map(async name => JSON.parse(await read(`content/apps/${name}`))));
  const catalog = loadCatalog({ apps: manifests, providers: [], offers: [] });
  const cli = catalog.apps.find(app => app.id === 'freebuff');
  const desktop = catalog.apps.find(app => app.id === 'freebuff-desktop');
  const mimo = catalog.apps.find(app => app.id === 'mimocode');
  const claudeCode = catalog.apps.find(app => app.id === 'claude-code');
  assert.equal(cli?.kind, 'cli_agent');
  assert.equal(desktop?.kind, 'desktop_agent');
  assert.equal(desktop?.capabilities.rtl, 'unsupported');
  assert.equal(mimo?.kind, 'cli_agent');
  assert.equal(mimo?.capabilities.rtl, 'unknown');
  assert.equal(claudeCode?.kind, 'cli_agent');
  assert.equal(claudeCode?.capabilities.rtl, 'unsupported');
  assert.deepEqual(filterApps(catalog, { query: 'Freebuff' }).map(app => app.id).sort(), ['freebuff', 'freebuff-desktop']);
  for (const lang of ['fa', 'en']) assert.ok((await read(`docs/tutorials/freebuff-desktop/${lang}.md`)).trim());
});

test('shared AppId covers the supported Windows catalog IDs', async () => {
  const source = await read('packages/core/src/index.ts');
  for (const id of ['freebuff-desktop', 'chatgpt', 'claude-desktop', 'claude-code']) assert.match(source, new RegExp(`['"]${id}['"]`));
});

test('shared AppId is the exact unique Windows host catalog allowlist', () => {
  assert.deepEqual([...APP_IDS], ['zcode', 'qoder', 'deepseek-harness', 'opencode', 'mimocode', 'freebuff', 'freebuff-desktop', 'antigravity', 'chatgpt', 'claude-desktop', 'claude-code']);
  assert.equal(new Set(APP_IDS).size, APP_IDS.length);
});
