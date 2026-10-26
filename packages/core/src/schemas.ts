// Zod schemas for catalog/provider/offer content. `scripts/validate-content.mjs`
// and the GitHub Actions content workflow reject anything that does not parse,
// and reject schema versions we do not understand (plan §5.3).
import { z } from 'zod';

const localized = z.object({ fa: z.string().min(1), en: z.string().min(1) });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/, 'UTC ISO 8601 date required');
const verification = z.enum(['verified', 'reported', 'unknown', 'unsupported']);
const freeAccess = z.enum(['free_forever', 'free_tier', 'trial', 'ad_supported', 'unknown']);

export const schemaVersion = z.literal(1);

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
  officialUrl: z.string().url(),
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
