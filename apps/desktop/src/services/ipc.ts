// Typed IPC bridge. Unsupported app/package/proxy combinations reject explicitly.

import type {
  DetectedApp,
  DoctorCheck,
  LaunchRequest,
  LaunchState,
  ProxyProfile,
  ProxyTestResult,
  TerminalSetupState,
} from '@core';
import { invoke } from '@tauri-apps/api/core';
import { loadCatalog, type Catalog } from '@catalog';
import { assertNoExecutablePayload, parseLearningFeed, parseNewsFeed } from '@core';
import { applyRemoteCatalog, validateRemoteGuides } from '@/lib/catalog';

export interface LaunchOutcome {
  ok: boolean;
  rtl: boolean;
  port?: number;
  detail: string;
  errorKey?: string;
}

export interface InstallRunResult {
  ok: boolean;
  method: string;
  outputTail: string[];
  detected: DetectedApp | null;
}

export interface DetectedEditor {
  id: string;
  name: string;
  installed: true;
  path: string;
  via: 'registry' | 'standard-path';
  version?: string;
}

export interface RtlComponentStatus {
  id: string;
  available: boolean;
  configured: boolean;
  setupSupported?: boolean;
  reason?: string;
  testedVersion?: string;
}

export interface EditorLaunchOutcome {
  ok: boolean;
  id: string;
  pid?: number;
  rtl?: boolean;
  port?: number;
  injectorPid?: number;
  injectorPath?: string;
  since?: string;
  detail: string;
}

export interface FontInstallResult {
  ok: boolean;
  name: string;
  detail: string;
}

export interface ApiTestReport {
  authRequired?: boolean;
  dnsResolved: boolean;
  httpResponse: boolean;
  authValidated: boolean;
  modelResponded: boolean;
  httpStatus?: number;
  redactedError?: string;
}

export interface ModelList {
  models: { id: string; free: boolean | null }[];
  checkedAt: string;
}

export interface ProviderConnection {
  id: string;
  name: string;
  providerId: string;
  baseUrl: string;
  modelId: string;
  hasKey: boolean;
}

export interface ProviderCredentialInventory {
  connections: ProviderConnection[];
  legacyProviderIds: string[];
}

export interface CredentialClearResult {
  deletedConnectionIds: string[];
  deletedLegacyProviderIds: string[];
  failures: { kind: 'connection' | 'legacy'; id: string; errorKey: string }[];
}

export interface ClaudePersianTerminal {
  ok: boolean;
  installed: boolean;
  opened: boolean;
  claudeStarted: false;
  proxyRoutingVerified: false;
  quickInputAvailable: boolean;
  version: string;
  command: string;
  cwd: string;
}

export interface FeedSyncResult {
  ok: boolean;
  updated: boolean;
  detail: string;
  generatedAt?: string;
  catalog?: Catalog;
  guides?: Record<string, string>;
  learningArticles?: unknown;
  news?: unknown;
}

const feedFlights = new Map<string, Promise<FeedSyncResult>>();
const codexAccountReads = new Map<string, Promise<AccountsSnapshot>>();

function connectionsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('vibehub:connections-changed'));
}

