// Zod schemas for catalog/provider/offer content. `scripts/validate-content.mjs`
// and the GitHub Actions content workflow reject anything that does not parse,
// and reject schema versions we do not understand (plan §5.3).
import { z } from 'zod';

const localized = z.object({ fa: z.string().min(1), en: z.string().min(1) });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/, 'UTC ISO 8601 date required');
const verification = z.enum(['verified', 'reported', 'unknown', 'unsupported']);
const freeAccess = z.enum(['free_forever', 'free_tier', 'trial', 'ad_supported', 'unknown']);

export const schemaVersion = z.literal(1);

const tutorialText = z.object({ fa: z.string().trim().min(1).max(32768), en: z.string().trim().min(1).max(32768) }).strict();
export const learningTutorialSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(128),
  name: z.string().trim().min(1).max(256),
  kind: z.enum(['skill', 'plugin', 'extension']),
  topic: z.enum(['ui', 'documents', 'testing', 'models', 'integrations', 'extensions']).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  order: z.number().int().min(0).max(10000).optional(),
  source: z.string().url().refine(value => new URL(value).protocol === 'https:', 'HTTPS source required'),
  checked: z.string().date(),
  summary: tutorialText,
  compatibility: tutorialText,
  prerequisites: tutorialText,
  install: tutorialText,
  use: tutorialText,
  remove: tutorialText,
  troubleshoot: tutorialText,
}).strict();

export type LearningTutorial = z.infer<typeof learningTutorialSchema>;

export function parseLearningTutorials(raw: unknown): LearningTutorial[] {
  const entries = z.array(learningTutorialSchema).max(1000).parse(raw);
  const ids = new Set<string>();
  for (const item of entries) {
    if (ids.has(item.id)) throw new Error(`Duplicate tutorial: ${item.id}`);
    ids.add(item.id);
  }
  assertNoExecutablePayload(JSON.stringify(entries));
  return entries;
}

const bilingualMarkdown = z.object({
  fa: z.string().trim().min(1).max(128 * 1024),
  en: z.string().trim().min(1).max(128 * 1024),
}).strict();

export const learningCategorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(64),
  title: localized,
}).strict();

export const learningArticleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(128),
  category: z.string().regex(/^[a-z0-9-]+$/).max(64),
  kind: z.enum(['guide', 'skill', 'workflow']),
  order: z.number().int().min(0).max(10000),
  title: localized,
  summary: localized,
  sourceUrl: z.string().url().refine(value => new URL(value).protocol === 'https:', 'HTTPS source required'),
  checkedAt: isoDate,
  appId: z.string().regex(/^[a-z0-9-]+$/).max(128).optional(),
  relatedIds: z.array(z.string().regex(/^[a-z0-9-]+$/).max(128)).max(12).optional(),
  body: bilingualMarkdown,
}).strict();

export const learningFeedSchema = z.object({
  schemaVersion,
  categories: z.array(learningCategorySchema).max(100),
  articles: z.array(learningArticleSchema).max(1000),
}).strict();
export const learningIndexArticleSchema = learningArticleSchema.omit({ body: true }).extend({
  contentPath: z.string().regex(/^(docs\/tutorials|content\/learning\/articles)\/[a-z0-9-]+$/).optional(),
}).strict();
export const learningIndexSchema = z.object({
  schemaVersion,
  categories: z.array(learningCategorySchema).max(100),
  articles: z.array(learningIndexArticleSchema).max(1000),
}).strict();
export type LearningCategory = z.infer<typeof learningCategorySchema>;
export type LearningArticle = z.infer<typeof learningArticleSchema>;
export type LearningIndexArticle = z.infer<typeof learningIndexArticleSchema>;

export function parseLearningIndex(raw: unknown) {
  const index = learningIndexSchema.parse(raw);
  const categories = new Set<string>();
  for (const category of index.categories) {
    if (categories.has(category.id)) throw new Error(`Duplicate learning category: ${category.id}`);
    categories.add(category.id);
  }
  const articles = new Set<string>();
  for (const article of index.articles) {
    if (articles.has(article.id)) throw new Error(`Duplicate learning article: ${article.id}`);
    if (!categories.has(article.category)) throw new Error(`Unknown learning category: ${article.category}`);
    articles.add(article.id);
  }
  for (const article of index.articles) {
    for (const relatedId of article.relatedIds ?? []) {
      if (!articles.has(relatedId)) throw new Error(`Unknown related learning article: ${relatedId}`);
    }
  }
  assertNoExecutablePayload(JSON.stringify(index));
  return index;
}

export function parseLearningFeed(raw: unknown) {
  const feed = learningFeedSchema.parse(raw);
  const categories = new Set<string>();
  for (const category of feed.categories) {
    if (categories.has(category.id)) throw new Error(`Duplicate learning category: ${category.id}`);
    categories.add(category.id);
  }
  const articles = new Set<string>();
  for (const article of feed.articles) {
    if (articles.has(article.id)) throw new Error(`Duplicate learning article: ${article.id}`);
    if (!categories.has(article.category)) throw new Error(`Unknown learning category: ${article.category}`);
    articles.add(article.id);
  }
  for (const article of feed.articles) {
    for (const relatedId of article.relatedIds ?? []) {
      if (!articles.has(relatedId)) throw new Error(`Unknown related learning article: ${relatedId}`);
    }
  }
  assertNoExecutablePayload(JSON.stringify(feed));
  return feed;
}

