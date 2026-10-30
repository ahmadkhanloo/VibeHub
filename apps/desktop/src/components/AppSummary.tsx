import { UserRound, Network, RotateCw } from 'lucide-react';
import { preferredLaunchMode } from '@core';
import { useCatalog } from '@/lib/catalog';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSettings } from '@/app/settings';
import { useToolContext } from '@/app/tool-context';
import type { AccountSummaryStatus } from '@/features/accounts/account-summary';
import { Button } from './ui';

const accountStatusKey: Record<AccountSummaryStatus, string> = {
  loading: 'accountSummary.loading',
  ready: 'accountSummary.ready',
  empty: 'accountSummary.empty',
  unsupported: 'accountSummary.unsupported',
  reauthRequired: 'accountSummary.reauthRequired',
  error: 'accountSummary.error',
};

export function AppSummary({ appId }: { appId: string }) {
  const { t, i18n } = useTranslation(['ux', 'accounts', 'proxy', 'connectionsUx']);
  const { settings } = useSettings();
  const ctx = useToolContext();
  const catalog = useCatalog();
  const summary = ctx.accountSummaries[appId];
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
  const rtl = state?.phase === 'running' ? state.rtl : preferredLaunchMode(settings.launchModeByApp[appId], catalog.apps.some(app => app.id === appId && app.capabilities.rtl === 'verified'), ctx.components.some(item => item.id === appId && item.available)) === 'rtl';
  const quotaText = summary?.quotaItems.map(item => {
    const value = item.remaining == null
      ? item.granted != null
        ? t('accounts:grantedQuota', { amount: Number(item.granted).toLocaleString(i18n.language), unit: t(`accounts:units.${item.unit}`, { defaultValue: item.unit }) })
        : t('ux:quotaUnknown')
      : item.unit === 'percent'
        ? t('accounts:remaining', { percent: Math.round(item.remaining) })
        : t('accounts:remainingAmount', { amount: Number(item.remaining).toLocaleString(i18n.language), unit: t(`accounts:units.${item.unit}`, { defaultValue: item.unit }) });
    return `${item.label}: ${value}`;
  }).join(' · ');
  const accountAction = summary?.status === 'reauthRequired'
    ? t(summary.canAdd ? 'ux:accountSummary.reauthAction' : 'ux:accountSummary.detailsAction')
    : summary?.status === 'empty' && summary.canAdd
      ? t('ux:accountSummary.addAction')
      : summary?.status === 'error' && !summary.canRefresh
        ? t('ux:accountSummary.detailsAction')
        : null;
  const shouldRetry = !!summary && summary.canRefresh && (summary.status === 'error' || summary.quotaStatus === 'error' || summary.status === 'empty');
  const checkedAt = summary?.checkedAt == null ? null : new Date(summary.checkedAt * 1000);
  const apiConnection = settings.apiConnectionByApp[appId]
    ? ctx.connections?.find(item => item.id === settings.apiConnectionByApp[appId])
    : undefined;
  const apiConnectionInvalid = !!settings.apiConnectionByApp[appId] && ctx.connections && !apiConnection;
  const apiLabel = ctx.connections === null
    ? ctx.connectionsError ? t('connectionsUx:apiReferenceUnavailable') : t('ux:accountSummary.loading')
    : apiConnectionInvalid ? t('connectionsUx:apiReferenceUnavailable') : apiConnection?.name ?? t('ux:accountSummary.noApiReference');

  return <div className="vh-app-summary-details">
    {['chatgpt', 'qoder', 'zcode'].includes(appId) && <section className="vh-account-summary" aria-label={t('ux:accountSummary.label', { app: appId })} data-testid={`account-summary-${appId}`}>
      <Link className="vh-account-summary-content" to={`/app/${appId}?tab=accounts`}>
        <span className="vh-summary-line"><UserRound size={14} aria-hidden="true" /><span data-testid={`account-summary-status-${appId}`} data-status={summary?.status ?? 'loading'}>{t(`ux:${accountStatusKey[summary?.status ?? 'loading']}`)}</span></span>
        {summary?.accountName && <bdi className="vh-account-name" data-testid={`account-summary-name-${appId}`}>{summary.accountName}</bdi>}
        <span className="vh-quota-summary" data-testid={`account-summary-quota-${appId}`} data-status={summary?.quotaStatus ?? 'loading'} dir="auto">
          {summary?.quotaStatus === 'error' ? t('ux:accountSummary.quotaError') : quotaText || t('ux:quotaUnknown')}
        </span>
        {summary?.quotaItems.length ? <span className="vh-summary-checked">{t(`ux:accountSummary.source.${appId}`)}</span> : null}
        {(summary?.showingPrevious || summary?.stale) && <span className="vh-summary-previous" data-testid={`account-summary-stale-${appId}`}>
          {t(summary.stale ? 'ux:accountSummary.stale' : 'ux:accountSummary.previous')}
        </span>}
        {checkedAt && <time className="vh-summary-checked" dateTime={checkedAt.toISOString()}>{t('ux:accountSummary.checkedAt', { date: checkedAt.toLocaleString(i18n.language) })}</time>}
      </Link>
      <div className="vh-summary-actions">
        {accountAction && <Link className="vh-link" to={`/app/${appId}?tab=accounts`}>{accountAction}</Link>}
        {shouldRetry && <Button size="sm" variant="ghost" aria-label={t('ux:accountSummary.retry')} onClick={() => void ctx.retryAccountSummary(appId)}><RotateCw size={14} aria-hidden="true" />{t('ux:accountSummary.retry')}</Button>}
      </div>
    </section>}
    <Link className="vh-connection-summary" to={`/app/${appId}?tab=connections`}>
      <span className="vh-summary-line"><Network size={14} aria-hidden="true" /><span>{t('connectionsUx:nextLaunchProxy')}</span></span>
      <span className="vh-effective-proxy" data-testid={`proxy-summary-${appId}`} data-status={proxyState}>
        {proxyState === 'unavailable' || proxyState === 'missing' ? effectiveProxy : inherits ? t('connectionsUx:inheritEffective', { name: effectiveProxy }) : effectiveProxy}
      </span>
      <span className="vh-mode-chip">{rtl ? 'RTL' : t('ux:normal')}</span>
      <span className="vh-api-reference" data-testid={`api-reference-${appId}`} dir="auto"><span>{t('connectionsUx:apiReferenceShort')}</span>: {apiLabel}</span>
    </Link>
  </div>;
}
