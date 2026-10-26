// VibeHub core domain types — shared by the desktop UI, the catalog loader and
// the content validation scripts. Mirrors the Persian master plan §5.
// Remote catalog data is DATA ONLY: no commands, no URLs to execute, no HTML.

export type Verification = 'verified' | 'reported' | 'unknown' | 'unsupported';
export type Capability = 'install' | 'launch' | 'rtl' | 'proxy' | 'terminal' | 'byok';
export type FreeAccess = 'free_forever' | 'free_tier' | 'trial' | 'ad_supported' | 'unknown';

export type LocalizedText = { fa: string; en: string };

export interface AppManifest {
  id: string;
  name: string;
  summary: LocalizedText;
  kind: 'desktop_ide' | 'desktop_agent' | 'cli_agent';
  platforms: ('windows' | 'linux' | 'macos')[];
  websiteUrl: string;
  docsUrl?: string;
  sourceRepoUrl?: string;
  licenseSpdx?: string;
  isOpenSource: boolean | null;
  freeAccess: FreeAccess;
  freeAccessDetails: LocalizedText;
  requiresSignup: boolean | null;
  requiresPaymentCard: boolean | null;
  sourceOfFreeAccess: string;
  lastVerified: string; // UTC ISO 8601
  capabilities: Record<Capability, Verification>;
  installMethods?: { method: 'winget' | 'npm' | 'official-installer' | 'guide'; idOrUrl: string; note?: LocalizedText }[];
  eligibility?: {
    countryCode: string;
    networkAccess: 'direct_tested' | 'proxy_may_be_needed' | 'blocked' | 'not_tested';
    accountPolicy: 'supported' | 'restricted' | 'unknown' | 'review_terms';
    sourceUrl?: string;
    testedAt?: string;
    networkType?: string;
    confidence?: 'high' | 'medium' | 'low';
    verifiedBy?: string;
    regionNotes?: LocalizedText;
  }[];
  referral?: { url: string; disclosureFa: string; disclosureEn: string };
}

export interface ProviderManifest {
  id: string;
  name: string;
  officialUrl: string;
  modelsDocUrl?: string;
  freeAccess: FreeAccess;
  requiresAccount: boolean | null;
  requiresApiKey: boolean | null;
  usageTermsUrl: string;
  supportedApps: Record<string, Verification>;
  eligibilityStatus: 'verified' | 'reported' | 'unknown';
  lastVerified: string;
  notes: LocalizedText;
  endpoint?: { baseUrl: string; kind: 'openai-compatible' | 'ollama' | 'nvidia-nim' | 'openrouter' };
}

export interface Offer {
  offerId: string;
  appId?: string;
  title: LocalizedText;
  summary: LocalizedText;
  sourceUrl: string;
  publishedAt: string;
  verifiedAt: string;
  startAt?: string;
  endAt?: string;
  eligibility?: string;
  regionNotes?: LocalizedText;
  freeAccessChange?: boolean;
  status: 'verified' | 'reported';
}

export interface GuideMeta {
  appId: string;
  lang: 'fa' | 'en';
  title: string;
  updatedAt: string;
  sections: string[];
}

export type ProxyMode = 'direct' | 'system' | 'http' | 'socks5';

export interface ProxyProfile {
  id: string;
  name: string;
  mode: ProxyMode;
  host?: string;
  port?: number;
  username?: string;
  /** Stored in the OS credential vault, never in plain settings files. */
  hasPassword?: boolean;
}

export interface ProxyConfig {
  globalProfileId: string;
  requireProxy: boolean;
  perApp: Record<string, string | 'inherit'>;
}

export type ProxyTestLevel = 'tcp' | 'handshake' | 'request';

export interface ProxyTestResult {
  level: ProxyTestLevel;
  ok: boolean;
  detail: string;
  testedAt: string;
}

export interface DetectedApp {
  id: string;
  installed: boolean;
  version?: string;
  path?: string;
  via: string;
}

export interface LaunchRequest {
  appId: string;
  rtl: boolean;
  proxyProfileId?: string;
  cwd?: string;
}

export type LaunchState =
  | { phase: 'idle' }
  | { phase: 'starting'; detail?: string }
  | { phase: 'running'; since: string; rtl: boolean; port?: number }
  | { phase: 'failed'; error: string; hintKey?: string };

export interface DoctorCheck {
  id: string;
  label: LocalizedText;
  status: 'pass' | 'fail' | 'unknown' | 'skipped';
  detail?: string;
}

export interface TerminalSetupState {
  hasOhMyPosh: boolean;
  ohMyPoshVersion?: string;
  hasNerdFont: boolean;
  nerdFontName?: string;
  profilePath?: string;
  themeApplied: boolean;
  backupPath?: string;
}

export const CAPABILITY_KEYS: Capability[] = ['install', 'launch', 'rtl', 'proxy', 'terminal', 'byok'];
export const APP_IDS = ['zcode', 'qoder', 'deepseek-harness', 'opencode', 'mimocode', 'freebuff'] as const;
export type AppId = (typeof APP_IDS)[number];

export { appManifestSchema, providerManifestSchema, offerSchema, feedIndexSchema, assertNoExecutablePayload } from './schemas.ts';

export { preferredLaunchMode, launchBlocked, normalizeSearch, type LaunchMode } from './ux.ts';
