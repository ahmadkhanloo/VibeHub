import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildContentSite } from '../scripts/build-content-site.mjs';

test('the Pages artifact contains the validated feed and bilingual guides without application code', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'vibehub-content-site-'));
  const destination = join(tempRoot, 'vibehub-content-site');
  try {
    await buildContentSite(destination);
    const index = JSON.parse(await readFile(join(destination, 'feed', 'index.json'), 'utf8'));
    const qoderGuide = await readFile(join(destination, 'feed', 'guides', 'qoder', 'fa.md'), 'utf8');

    assert.equal(index.schemaVersion, 1);
    assert.match(qoderGuide, /Qoder/);
    await assert.rejects(readFile(join(destination, 'src', 'main.tsx')));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('canonical tutorial edits trigger content feed publication', async () => {
  const workflow = await readFile(new URL('../.github/workflows/publish-content.yml', import.meta.url), 'utf8');
  assert.match(workflow, /paths:[\s\S]*?- "docs\/tutorials\/\*\*"/);
});
