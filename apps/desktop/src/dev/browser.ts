import { installMockNative } from './mock-native';
import { apps } from '@/lib/catalog';

export function installBrowserPreview() {
  // Browser preview never forwards commands to Windows or a credential store.
  installMockNative({ scenario: 'ready', language: 'fa', onboardingDone: true });
  const host = window as unknown as {
    __TAURI_INTERNALS__: { invoke: (cmd: string, args?: any) => Promise<any> };
    __mock: any;
  };
  const invoke = host.__TAURI_INTERNALS__.invoke;
  const accounts: any = { accounts: [], activeId: null, pendingId: null, notice: null,
    settings: { enabled: false, threshold: 1 }, lastSwitch: 0, cliReady: false, nativePreview: true,
    supportedVersion: '0.148.0', desktopRunning: false, desktopVerified: false, loginPending: false };
  host.__TAURI_INTERNALS__.invoke = async (cmd, args = {}) => {
    if (cmd === 'detect_apps') return apps.map(app => ({ id: app.id, installed: true, via: 'browser-preview' }));
    if (cmd === 'rtl_components') return ['qoder','zcode','deepseek-harness','antigravity'].map(id => ({id,available:true}));
    if (cmd === 'app_accounts') return { appId: args.appId, accounts: [], activeId: null, notice: 'accounts:browserPreview', nativePreview: true, version: '', supportedVersion: args.appId === 'qoder' ? '0.4.2' : '3.16.3', desktopRunning: false, liveSwitchVerified: false, capabilities: { canImport: false, canLogin: false, canRefresh: false, canSwitch: false } };
    if (cmd === 'codex_accounts') {
      if (args.action === 'settings') accounts.settings = { enabled: args.payload.enabled, threshold: args.payload.threshold };
      else if (!['list','dismiss'].includes(args.action)) throw Error('Browser preview has no access to real accounts.');
      return structuredClone(accounts);
    }
    if (cmd === 'plugin:opener|open_url') {
      const url = new URL(args.url);
      if (url.protocol !== 'https:') throw Error('Only HTTPS links are supported in preview.');
      window.open(url.href, '_blank', 'noopener,noreferrer'); return;
    }
    if (cmd === 'plugin:notification|request_permission') return 'denied';
    if (cmd === 'plugin:updater|check') return null;
    return invoke(cmd,args);
  };
  const banner = document.createElement('div');
  banner.id = 'browser-preview-banner'; banner.setAttribute('role','status');
  banner.style.cssText = 'padding:8px 16px;background:#fff3cd;color:#332701;text-align:center;font:14px sans-serif;direction:rtl;';
  banner.textContent = 'پیش‌نمایش توسعه در مرورگر — اجرای اپ‌ها و RTL شبیه‌سازی است؛ برای تست واقعی از pnpm dev:desktop استفاده کنید. / Browser preview · simulated native actions';
  document.body.prepend(banner);
  document.body.style.display = 'flex'; document.body.style.flexDirection = 'column';
  banner.style.flexShrink = '0';
  const root = document.getElementById('root')!;
  root.style.flex = '1'; root.style.minHeight = '0'; root.style.height = 'auto';
}
