import { useMemo, useSyncExternalStore } from 'react';
// Bundled catalog snapshot — the offline baseline (plan §4.4). Remote refresh
// overlays this via the feed_sync IPC after schema validation on the Rust side.

import { loadCatalog, classifyOffers, type Catalog, type OfferView } from '@catalog';
import { assertNoExecutablePayload, parseLearningIndex, parseLearningFeed, parseNewsFeed, type LearningArticle, type LearningCategory, type AppManifest, type ProviderManifest } from '@core';
import bundledLearningIndex from '../../../../content/learning/index.json';
import bundledNews from '../../../../content/news/index.json';

const appModules = import.meta.glob('../../../../content/apps/*.json', { eager: true, import: 'default' });
const providerModules = import.meta.glob('../../../../content/providers/*.json', { eager: true, import: 'default' });
const offerModules = import.meta.glob('../../../../content/offers/*.json', { eager: true, import: 'default' });
const guideModules = import.meta.glob('../../../../docs/tutorials/**/*.md', { eager: true, import: 'default', query: '?raw' }) as Record<string, string>;
const learningModules = import.meta.glob('../../../../content/learning/articles/**/*.md', { eager: true, import: 'default', query: '?raw' }) as Record<string, string>;

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
function localArticleBody(id: string, path: string | undefined, lang: 'fa' | 'en') {
  const folder = path ?? `docs/tutorials/${id}`;
  const modules = folder.startsWith('content/learning/articles/') ? learningModules : guideModules;
  const file = Object.entries(modules).find(([key]) => key.endsWith(`/${folder.split('/').at(-1)}/${lang}.md`) || key.endsWith(`/${folder.split('/').at(-1)}.${lang}.md`));
  return file?.[1]?.trim() ?? '';
}
function bundledArticleFeed() {
  const articles = initialLearningIndex.articles.map(({ contentPath, ...item }) => ({
    ...item, body: { fa: localArticleBody(item.id, contentPath, 'fa'), en: localArticleBody(item.id, contentPath, 'en') },
  }));
  for (const [order, app] of apps.entries()) {
    articles.push({
      id: app.id, category: 'applications', kind: 'guide' as const, order: 200 + order,
      title: { fa: app.name, en: app.name }, summary: app.summary,
      sourceUrl: app.docsUrl ?? app.websiteUrl, checkedAt: app.lastVerified, appId: app.id,
      body: { fa: localArticleBody(app.id, undefined, 'fa'), en: localArticleBody(app.id, undefined, 'en') },
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
const bundledAppIds = new Set(['antigravity-ide', 'claude-code', 'claude-desktop', 'copilot-cli']);

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
  providers.splice(0, providers.length, ...catalog.providers);
  bundledCatalog.offers.splice(0, bundledCatalog.offers.length, ...catalog.offers);
  for (const key of Object.keys(remoteGuides)) delete remoteGuides[key];
  Object.assign(remoteGuides, guides);
  if (nextArticles !== undefined) {
    articles = [...nextArticles.articles.filter(article => article.id !== 'antigravity' && !bundledAppIds.has(article.id)), ...initialLearningFeed.articles.filter(article => bundledAppIds.has(article.id))];
    categories = nextArticles.categories;
    // The bundled replacement guides use the existing apps category.
    for (const category of initialLearningCategories) if (!categories.some(item => item.id === category.id) && articles.some(article => article.category === category.id)) categories = [...categories, category];
  }
  if (nextNews !== undefined) news = nextNews;
  revision++; listeners.forEach(listener=>listener());
  window.dispatchEvent(new Event('vibehub:catalog-updated'));
  try { localStorage.setItem('vibehub.content.v1', JSON.stringify({ catalog, guides, learningArticles: { schemaVersion: 1, categories, articles }, news: { schemaVersion: 1, news } })); } catch { /* Current in-memory content remains usable. */ }
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

export function guideText(appId: string, lang: 'fa' | 'en'): string | null {
  const remote = bundledAppIds.has(appId) ? undefined : remoteGuides[`${appId}/${lang}`];
  if (remote) return remote;
  const hit = Object.entries(guideModules).find(([p]) => p.includes(`/${appId}/${lang}.md`));
  return hit?.[1]?.trim() ? hit[1] : null;
}

export { classifyOffers };
export type { OfferView };
