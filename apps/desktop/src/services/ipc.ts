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