export const ipc = {
  appPath: (appId: string, path: string) => invoke<void>('app_path', { appId, path }),
  codexAccounts: (action: AccountsAction, payload: Record<string, unknown> = {}) => {
    if (action !== 'list') return invoke<AccountsSnapshot>('codex_accounts', { action, payload });
    const key = String(payload.language ?? '');
    const current = codexAccountReads.get(key); if (current) return current;
    const pending = invoke<AccountsSnapshot>('codex_accounts', { action, payload }).finally(() => { if (codexAccountReads.get(key) === pending) codexAccountReads.delete(key); });
    codexAccountReads.set(key, pending); return pending;
  },
  detectApps: () => invoke<DetectedApp[]>('detect_apps'),
  detectEditors: () => invoke<DetectedEditor[]>('detect_editors'),
  rtlComponents: () => invoke<RtlComponentStatus[]>('rtl_components'),
  rtlSetup: (appId: string) => invoke<{ ok: boolean; shortcut: string }>('rtl_setup', { appId }),
  launchEditor: (editorId: string, rtl = false) => invoke<EditorLaunchOutcome>('launch_editor', { editorId, rtl }),
  focusEditor: (editorId: string) => invoke<EditorLaunchOutcome>('focus_editor', { editorId }),
  focusApp: (appId: string) => invoke<LaunchOutcome>('launch_app', { req: { appId, rtl: false, focus: true } }),
  launchApp: (req: LaunchRequest) => invoke<LaunchOutcome>('launch_app', { req }),
  launchStates: (appIds: string[]) => invoke<Record<string, LaunchState>>('launch_states', { appIds }),
  launchState: (appId: string) => invoke<LaunchState>('launch_state', { appId }),
  traySync: (apps: { id: string; name: string; running?: boolean }[]) => invoke<void>('tray_update', { apps }),
  stopRtl: (appId: string) => invoke<boolean>('stop_rtl', { appId }),

  installWinget: (appId: string) => invoke<InstallRunResult>('install_winget', { appId }),
  installNpm: (appId: string, packageName: string) => invoke<InstallRunResult>('install_npm', { appId, packageName }),

  proxyProfiles: () => invoke<ProxyProfile[]>('proxy_list'),
  proxySave: (profile: ProxyProfile, password?: string) => invoke<ProxyProfile[]>('proxy_save', { profile, password }),
  proxyDelete: (id: string) => invoke<ProxyProfile[]>('proxy_delete', { id }),
  proxyConfig: () => invoke<{ globalProfileId: string; requireProxy: boolean; perApp: Record<string, string> }>('proxy_config'),
  proxySetConfig: (cfg: { globalProfileId: string; requireProxy: boolean; perApp: Record<string, string> }) =>
    invoke('proxy_set_config', { cfg }),
  proxyTest: (profile: ProxyProfile, level: 'tcp' | 'handshake' | 'request') =>
    invoke<ProxyTestResult>('proxy_test', { profile, level }),

  terminalDetect: () => invoke<TerminalSetupState>('terminal_detect'),
  claudePersianTerminal: (open = false, cwd?: string) => invoke<ClaudePersianTerminal>('claude_persian_terminal', { open, cwd }),
  terminalInstallPersian: () => invoke<{ ok: boolean; detail: string }>('terminal_install_persian'),
  terminalInstallOhMyPosh: () => invoke<InstallRunResult>('terminal_install_ohmyposh'),
  terminalInstallFont: (which: 'nerd' | 'vazirmatn') => invoke<FontInstallResult>('terminal_install_font', { which }),
  terminalApplyTheme: () => invoke<{ ok: boolean; backupPath?: string; detail: string }>('terminal_apply_theme'),
  terminalUndo: () => invoke<{ ok: boolean; detail: string }>('terminal_undo'),

  doctorRun: () => invoke<DoctorCheck[]>('doctor_run'),

  vaultSet: (service: string, key: string) => invoke('vault_set', { service, key }),
  vaultGet: (service: string) => invoke<string | null>('vault_get', { service }),
  vaultDelete: (service: string) => invoke('vault_delete', { service }),

  apiTest: (providerId: string, baseUrl: string, modelId: string, keyService: string) =>
    invoke<ApiTestReport>('api_test', { providerId, baseUrl, modelId, keyService }),
  providerConnections: () => invoke<ProviderConnection[]>('provider_connections'),
  providerConnectionSave: (connection: ProviderConnection, key?: string) =>
    invoke<ProviderConnection[]>('provider_connection_save', { connection, key }).then(result => { connectionsChanged(); return result; }),
  providerConnectionDelete: (id: string) => invoke<ProviderConnection[]>('provider_connection_delete', { id }).then(result => { connectionsChanged(); return result; }),
  providerCredentialsInventory: () => invoke<ProviderCredentialInventory>('provider_credentials_inventory'),
  providerCredentialsClear: (connectionIds: string[], legacyProviderIds: string[]) =>
    invoke<CredentialClearResult>('provider_credentials_clear', { connectionIds, legacyProviderIds }),
  providerNotes: () => invoke<Record<string, string>>('provider_notes'),
  providerNoteSave: (target: string, note: string) => invoke<Record<string, string>>('provider_note_save', { target, note }),
  providerConnectionPreviewTest: (connection: ProviderConnection, key?: string) => invoke<ApiTestReport>('provider_connection_preview_test', { connection, key }),
  providerConnectionCachedModels: () => invoke<Record<string, ModelList>>('provider_connection_cached_models'),
  providerConnectionModels: (id: string) => invoke<ModelList>('provider_connection_models', { id }),
  providerConnectionPreviewModels: (providerId: string, baseUrl: string, key?: string) =>
    invoke<ModelList>('provider_connection_preview_models', { providerId, baseUrl, key }),
  providerConnectionTest: (id: string) => invoke<ApiTestReport>('provider_connection_test', { id }),

  feedSync: async (feedBaseUrl: string): Promise<FeedSyncResult> => {
    const existing = feedFlights.get(feedBaseUrl); if (existing) return existing;
    const pending = (async () => {
    const result = await invoke<FeedSyncResult>('feed_sync', { feedBaseUrl });
    if (!result.ok || !result.catalog) throw new Error(result.detail || 'Incomplete content feed');
    // Shared strict schemas and executable-payload checks run before any data is used.
    assertNoExecutablePayload(JSON.stringify(result.catalog));
    const catalog = loadCatalog(result.catalog);
    const guides = validateRemoteGuides(result.guides, catalog);
    const learningArticles = result.learningArticles === undefined ? undefined : parseLearningFeed(result.learningArticles);
    const news = result.news === undefined ? undefined : parseNewsFeed(result.news);
    applyRemoteCatalog(catalog, guides, learningArticles, news);
    try { const stamps = JSON.parse(localStorage.getItem('vibehub.feed.success.v1') ?? '{}'); stamps[feedBaseUrl] = Date.now(); localStorage.setItem('vibehub.feed.success.v1', JSON.stringify(stamps)); localStorage.removeItem('vibehub.feed.failure.v1'); } catch { /* Valid in-memory catalog remains available. */ }
    window.dispatchEvent(new Event('vibehub:feed-synced'));
    return { ...result, catalog };
    })();
    feedFlights.set(feedBaseUrl, pending);
    try { return await pending; }
    catch (error) {
      try { localStorage.setItem('vibehub.feed.failure.v1', JSON.stringify({ url: feedBaseUrl, at: Date.now() })); } catch { /* Cache remains usable. */ }
      window.dispatchEvent(new Event('vibehub:feed-failed'));
      throw error;
    } finally { feedFlights.delete(feedBaseUrl); }
  },
  appVersion: () => invoke<string>('app_version'),
  claudeAccounts: (action: ClaudeAccountsAction, payload: Record<string, unknown> = {}) =>
    invoke<ClaudeAccountsSnapshot>('claude_accounts', { action, payload }),
  appAccounts: (appId: string, action: AppAccountsAction, payload: Record<string, unknown> = {}) =>
    invoke<AppAccountsSnapshot>('app_accounts', { appId, action, payload }),
  appQuota: (action: QuotaAction, payload: Record<string, unknown> = {}) =>
    invoke<AppQuotaSnapshot>('app_quota', { action, payload }),
  toolchainStatus: () => invoke<ToolchainStatus>('toolchain_status'),
};