export const newsArticleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(128),
  title: localized,
  summary: localized,
  body: bilingualMarkdown,
  appId: z.string().regex(/^[a-z0-9-]+$/).max(128).optional(),
  publishedAt: isoDate,
  checkedAt: isoDate,
  sourceUrl: z.string().url().refine(value => new URL(value).protocol === 'https:', 'HTTPS source required'),
}).strict();

export const newsFeedSchema = z.object({
  schemaVersion,
  news: z.array(newsArticleSchema).max(1000),
}).strict();

export function parseNewsFeed(raw: unknown) {
  const feed = newsFeedSchema.parse(raw);
  const ids = new Set<string>();
  for (const item of feed.news) {
    if (ids.has(item.id)) throw new Error(`Duplicate news item: ${item.id}`);
    ids.add(item.id);
  }
  assertNoExecutablePayload(JSON.stringify(feed));
  return feed.news;
}

export const appManifestSchema = z.object({
  schemaVersion,
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  summary: localized,
  kind: z.enum(['desktop_ide', 'desktop_agent', 'cli_agent']),
  platforms: z.array(z.enum(['windows', 'linux', 'macos'])).min(1),
  websiteUrl: z.string().url(),
  docsUrl: z.string().url().optional(),
  sourceRepoUrl: z.string().url().optional(),
  licenseSpdx: z.string().optional(),
  isOpenSource: z.boolean().nullable(),
  freeAccess,
  freeAccessDetails: localized,
  requiresSignup: z.boolean().nullable(),
  requiresPaymentCard: z.boolean().nullable(),
  sourceOfFreeAccess: z.string().url(),
  lastVerified: isoDate,
  capabilities: z.object({
    install: verification,
    launch: verification,
    rtl: verification,
    proxy: verification,
    terminal: verification,
    byok: verification,
  }),
  installMethods: z
    .array(
      z.object({
        method: z.enum(['winget', 'npm', 'official-installer', 'guide']),
        idOrUrl: z.string().min(1),
        note: localized.optional(),
      })
    )
    .optional(),
  eligibility: z
    .array(
      z.object({
        countryCode: z.string().length(2),
        networkAccess: z.enum(['direct_tested', 'proxy_may_be_needed', 'blocked', 'not_tested']),
        accountPolicy: z.enum(['supported', 'restricted', 'unknown', 'review_terms']),
        sourceUrl: z.string().url().optional(),
        testedAt: isoDate.optional(),
        networkType: z.string().optional(),
        confidence: z.enum(['high', 'medium', 'low']).optional(),
        verifiedBy: z.string().optional(),
        regionNotes: localized.optional(),
      })
    )
    .optional(),
  referral: z
    .object({ url: z.string().url(), disclosureFa: z.string().min(1), disclosureEn: z.string().min(1) })
    .optional(),
}).strict();

export const providerManifestSchema = z.object({
  schemaVersion,
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  logo: z.string().regex(/^[a-z0-9-]+$/).optional(),
  officialUrl: z.string().url(),
  keyUrl: z.string().url().optional(),
  gettingStarted: localized.optional(),
  modelsDocUrl: z.string().url().optional(),
  freeAccess,
  requiresAccount: z.boolean().nullable(),
  requiresApiKey: z.boolean().nullable(),
  usageTermsUrl: z.string().url(),
  supportedApps: z.record(z.string(), verification),
  eligibilityStatus: z.enum(['verified', 'reported', 'unknown']),
  lastVerified: isoDate,
  notes: localized,
  endpoint: z
    .object({
      baseUrl: z.string().url(),
      kind: z.enum(['openai-compatible', 'ollama', 'nvidia-nim', 'openrouter']),
    })
    .optional(),
}).strict();

export const offerSchema = z.object({
  schemaVersion,
  offerId: z.string().regex(/^[a-z0-9-]+$/),
  appId: z.string().regex(/^[a-z0-9-]+$/).optional(),
  title: localized,
  summary: localized,
  sourceUrl: z.string().url(),
  publishedAt: isoDate,
  verifiedAt: isoDate,
  startAt: isoDate.optional(),
  endAt: isoDate.optional(),
  eligibility: z.string().optional(),
  regionNotes: localized.optional(),
  freeAccessChange: z.boolean().optional(),
  status: z.enum(['verified', 'reported']),
  checkedAt: isoDate.optional(),
  sourceState: z.enum(['fresh', 'stale', 'unavailable']).optional(),
  revision: z.string().max(128).optional(),
  benefit: z.object({ quantity: z.number().nonnegative().optional(), unit: z.enum(['credits', 'tokens', 'free-model']), model: z.string().max(128).optional() }).strict().optional(),
  claim: z.object({ required: z.boolean(), url: z.string().url(), dailyAt: z.string().regex(/^\d{2}:\d{2}$/).optional(), timeZone: z.string().max(64).optional(), expiresAfterDays: z.number().positive().optional() }).strict().optional(),
  usageWindow: z.object({ from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/), timeZone: z.string().max(64) }).strict().optional(),
}).strict();

export const feedIndexSchema = z.object({
  schemaVersion,
  generatedAt: isoDate,
  minClientVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  apps: z.array(z.string()),
  providers: z.array(z.string()),
  offers: z.array(z.string()),
});

/** Remote content must never carry executable payloads (plan §5.3 / SEC-01). */
export function assertNoExecutablePayload(text: string): void {
  const forbidden = [
    /<script/i,
    /javascript:/i,
    /on[a-z]+\s*=/i,
    /powershell\s+-/i,
    /cmd\s+\/c/i,
    /curl\s+[|]/i,
    /\bnpx\s+http/i,
  ];
  for (const re of forbidden) {
    if (re.test(text)) {
      throw new Error(`content rejected: executable/HTML payload matched ${re}`);
    }
  }
}
