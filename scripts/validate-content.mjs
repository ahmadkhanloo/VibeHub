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
  parseLearningTutorials,
  parseLearningIndex,
  parseLearningFeed,
  parseNewsFeed,
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
  const tutorials = parseLearningTutorials(await readJson('content/learning/extensions.json'));
  console.log(`OK legacy learning tutorials (${tutorials.length})`);
} catch (e) { fail('learning tutorials', e); }

try {
  const index = parseLearningIndex(await readJson('content/learning/index.json'));
  const articles = [];
  for (const article of index.articles) {
    const sourceDir = article.contentPath ?? `docs/tutorials/${article.id}`;
    const readLanguage = async (lang) => {
      const candidates = [
        join(root, sourceDir, `${lang}.md`),
        join(root, `${sourceDir}.${lang}.md`),
      ];
      for (const path of candidates) {
        try {
          const text = await readFile(path, 'utf8');
          assertNoExecutablePayload(text);
          return text.trim();
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
      throw new Error(`Missing ${lang} Markdown for ${article.id}`);
    };
    const [fa, en] = await Promise.all([readLanguage('fa'), readLanguage('en')]);
    const { contentPath: _contentPath, ...metadata } = article;
    articles.push({ ...metadata, body: { fa, en } });
  }
  const feed = parseLearningFeed({ schemaVersion: index.schemaVersion, categories: index.categories, articles });
  console.log(`OK learning article feed (${feed.articles.length} articles, ${feed.categories.length} categories)`);
} catch (e) { fail('learning article feed', e); }

try {
  const news = parseNewsFeed(await readJson('content/news/index.json'));
  console.log(`OK news feed (${news.length} items)`);
} catch (e) { fail('news feed', e); }

if (failures) {
  console.error(`\n${failures} content validation failure(s)`);
  process.exit(1);
}
console.log('\nAll content valid.');