/** Machine-level facts about the helper tools the workspace advertises. */
export interface ToolchainStatus {
  repowise: { installed: boolean; version: string | null };
  browsers: { edge: boolean; chrome: boolean };
  plugins: { superpowers: boolean };
  skills: {
    hindsight: boolean;
    dsh: boolean;
    ponytail: boolean;
    uiuxProMax: boolean;
    unslop: boolean;
  };
}

/** Apps whose session is an opaque blob that VibeHub swaps without decrypting it. */
export type OpaqueAccountApp = 'zcode' | 'qoder';
export type AppAccountsAction = 'list' | 'capture' | 'apply' | 'revert' | 'rename' | 'delete' | 'dismiss';
export interface AppAccount {
  id: string; name: string; size: number; files: string[]; active: boolean;
  capturedAt: number | null; updatedAt: number | null;
}
export interface AppAccountsSnapshot {
  app: OpaqueAccountApp;
  accounts: AppAccount[];
  activeId: string | null;
  notice: string | null;
  /** The app is running; capture and revert refuse, apply closes it first. */
  running: boolean;
  /** Required session files exist, i.e. the app has been signed in at least once. */
  filesPresent: boolean;
  /** The app rewrote its session since the last capture or switch. */
  sessionChanged: boolean;
  sessionPath: string;
  managedFiles: string[];
  backupCount: number;
  lastBackupAt: number | null;
  nativePreview?: boolean;
}

