import { preferredLaunchMode } from '@core';
import { useCatalog } from '@/lib/catalog';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSettings } from '@/app/settings';
import { useToolContext } from '@/app/tool-context';
import { ipc } from '@/services/ipc';

export function AppSummary({ appId }: { appId: string }) {
  const { t } = useTranslation(['ux', 'accounts']);
  const { settings } = useSettings();
  const ctx = useToolContext();
  const catalog = useCatalog();
  const [account, setAccount] = useState('');
  const [connectionName, setConnectionName] = useState('');
  useEffect(() => { let active = true; void ipc.providerConnections().then(items => { if (active) setConnectionName(items.find(item => item.id === settings.apiConnectionByApp[appId])?.name ?? ''); }).catch(() => { if (active) setConnectionName(''); }); return () => { active = false; }; }, [appId, settings.apiConnectionByApp[appId]]);
  const [quota, setQuota] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        let name = '', usage = '';
        if (appId === 'chatgpt') {
          const snapshot = await ipc.codexAccounts('list');
          const current = snapshot.accounts.find(item => item.id === snapshot.activeId);
          name = current?.name ?? '';
          usage = current?.windows.map(window => `${window.bucket}: ${window.remaining == null ? t('ux:quotaUnknown') : t('accounts:remaining', { percent: Math.round(window.remaining) })}`).join(' · ') ?? '';
        } else if (['qoder', 'zcode'].includes(appId)) {
          const snapshot = await ipc.appAccounts(appId, 'list');
          const current = snapshot.accounts.find(item => item.id === snapshot.activeId);
          name = current?.name ?? '';
          usage = current?.usage.map(item => `${item.label}: ${item.remaining == null ? t('ux:quotaUnknown') : item.unit === 'percent' ? t('accounts:remaining', { percent: Math.round(item.remaining) }) : `${item.remaining} ${item.unit}`}`).join(' · ') ?? '';
        }
        if (active) { setAccount(name); setQuota(usage); }
      } catch { if (active) { setAccount(''); setQuota(''); } }
    };
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [appId, t]);
  const config = ctx.proxyConfig;
  const profileId = config?.perApp[appId];
  const profile = ctx.profiles.find(item => item.id === (profileId && profileId !== 'inherit' ? profileId : config?.globalProfileId));
  const state = ctx.states[appId];
  const rtl = state?.phase === 'running' ? state.rtl : preferredLaunchMode(settings.launchModeByApp[appId], catalog.apps.some(app => app.id === appId && app.capabilities.rtl === 'verified'), ctx.components.some(item => item.id === appId && item.available)) === 'rtl';
  return <div className="space-y-1 text-xs text-muted">
    {['chatgpt', 'qoder', 'zcode'].includes(appId) && <Link className="block vh-link" to={`/app/${appId}?tab=accounts`}>{account || t('ux:accountUnknown')} · {quota || t('ux:quotaUnknown')}</Link>}
    <Link className="block vh-link" to={`/app/${appId}?tab=connections`}>{rtl ? t('ux:runRtl') : t('ux:normal')} · {profile?.name ?? t('proxy:inherit')}{connectionName ? ' · ' + connectionName : ''}</Link>
  </div>;
}
