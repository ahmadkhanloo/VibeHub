import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

test('tutorial screenshots have packaged WebP assets, source provenance and valid Markdown references', async () => {
  const entries = JSON.parse(await readFile(join(root, 'apps/desktop/src/lib/tutorial-screenshots.json'), 'utf8'));
  const files = new Set();
  for (const entry of entries) {
    assert.match(entry.file, /^screenshots\/[a-z0-9-]+\.webp$/);
    assert.ok(!files.has(entry.file), `Duplicate screenshot ${entry.file}`);
    files.add(entry.file);
    assert.equal(new URL(entry.sourcePage).protocol, 'https:');
    if (entry.kind === 'local-screenshot') {
      assert.equal(entry.sourceImage, null);
      assert.ok(entry.captureDescription?.trim(), 'A local capture needs a description of its environment');
    } else {
      assert.equal(new URL(entry.sourceImage).protocol, 'https:');
    }
    assert.match(entry.retrievedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.width > 0 && entry.height > 0);
    const bytes = await readFile(join(root, 'apps/desktop/public/tutorials', entry.file));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  const referenced = new Set();
  for (const folder of ['docs/tutorials', 'content/learning/articles']) {
    for (const name of await readdir(join(root, folder), { recursive: true })) {
      if (!name.endsWith('.md')) continue;
      const text = await readFile(join(root, folder, name), 'utf8');
      assert.doesNotMatch(text, /!\[(?:Educational workflow schematic|نقشهٔ آموزشی مسیر کار)/, name);
      for (const match of text.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
        const asset = match[2].split('/tutorials/')[1];
        if (!asset?.startsWith('screenshots/')) continue;
        assert.ok(match[1].trim(), `Missing description in ${name}`);
        assert.ok(files.has(asset), `Unregistered screenshot ${asset}`);
        await readFile(resolve(root, folder, name, '..', match[2]));
        referenced.add(asset);
      }
    }
  }
  assert.deepEqual(referenced, files, 'Every packaged screenshot should be used in a lesson');
});

test('every Claude feature lesson includes bilingual feature screenshots and official sources', async () => {
  const index = JSON.parse(await readFile(join(root, 'content/learning/index.json'), 'utf8'));
  const lessons = index.articles.filter(item => item.id.startsWith('claude-'));
  assert.ok(lessons.length >= 9);
  for (const lesson of lessons) {
    const counts = [];
    for (const language of ['fa', 'en']) {
      const text = await readFile(join(root, lesson.contentPath, `${language}.md`), 'utf8');
      const images = [...text.matchAll(/!\[[^\]]+\]\([^\n]+\/screenshots\/[^)]+\.webp\)/g)];
      assert.ok(images.length, `${lesson.id}/${language} has no feature screenshot`);
      assert.match(text, /https:\/\/(?:code|academy)\.claude\.com\//);
      counts.push(images.length);
    }
    assert.equal(counts[0], counts[1], `${lesson.id} has unequal visual coverage across languages`);
  }
});

test('every catalog app has an illustrated guide in Persian and English', async () => {
  for (const file of await readdir(join(root, 'content/apps'))) {
    if (!file.endsWith('.json')) continue;
    const { id } = JSON.parse(await readFile(join(root, 'content/apps', file), 'utf8'));
    for (const language of ['fa', 'en']) {
      const guide = await readFile(join(root, 'docs/tutorials', id, `${language}.md`), 'utf8');
      assert.match(guide, /!\[[^\]]+\]\([^\n]+\/screenshots\/[^)]+\.webp\)/, `${id}/${language} has no screenshot`);
    }
  }
});
