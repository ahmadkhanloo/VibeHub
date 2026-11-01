import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as schemas from '../src/schemas.ts';
import * as learning from '../src/learning.ts';

const entries = JSON.parse(await readFile(new URL('../../../content/learning/extensions.json', import.meta.url), 'utf8'));

test('learning accepts additional tutorials and intentional removals', () => {
  const added = { ...entries[0], id: 'new-extension', kind: 'extension' };
  assert.equal(schemas.parseLearningTutorials([...entries, added]).length, entries.length + 1);
  assert.deepEqual(schemas.parseLearningTutorials([]), []);
});

test('learning rejects duplicate IDs, unsafe sources, missing translations and executable payloads', () => {
  assert.equal(typeof schemas.parseLearningTutorials, 'function');
  for (const change of [
    [...entries, entries[0]],
    [{ ...entries[0], source: 'javascript:alert(1)' }],
    [{ ...entries[0], summary: { fa: ' ' } }],
    [{ ...entries[0], install: { fa: '<script>alert(1)</script>', en: 'Install' } }],
    [{ ...entries[0], checked: '2026-02-30' }],
  ]) assert.throws(() => schemas.parseLearningTutorials(change));
});

test('topic filters collect document formats, normalize Persian search and sort lessons', () => {
  const docs = entries.filter(item => ['pdf', 'docx', 'xlsx', 'pptx'].includes(item.id));
  const input = docs.map((item, index) => ({ ...item, topic: 'documents', level: 'beginner', order: 4 - index }));
  const groups = learning.groupTutorials(input, { topic: 'documents', query: '', level: 'all', lang: 'fa' });
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].items.map(item => item.id), ['pptx', 'xlsx', 'docx', 'pdf']);
  assert.equal(learning.groupTutorials(input, { topic: 'ui', query: '', level: 'all', lang: 'fa' }).length, 0);
  const persian = [{ ...input[0], summary: { fa: 'طراحی رابط کاربری', en: 'Interface' } }];
  assert.equal(learning.groupTutorials(persian, { topic: 'all', query: 'طراحي', level: 'all', lang: 'fa' })[0].items.length, 1);
  assert.equal(learning.groupTutorials(input, { topic: 'all', query: '', level: 'advanced', lang: 'fa' }).length, 0);
});
