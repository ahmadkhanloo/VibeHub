import { useMemo, useSyncExternalStore } from 'react';
// Bundled catalog snapshot — the offline baseline (plan §4.4). Remote refresh
// overlays this via the feed_sync IPC after schema validation on the Rust side.

import { loadCatalog, classifyOffers, type Catalog, type OfferView } from '@catalog';
import { assertNoExecutablePayload, parseLearningIndex, parseLearningFeed, parseNewsFeed, type LearningArticle, type LearningCategory, type AppManifest, type ProviderManifest } from '@core';
import bundledLearningIndex from '../../../../content/learning/index.json';
import bundledNews from '../../../../content/news/index.json';
import { curriculum } from './learning-curriculum';

const appModules = import.meta.glob('../../../../content/apps/*.json', { eager: true, import: 'default' });
const providerModules = import.meta.glob('../../../../content/providers/*.json', { eager: true, import: 'default' });
const offerModules = import.meta.glob('../../../../content/offers/*.json', { eager: true, import: 'default' });
// Lesson and guide bodies are the heaviest text in the bundle; they load on
// demand so the entry chunk carries only titles, summaries and metadata.
const guideModules = import.meta.glob('../../../../docs/tutorials/**/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const learningModules = import.meta.glob('../../../../content/learning/articles/**/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

function values<T>(modules: Record<string, unknown>): T[] {
  return Object.values(modules) as T[];
}

// index.json is the feed index, not an offer — exclude it from the offers array.
const offerValues = Object.entries(offerModules)
  .filter(([path]) => !path.endsWith('index.json'))
  .map(([, v]) => v);

export const bundledCatalog: Catalog = loadCatalog({
  apps: values<unknown>(appModules),
  providers: values<unknown>(providerModules),
  offers: offerValues,
});

export const apps: AppManifest[] = bundledCatalog.apps;
export const providers: ProviderManifest[] = bundledCatalog.providers;

const remoteGuides: Record<string, string> = {};
const initialLearningIndex = parseLearningIndex(bundledLearningIndex);
const initialLearningCategories: LearningCategory[] = initialLearningIndex.categories;
// The feed schema trims body text before validation, and the catalog cache
// can contain bundled articles. Keep their loading marker valid in both places.
const PENDING_BODY = '<!-- Bundled Markdown loads on demand. -->';
const bodyCache = new Map<string, string>();
function bodyModule(id: string, path: string | undefined, lang: 'fa' | 'en'): (() => Promise<string>) | null {
  const folder = path ?? `docs/tutorials/${id}`;
  const modules = folder.startsWith('content/learning/articles/') ? learningModules : guideModules;
  const file = Object.keys(modules).find(key => key.endsWith(`/${folder.split('/').at(-1)}/${lang}.md`) || key.endsWith(`/${folder.split('/').at(-1)}.${lang}.md`));
  return file ? modules[file] ?? null : null;
}
/** Resolves the rendered Markdown for a lesson or guide. Remote-feed articles
 * carry their bodies inline; bundled ones stream from the lazy module graph. */
export async function articleBody(article: LearningArticle, lang: 'fa' | 'en'): Promise<string> {
  const inline = article.body[lang] || article.body[lang === 'fa' ? 'en' : 'fa'];
  if (inline && inline !== PENDING_BODY) return inline;
  const cacheKey = `${article.id}.${lang}`;
  const cached = bodyCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const loader = bodyModule(article.id, bundledContentPaths.get(article.id), lang);
  const body = loader ? await loader() : '';
  bodyCache.set(cacheKey, body);
  return body;
}
// The feed schema is strict (no contentPath), so the bundled body locations live
// in this map and articleBody resolves them per article id.
const bundledContentPaths = new Map<string, string>();
function bundledArticleFeed() {
  const articles = initialLearningIndex.articles.map(({ contentPath, ...item }) => {
    if (contentPath) bundledContentPaths.set(item.id, contentPath);
    return { ...item, body: { fa: PENDING_BODY, en: PENDING_BODY } };
  });
  for (const [order, app] of apps.entries()) {
    articles.push({
      id: app.id, category: 'applications', kind: 'guide' as const, order: 200 + order,
      title: { fa: app.name, en: app.name }, summary: app.summary,
      sourceUrl: app.docsUrl ?? app.websiteUrl, checkedAt: app.lastVerified, appId: app.id,
      body: { fa: PENDING_BODY, en: PENDING_BODY },
    });
  }
  return parseLearningFeed({ schemaVersion: 1, categories: initialLearningCategories, articles });
}
const initialLearningFeed = bundledArticleFeed();
let articles: LearningArticle[] = initialLearningFeed.articles;
let categories: LearningCategory[] = initialLearningFeed.categories;
let news = parseNewsFeed(bundledNews);
let revision = 0;
const listeners = new Set<() => void>();
export function useCatalog() {
 const version = useSyncExternalStore((listener) => {listeners.add(listener);return () => {listeners.delete(listener);};}, () => revision);
 return useMemo(() => ({apps: [...apps], providers: [...providers], offers: [...bundledCatalog.offers], articles: [...articles], categories: [...categories], news: [...news]}), [version]);
}
export function clearContentCache() {
 localStorage.removeItem('vibehub.content.v1');
 cachedLearningFeed = undefined;
 bodyCache.clear();
 apps.splice(0,apps.length,...initialCatalog.apps);
 providers.splice(0,providers.length,...initialCatalog.providers);
 bundledCatalog.offers.splice(0,bundledCatalog.offers.length,...initialCatalog.offers);
 articles = initialLearningFeed.articles;
 categories = initialLearningFeed.categories;
 news = parseNewsFeed(bundledNews);
 for (const key of Object.keys(remoteGuides)) delete remoteGuides[key];
 revision++;listeners.forEach(listener=>listener());
}
const initialCatalog = {apps: [...apps], providers: [...providers], offers: [...bundledCatalog.offers]};
const bundledAppIds = new Set(['antigravity-ide', 'claude-code', 'claude-desktop', 'copilot-cli', 'minimax-code', 'opencode', 'pi']);
const bundledLearningIds = new Set([
  ...bundledAppIds, ...curriculum, 'getting-started', 'rtl-setup',
  'code-review', 'debugging-with-agent', 'long-running', 'git-practice-resources',
]);
const newProviderIds = new Set(['ollama', 'cerebras']);
let cachedLearningFeed: ReturnType<typeof parseLearningFeed> | undefined;

export function validateRemoteGuides(raw: unknown, catalog: Catalog): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Incomplete guide feed');
  const guides: Record<string, string> = {};
  for (const app of catalog.apps) for (const lang of ['fa', 'en']) {
    const key = `${app.id}/${lang}`;
    const text = (raw as Record<string, unknown>)[key];
    if (typeof text !== 'string' || !text.trim() || text.length > 128 * 1024) throw new Error(`Invalid guide: ${key}`);
    assertNoExecutablePayload(text);
    guides[key] = text;
  }
  for (const lang of ['fa', 'en']) {
    const key = `code-review/${lang}`;
    const text = (raw as Record<string, unknown>)[key];
    if (text === undefined) continue; // Older feeds do not include this tutorial.
    if (typeof text !== 'string' || !text.trim() || text.length > 128 * 1024) throw new Error(`Invalid guide: ${key}`);
    assertNoExecutablePayload(text);
    guides[key] = text;
  }
  return guides;
}

