import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as schemas from '../src/schemas.ts';
import * as learning from '../src/learning.ts';
import { parseNewsFeed, parseLearningIndex } from '../src/schemas.ts';

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

test('dynamic learning feed accepts new categories and bilingual Markdown articles', () => {
  const feed = {
    schemaVersion: 1,
    categories: [{ id: 'new-topic', title: { fa: 'موضوع تازه', en: 'New topic' } }],
    articles: [{
      id: 'new-article', category: 'new-topic', kind: 'guide', order: 1,
      title: { fa: 'راهنمای تازه', en: 'New guide' },
      summary: { fa: 'خلاصه فارسی', en: 'English summary' },
      sourceUrl: 'https://example.com/source', checkedAt: '2026-11-02',
      body: { fa: '# متن فارسی', en: '# English body' },
    }],
  };
  const parsed = learning.parseLearningFeed(feed);
  assert.equal(parsed.articles[0].body.fa, '# متن فارسی');
  assert.equal(learning.groupArticles(parsed.articles, parsed.categories, { category: 'new-topic', query: '', lang: 'fa' }).length, 1);
});

test('dynamic learning feed rejects unknown categories, duplicate IDs and executable Markdown', () => {
  const feed = {
    schemaVersion: 1,
    categories: [{ id: 'start', title: { fa: 'شروع', en: 'Start' } }],
    articles: [{ id: 'start-here', category: 'start', kind: 'guide', order: 1,
      title: { fa: 'شروع', en: 'Start' }, summary: { fa: 'خلاصه', en: 'Summary' },
      sourceUrl: 'https://example.com', checkedAt: '2026-11-02', body: { fa: 'سلام', en: 'Hi' } }],
  };
  assert.throws(() => learning.parseLearningFeed({ ...feed, articles: [{ ...feed.articles[0], category: 'missing' }] }));
  assert.throws(() => learning.parseLearningFeed({ ...feed, articles: [feed.articles[0], feed.articles[0]] }));
  assert.throws(() => learning.parseLearningFeed({ ...feed, articles: [{ ...feed.articles[0], body: { fa: '<script>x</script>', en: 'Hi' } }] }));
});

test('new learning source manifest and independent news feed validate bilingual records', async () => {
  const index = JSON.parse(await readFile(new URL('../../../content/learning/index.json', import.meta.url), 'utf8'));
  assert.ok(parseLearningIndex(index).articles.some(item => item.id === 'skill-basics'));
  assert.throws(() => parseLearningIndex({ ...index, articles: index.articles.map(item => item.id === 'skill-basics' ? { ...item, relatedIds: ['missing-guide'] } : item) }));
  const item = { id: 'release-note', title: { fa: 'خبر', en: 'News' }, summary: { fa: 'خلاصه', en: 'Summary' },
    body: { fa: 'متن', en: 'Body' }, publishedAt: '2026-11-02', checkedAt: '2026-11-02', sourceUrl: 'https://example.com' };
  assert.deepEqual(parseNewsFeed({ schemaVersion: 1, news: [item] }), [item]);
  assert.throws(() => parseNewsFeed({ schemaVersion: 1, news: [item, item] }));
  assert.deepEqual(parseNewsFeed({ schemaVersion: 1, news: [] }), []);
});
