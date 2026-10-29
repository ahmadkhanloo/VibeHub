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
import { assertNoExecutablePayload } from '@core';
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

export interface FeedSyncResult {
  ok: boolean;
  updated: boolean;
  detail: string;
  generatedAt?: string;
  catalog?: Catalog;
  guides?: Record<string, string>;
}

const feedFlights = new Map<string, Promise<FeedSyncResult>>();
const accountReads = new Map<string, Promise<DesktopAccountsSnapshot>>();

export const ipc = {
  appPath: (appId: string, path: string) => invoke<void>('app_path', { appId, path }),
  appAccounts: (appId: string, action: string, payload: Record<string, unknown> = {}) => {
    if (action !== 'list') return invoke<DesktopAccountsSnapshot>('app_accounts', { appId, action, payload });
    const current = accountReads.get(appId); if (current) return current;
    const pending = invoke<DesktopAccountsSnapshot>('app_accounts', { appId, action, payload }).finally(() => { if (accountReads.get(appId) === pending) accountReads.delete(appId); });
    accountReads.set(appId, pending); return pending;
  },
  codexAccounts: (action: AccountsAction, payload: Record<string, unknown> = {}) => invoke<AccountsSnapshot>('codex_accounts', { action, payload }),
  detectApps: () => invoke<DetectedApp[]>('detect_apps'),
  detectEditors: () => invoke<DetectedEditor[]>('detect_editors'),
  rtlComponents: () => invoke<RtlComponentStatus[]>('rtl_components'),
  launchEditor: (editorId: string, rtl = false) => invoke<EditorLaunchOutcome>('launch_editor', { editorId, rtl }),
  focusApp: (appId: string) => invoke<LaunchOutcome>('launch_app', { req: { appId, rtl: false, focus: true } }),
  launchApp: (req: LaunchRequest) => invoke<LaunchOutcome>('launch_app', { req }),
  launchStates: (appIds: string[]) => invoke<Record<string, LaunchState>>('launch_states', { appIds }),
  launchState: (appId: string) => invoke<LaunchState>('launch_state', { appId }),
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
    invoke<ProviderConnection[]>('provider_connection_save', { connection, key }),
  providerConnectionDelete: (id: string) => invoke<ProviderConnection[]>('provider_connection_delete', { id }),
  providerCredentialsInventory: () => invoke<ProviderCredentialInventory>('provider_credentials_inventory'),
  providerCredentialsClear: (connectionIds: string[], legacyProviderIds: string[]) =>
    invoke<CredentialClearResult>('provider_credentials_clear', { connectionIds, legacyProviderIds }),
  providerConnectionModels: (id: string) => invoke<{ models: { id: string; free: boolean | null }[]; checkedAt: string }>('provider_connection_models', { id }),
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
    applyRemoteCatalog(catalog, guides);
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
};

export type AccountsAction = 'list' | 'login' | 'cancel' | 'import' | 'importJson' | 'refresh' | 'rename' | 'delete' | 'switch' | 'dismiss' | 'settings';
export interface CodexAccount {
  id: string; name: string; email: string; plan: string | null; checkedAt: number | null; error: string | null;
  windows: { bucket: string; name: string; remaining: number | null; minutes: number | null; resetsAt: number | null }[];
}
export interface AccountsSnapshot {
  previousId?: string | null;
  accounts: CodexAccount[]; activeId: string | null; pendingId: string | null; notice: string | null;
  settings: { enabled: boolean; threshold: number }; lastSwitch: number; cliReady: boolean; nativePreview?: boolean;
  supportedVersion: string; desktopRunning: boolean; desktopVerified: boolean; loginPending: boolean;
}

export interface DesktopAccount {
  id: string; name: string; email: string; plan: string; checkedAt: number | null; error: string | null;
  quotaError?: string | null; expiresAt?: number | null;
  usage: { label: string; remaining?: number | null; granted?: number | string | null; unit: string; resetsAt?: number | string | null }[];
}
export interface DesktopAccountsSnapshot {
  appId: string; accounts: DesktopAccount[]; activeId: string | null; notice: string | null;
  version: string; supportedVersion: string; desktopRunning: boolean; liveSwitchVerified: boolean;
  capabilities: { canImport: boolean; canLogin: boolean; canRefresh: boolean; canSwitch: boolean };
}