export type ClaudeAccountsAction = 'list' | 'save' | 'apply' | 'track' | 'rename' | 'delete' | 'dismiss';
export interface ClaudeAccount {
  id: string; name: string; label: string; active: boolean; updatedAt: number | null;
}
export interface ClaudeAccountsSnapshot {
  app: 'claude-code';
  accounts: ClaudeAccount[];
  activeId: string | null;
  notice: string | null;
  /** True when settings.json currently holds a token, so "save" can capture it. */
  configured: boolean;
  current: string | null;
  settingsPath: string | null;
  nativePreview?: boolean;
}

export type AccountsAction = 'list' | 'login' | 'cancel' | 'import' | 'importJson' | 'refresh' | 'rename' | 'delete' | 'switch' | 'dismiss' | 'settings';
export interface CodexAccount {
  id: string; name: string; email: string; plan: string | null; checkedAt: number | null; error: string | null;
  errorCode?: string | null; quotaErrorCode?: string | null; accountCheckedAt?: number | null;
  windows: { bucket: string; name: string; remaining: number | null; minutes: number | null; resetsAt: number | null }[];
}
export interface AccountsSnapshot {
  previousId?: string | null;
  errorCode?: string | null;
  accounts: CodexAccount[]; activeId: string | null; pendingId: string | null; notice: string | null;
  settings: { enabled: boolean; threshold: number }; lastSwitch: number; cliReady: boolean; nativePreview?: boolean;
  supportedVersion: string; cliVersion?: string | null; desktopRunning: boolean; desktopVerified: boolean; loginPending: boolean;
}

/** Apps that publish a daily quota that VibeHub reads from inside the app. */
export type QuotaAppId = 'qoder' | 'minimax-code';
export type QuotaStatus = 'ok' | 'signedOut' | 'appNotRunning' | 'notLaunchedByVibeHub' | 'unsupported' | 'error';
export type QuotaAction = 'list' | 'refresh' | 'claim';
export interface AppQuotaClaim {
  /** The app itself reports that a reward is waiting to be taken. */
  available: boolean;
  /** Taken today, when the app says so. */
  claimed: boolean | null;
  points: number | null;
  dayNo: number | null;
}
export interface AppQuota {
  appId: QuotaAppId;
  status: QuotaStatus;
  used: number | null;
  total: number | null;
  remaining: number | null;
  percent: number | null;
  unit: string;
  /** A second pool, shown next to the daily credits when it exists. */
  plan: { used: number | null; total: number | null; remaining: number | null; percent: number | null; unit?: string } | null;
  resetsAt: number | null;
  checkedAt: number | null;
  claim: AppQuotaClaim;
  error: string | null;
}
export interface AppQuotaSnapshot {
  nativePreview?: boolean;
  apps: AppQuota[];
  /** Present on the answer to a claim. */
  claim?: { appId: QuotaAppId; ok: boolean; error: string | null; points: number | null; dayNo: number | null };
}