export function applyRemoteCatalog(catalog: Catalog, guides: Record<string, string>, learningArticles?: ReturnType<typeof parseLearningFeed>, newsItems?: ReturnType<typeof parseNewsFeed>): void {
  const nextArticles = learningArticles;
  const nextNews = newsItems;
  // Keep the entries tied to this build when a cached feed predates them.
  const bundledApps = initialCatalog.apps.filter(app => bundledAppIds.has(app.id));
  const nextApps = [...catalog.apps.filter(app => !bundledAppIds.has(app.id)), ...bundledApps];
  apps.splice(0, apps.length, ...nextApps);
  const bundledProviders = initialCatalog.providers.filter(provider => newProviderIds.has(provider.id) && !catalog.providers.some(item => item.id === provider.id));
  providers.splice(0, providers.length, ...catalog.providers, ...bundledProviders);
  bundledCatalog.offers.splice(0, bundledCatalog.offers.length, ...catalog.offers);
  for (const key of Object.keys(remoteGuides)) delete remoteGuides[key];
  Object.assign(remoteGuides, guides);
  if (nextArticles !== undefined) {
    cachedLearningFeed = nextArticles;
    articles = [...nextArticles.articles.filter(article => article.id !== 'antigravity' && !bundledLearningIds.has(article.id)), ...initialLearningFeed.articles.filter(article => bundledLearningIds.has(article.id))];
    categories = nextArticles.categories;
    // The bundled replacement guides use the existing apps category.
    for (const category of initialLearningCategories) if (!categories.some(item => item.id === category.id) && articles.some(article => article.category === category.id)) categories = [...categories, category];
  }
  if (nextNews !== undefined) news = nextNews;
  revision++; listeners.forEach(listener=>listener());
  window.dispatchEvent(new Event('vibehub:catalog-updated'));
  // Bundled articles load locally and lack the inline body required by the remote schema.
  try { localStorage.setItem('vibehub.content.v1', JSON.stringify({ catalog, guides, learningArticles: cachedLearningFeed, news: { schemaVersion: 1, news } })); } catch { /* Current in-memory content remains usable. */ }
}

try {
  const cached = localStorage.getItem('vibehub.content.v1');
  if (cached) {
    assertNoExecutablePayload(cached);
    const raw = JSON.parse(cached);
    const catalog = loadCatalog(raw.catalog);
    const learningArticles = raw.learningArticles === undefined ? undefined : parseLearningFeed(raw.learningArticles);
    const newsItems = raw.news === undefined ? undefined : parseNewsFeed(raw.news);
    applyRemoteCatalog(catalog, validateRemoteGuides(raw.guides, catalog), learningArticles, newsItems);
  }
} catch { /* Invalid cache or unavailable storage: use the bundled snapshot. */ }

export async function guideText(appId: string, lang: 'fa' | 'en'): Promise<string | null> {
  const remote = bundledAppIds.has(appId) ? undefined : remoteGuides[`${appId}/${lang}`];
  if (remote) return remote;
  const key = Object.keys(guideModules).find(p => p.includes(`/${appId}/${lang}.md`));
  const loader = key ? guideModules[key] : undefined;
  const text = loader ? await loader() : null;
  return text?.trim() ? text : null;
}

export { classifyOffers };
export type { OfferView };
