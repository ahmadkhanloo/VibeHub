import { cp, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { appManifestSchema, assertNoExecutablePayload, newsFeedSchema, parseLearningIndex } from '../packages/core/src/schemas.ts';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildContentSite(destination = join(projectRoot, 'dist-pages')) {
  const outputRoot = resolve(destination);
  const feedRoot = join(outputRoot, 'feed');
  const contentRoot = join(projectRoot, 'content');
  await mkdir(feedRoot, { recursive: true });

  for (const name of ['apps', 'providers', 'learning', 'schemas', 'snapshots']) {
    const source = join(contentRoot, name);
    try {
      await cp(source, join(feedRoot, name), { recursive: true, force: true });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  await cp(join(contentRoot, 'news'), join(feedRoot, 'news'), { recursive: true, force: true });

  await cp(join(projectRoot, 'docs/tutorials'), join(feedRoot, 'guides'), { recursive: true, force: true });

  const offersSource = join(contentRoot, 'offers');
  const offersTarget = join(feedRoot, 'offers');
  await mkdir(offersTarget, { recursive: true });
  await cp(offersSource, offersTarget, {
    recursive: true,
    force: true,
    filter: (source) => source !== join(offersSource, 'index.json'),
  });
  await copyFile(join(offersSource, 'index.json'), join(feedRoot, 'index.json'));

  const index = JSON.parse(await readFile(join(feedRoot, 'index.json'), 'utf8'));
  if (!Array.isArray(index.apps) || !Array.isArray(index.providers) || !Array.isArray(index.offers)) {
    throw new Error('content feed index is missing required arrays');
  }

  const learningSource = parseLearningIndex(JSON.parse(await readFile(join(contentRoot, 'learning', 'index.json'), 'utf8')));
  const learningArticles = [];
  for (const article of learningSource.articles) {
    const sourceDir = article.contentPath ?? `docs/tutorials/${article.id}`;
    const sources = await Promise.all(['fa', 'en'].map(async lang => {
      const directoryPath = join(projectRoot, sourceDir, `${lang}.md`);
      try { await access(directoryPath); return directoryPath; }
      catch { return join(projectRoot, `${sourceDir}.${lang}.md`); }
    }));
    const [fa, en] = await Promise.all(sources.map(path => readFile(path, 'utf8')));
    const { contentPath: _contentPath, ...publishedArticle } = article;
    learningArticles.push({ ...publishedArticle, body: { fa: fa.trim(), en: en.trim() } });
  }
  for (let order = 0; order < index.apps.length; order++) {
    const id = index.apps[order];
    const app = appManifestSchema.parse(JSON.parse(await readFile(join(contentRoot, 'apps', `${id}.json`), 'utf8')));
    const [fa, en] = await Promise.all(['fa', 'en'].map(lang => readFile(join(projectRoot, 'docs', 'tutorials', id, `${lang}.md`), 'utf8')));
    learningArticles.push({
      id, category: 'applications', kind: 'guide', order: 200 + order,
      title: { fa: app.name, en: app.name }, summary: app.summary,
      sourceUrl: app.docsUrl ?? app.websiteUrl, checkedAt: app.lastVerified,
      appId: id, body: { fa: fa.trim(), en: en.trim() },
    });
  }
  const learningFeed = { ...learningSource, articles: learningArticles };
  assertNoExecutablePayload(JSON.stringify(learningFeed));
  await writeFile(join(feedRoot, 'learning', 'index.json'), JSON.stringify(learningFeed, null, 2) + '\n', 'utf8');

  const news = newsFeedSchema.parse(JSON.parse(await readFile(join(contentRoot, 'news', 'index.json'), 'utf8')));
  assertNoExecutablePayload(JSON.stringify(news));

  await writeFile(
    join(outputRoot, 'index.html'),
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VibeHub content feed</title><body><h1>VibeHub content feed</h1><p>This site serves validated catalog, guide, and offer data.</p><p><a href="./feed/index.json">Open feed index</a></p></body></html>\n',
    'utf8'
  );
  await writeFile(join(outputRoot, '.nojekyll'), '', 'utf8');
  return { outputRoot, appCount: index.apps.length, providerCount: index.providers.length, offerCount: index.offers.length, articleCount: learningArticles.length, newsCount: news.news.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const destination = process.argv[2] ? resolve(process.argv[2]) : undefined;
  buildContentSite(destination)
    .then((result) => {
      process.stdout.write(`Prepared VibeHub content site: ${result.appCount} apps, ${result.providerCount} providers, ${result.offerCount} offers.\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
