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
  pid: number;
  detail: string;
}

export interface FontInstallResult {
  ok: boolean;
  name: string;
  detail: string;
}

export interface ApiTestReport {
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

export const ipc = {
  detectApps: () => invoke<DetectedApp[]>('detect_apps'),
  detectEditors: () => invoke<DetectedEditor[]>('detect_editors'),
  rtlComponents: () => invoke<RtlComponentStatus[]>('rtl_components'),
  launchEditor: (editorId: string) => invoke<EditorLaunchOutcome>('launch_editor', { editorId }),
  launchApp: (req: LaunchRequest) => invoke<LaunchOutcome>('launch_app', { req }),
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
  providerConnectionTest: (id: string) => invoke<ApiTestReport>('provider_connection_test', { id }),

  feedSync: async (feedBaseUrl: string): Promise<FeedSyncResult> => {
    const result = await invoke<FeedSyncResult>('feed_sync', { feedBaseUrl });
    if (!result.ok || !result.catalog) throw new Error(result.detail || 'Incomplete content feed');
    // Shared strict schemas and executable-payload checks run before any data is used.
    assertNoExecutablePayload(JSON.stringify(result.catalog));
    const catalog = loadCatalog(result.catalog);
    const guides = validateRemoteGuides(result.guides, catalog);
    applyRemoteCatalog(catalog, guides);
    return { ...result, catalog };
  },
  appVersion: () => invoke<string>('app_version'),
};
