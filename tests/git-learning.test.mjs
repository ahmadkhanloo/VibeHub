import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const ids = ['git-first-commit', 'git-agent-github', 'git-practice-resources'];
test('Git curriculum has three ordered bilingual lessons and valid internal destinations', async () => {
  const index = JSON.parse(await readFile('content/learning/index.json', 'utf8'));
  assert.equal(index.categories[1].id, 'git');
  const lessons = index.articles.filter(item => item.category === 'git');
  assert.deepEqual(lessons.map(item => item.id), ids);
  assert.deepEqual(lessons.map(item => item.order), [10, 20, 30]);
  const known = new Set(index.articles.map(item => item.id));
  for (const item of lessons) for (const language of ['fa', 'en']) {
    const body = await readFile(`${item.contentPath}/${language}.md`, 'utf8');
    assert.ok(body.length > 500);
    assert.ok(!item.relatedIds?.length);
    for (const match of body.matchAll(/\]\(\/learning\/([a-z0-9-]+)/g)) assert.ok(known.has(match[1]), match[1]);
    assert.doesNotMatch(body, /reset --hard|clean -fd|push --force/);
  }
});

test('documented local Git exercise creates two commits and a reviewed feature branch', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'vibehub-git-lesson-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_AUTHOR_NAME: 'Lesson Test', GIT_AUTHOR_EMAIL: 'lesson@example.com', GIT_COMMITTER_NAME: 'Lesson Test', GIT_COMMITTER_EMAIL: 'lesson@example.com' } });
  git('init', '-b', 'main');
  await writeFile(join(cwd, 'notes.txt'), 'First note\n');
  git('status'); git('add', 'notes.txt'); git('commit', '-m', 'Add first note');
  await writeFile(join(cwd, 'notes.txt'), 'First note\nSecond note\n');
  assert.match(git('diff'), /Second note/);
  git('add', 'notes.txt'); git('commit', '-m', 'Add second note');
  assert.equal(git('log', '--oneline').trim().split('\n').length, 2);
  assert.match(git('diff', 'HEAD~1', 'HEAD', '--', 'notes.txt'), /Second note/);
  git('switch', '-c', 'practice/agent-note');
  assert.equal(git('branch', '--show-current').trim(), 'practice/agent-note');
  await writeFile(join(cwd, 'notes.txt'), 'First note\nSecond note\nAgent explanation\n');
  git('add', 'notes.txt'); assert.match(git('diff', '--staged'), /Agent explanation/);
  git('commit', '-m', 'Clarify practice notes');
  assert.equal(git('status', '--porcelain').trim(), '');
});
