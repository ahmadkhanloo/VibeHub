import { Plug } from 'lucide-react';
import { preferredLaunchMode, rtlAdapterConfigured } from '@core';
import { useCatalog } from '@/lib/catalog';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSettings } from '@/app/settings';
import { useToolContext } from '@/app/tool-context';

/**
 * The tile's single metadata strip: proxy target, launch mode and API
 * reference. Each segment shows a short value — the full sentence the app used
 * to print lives in the title and in screen-reader text, so nothing truncates.
 */
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
  const proxied = profile?.mode === 'http' || profile?.mode === 'socks5';
  const effectiveProxy = proxyState === 'unavailable'
    ? t('connectionsUx:proxyReadFailed')
    : proxyState === 'missing'
      ? t('connectionsUx:proxyProfileUnavailable')
      : proxied
        ? profile.name
        : t(`proxy:mode.${proxyState}`);
  const proxyLabel = proxyState === 'unavailable' || proxyState === 'missing'
    ? effectiveProxy
    : inherits
      ? t('connectionsUx:inheritEffective', { name: effectiveProxy })
      : effectiveProxy;
  // The strip shows a dot plus one short word; the sentence above stays in the
  // title and the screen-reader text, so nothing is lost to the shortening.
  const proxyTone = proxyState === 'unavailable' || proxyState === 'missing'
    ? 'is-warning'
    : proxied ? 'is-primary' : proxyState === 'system' ? '' : 'is-ok';
  const proxyShort = proxyState === 'unavailable'
    ? t('connectionsUx:proxyReadFailedShort')
    : proxyState === 'missing'
      ? t('connectionsUx:proxyProfileUnavailableShort')
      : inherits
        ? proxied ? t('connectionsUx:inheritShort') : t(`proxy:mode.${proxyState}`)
        : proxied ? profile.name : t(`proxy:mode.${proxyState}`);
  const state = ctx.states[appId];
  const adapterReady = rtlAdapterConfigured(appId, ctx.components);
  const rtl = state?.phase === 'running' ? state.rtl : adapterReady && preferredLaunchMode(settings.launchModeByApp[appId], catalog.apps.some(app => app.id === appId && app.capabilities.rtl === 'verified'), adapterReady) === 'rtl';
  const apiConnection = settings.apiConnectionByApp[appId]
    ? ctx.connections?.find(item => item.id === settings.apiConnectionByApp[appId])
    : undefined;
  const apiConnectionInvalid = !!settings.apiConnectionByApp[appId] && ctx.connections && !apiConnection;
  const apiLabel = ctx.connections === null
    ? ctx.connectionsError ? t('connectionsUx:apiReferenceUnavailable') : t('ux:accountSummary.loading')
    : apiConnectionInvalid ? t('connectionsUx:apiReferenceUnavailable') : apiConnection?.name ?? t('ux:accountSummary.noApiReference');
  const modeLabel = rtl ? 'RTL' : t('ux:modeNormalShort');
  const detailsPath = `/app/${appId}?tab=connections`;
  // "No API reference" is the default, so printing it on every tile only adds noise and
  // pushes the strip onto a second line. It stays in the accessibility tree either way.
  const apiNotable = !!apiConnection || apiConnectionInvalid || !!ctx.connectionsError;

  return <Link className="vh-app-meta" to={detailsPath}>
    <span className="vh-meta-item" title={proxyLabel} data-status={proxyState} data-testid={`proxy-summary-${appId}`}>
      <i className={'vh-meta-dot ' + proxyTone} aria-hidden="true" />
      <span className="sr-only">{t('connectionsUx:nextLaunchProxy')}: </span>
      <bdi className="vh-meta-value">{proxyShort}</bdi>
    </span>
    <span className="vh-meta-item" title={modeLabel}>
      <i className={'vh-meta-dot' + (rtl ? ' is-primary' : '')} aria-hidden="true" />
      <span className="vh-meta-value" data-mode={rtl ? 'rtl' : 'normal'}>{modeLabel}</span>
    </span>
    {apiNotable
      ? <span className="vh-meta-item" title={apiLabel} data-testid={`api-reference-${appId}`}>
          <Plug size={13} aria-hidden="true" />
          <span className="sr-only">{t('connectionsUx:apiReferenceShort')}: </span>
          <bdi className="vh-meta-value">{apiLabel}</bdi>
        </span>
      : <span className="sr-only" data-testid={`api-reference-${appId}`}>{t('connectionsUx:apiReferenceShort')}: {apiLabel}</span>}
  </Link>;
}
