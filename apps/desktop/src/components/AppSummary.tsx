import { Network } from 'lucide-react';
import { preferredLaunchMode } from '@core';
import { useCatalog } from '@/lib/catalog';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSettings } from '@/app/settings';
import { useToolContext } from '@/app/tool-context';

export function AppSummary({ appId }: { appId: string }) {
  const { t } = useTranslation(['ux', 'proxy', 'connectionsUx']);
  const { settings } = useSettings();
  const ctx = useToolContext();
  const catalog = useCatalog();
  const config = ctx.proxyConfig;
  const selectedId = config?.perApp[appId];
  const inherits = !selectedId || selectedId === 'inherit';
  const effectiveId = inherits ? config?.globalProfileId : selectedId;
  const profile = effectiveId ? ctx.profiles.find(item => item.id === effectiveId) : undefined;
  const proxyState = !config
    ? 'unavailable'
    : effectiveId && !profile
      ? 'missing'
      : profile?.mode ?? 'direct';
  const effectiveProxy = proxyState === 'unavailable'
    ? t('connectionsUx:proxyReadFailed')
    : proxyState === 'missing'
      ? t('connectionsUx:proxyProfileUnavailable')
      : profile?.mode === 'http' || profile?.mode === 'socks5'
        ? profile.name
        : t(`proxy:mode.${proxyState}`);
  const state = ctx.states[appId];
  const rtl = state?.phase === 'running' ? state.rtl : preferredLaunchMode(settings.launchModeByApp[appId], catalog.apps.some(app => app.id === appId && app.capabilities.rtl === 'verified'), ctx.components.some(item => item.id === appId && item.available && item.configured)) === 'rtl';
  const apiConnection = settings.apiConnectionByApp[appId]
    ? ctx.connections?.find(item => item.id === settings.apiConnectionByApp[appId])
    : undefined;
  const apiConnectionInvalid = !!settings.apiConnectionByApp[appId] && ctx.connections && !apiConnection;
  const apiLabel = ctx.connections === null
    ? ctx.connectionsError ? t('connectionsUx:apiReferenceUnavailable') : t('ux:accountSummary.loading')
    : apiConnectionInvalid ? t('connectionsUx:apiReferenceUnavailable') : apiConnection?.name ?? t('ux:accountSummary.noApiReference');
  const detailsPath = appId === 'antigravity-ide' ? `/editor/${appId}` : `/app/${appId}?tab=connections`;

  return <div className="vh-app-summary-details">
    <Link className="vh-connection-summary" to={detailsPath}>
      <span className="vh-summary-line"><Network size={14} aria-hidden="true" /><span>{t('connectionsUx:nextLaunchProxy')}</span></span>
      <span className="vh-effective-proxy" data-testid={`proxy-summary-${appId}`} data-status={proxyState}>
        {proxyState === 'unavailable' || proxyState === 'missing' ? effectiveProxy : inherits ? t('connectionsUx:inheritEffective', { name: effectiveProxy }) : effectiveProxy}
      </span>
      <span className="vh-mode-chip">{rtl ? 'RTL' : t('ux:normal')}</span>
      <span className="vh-api-reference" data-testid={`api-reference-${appId}`} dir="auto"><span>{t('connectionsUx:apiReferenceShort')}</span>: {apiLabel}</span>
    </Link>
  </div>;
}
