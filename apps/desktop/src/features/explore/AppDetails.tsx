import { AppPath } from '@/components/AppPath';
import { ClaudePersianTerminal } from '@/components/ClaudePersianTerminal';
import { Projects } from '@/components/Projects';
import { AppSummary } from '@/components/AppSummary';
import { AppConnection } from '@/components/AppConnection';
import { LearningPage } from '@/features/learning/Learning';
import { AccountsPage } from '@/features/accounts/Accounts';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, RefreshCw, BookOpen } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useCatalog } from '@/lib/catalog';
import { useToolContext } from '@/app/tool-context';
import { AppLogo } from '@/components/AppLogo';
import { LaunchControls } from '@/components/LaunchControls';
import { Disclosure } from '@/components/Disclosure';
import { Badge, Button, EmptyState, ErrorNotice, PageHeader, VerificationBadge, Tabs } from '@/components/ui';
import { ToolProxy } from '@/features/proxy/ToolProxy';
import { rtlAdapterConfigured, rtlAdapterSetupSupported } from '@core';

export function AppDetailsPage() {
  const { appId = '' } = useParams();
  const { t, i18n } = useTranslation(['ux', 'apps', 'common', 'connectionsUx']);
  const catalog = useCatalog();
  const [params, setParams] = useSearchParams();
  const ctx = useToolContext();
  const [error, setError] = useState<unknown>(null);
  const app = catalog.apps.find(a => a.id === appId);
  useEffect(() => {
    if (appId === 'chatgpt' || params.get('tab') !== 'accounts') return;
    const next = new URLSearchParams(params);
    next.delete('tab');
    setParams(next, { replace: true });
  }, [appId, params, setParams]);
  if (!app) return <EmptyState title={t('ux:notFound')} action={<Link className="vh-link" to="/discover">{t('ux:backDiscover')}</Link>} />;
  const installed = ctx.apps.find(a => a.id === appId && a.installed);
  const tabs = [{ value: 'launch', label: t('ux:launchTab') }, { value: 'connections', label: t('ux:connections') }, { value: 'guide', label: t('ux:guideTab') }, { value: 'about', label: t('ux:aboutTab') }];
  if (appId === 'chatgpt') tabs.push({ value: 'accounts', label: t('ux:accountsTab') });
  const selectedTab = tabs.find(tab => tab.value === params.get('tab'))?.value ?? (installed ? 'launch' : 'about');
  const lang = i18n.language.startsWith('fa') ? 'fa' : 'en';
  const ready = rtlAdapterConfigured(appId, ctx.components);
  const setupSupported = rtlAdapterSetupSupported(appId, ctx.components);
  const rtlStatus = ctx.components.find(component => component.id === appId);
  const source = async (url: string) => { try { await openUrl(url); setError(null); } catch (cause) { setError(cause); } };
  const compatible = catalog.providers.filter(p => p.supportedApps[appId] && !['unknown', 'unsupported'].includes(p.supportedApps[appId]!));
  const truth = (value: boolean | null) => t(value === true ? 'ux:yes' : value === false ? 'ux:no' : 'ux:unknown');
  const access = <div className="space-y-4">
    <p className="text-sm leading-7">{app.summary[lang]}</p>
    <dl className="grid gap-4 sm:grid-cols-2 text-sm">
      <div><dt className="text-muted">{t('ux:freeAccess')}</dt><dd>{t('ux:' + (app.freeAccess === 'unknown' ? 'unknownAccess' : app.freeAccess))}</dd></div>
      <div><dt className="text-muted">{t('ux:type')}</dt><dd>{t('ux:' + app.kind)}</dd></div>
      <div><dt className="text-muted">{t('ux:signup')}</dt><dd>{truth(app.requiresSignup)}</dd></div>
      <div><dt className="text-muted">{t('ux:card')}</dt><dd>{truth(app.requiresPaymentCard)}</dd></div>
    </dl>
    <p className="text-sm leading-7 text-muted">{app.freeAccessDetails[lang]}</p>
    {app.eligibility?.map((entry, index) => <div key={index} className="space-y-2 border-t border-border pt-4 text-sm">
      <h3 className="font-bold">{t('ux:eligibility')} <bdi>{entry.countryCode}</bdi></h3>
      <dl className="space-y-2"><div><dt className="text-muted">{t('ux:network')}</dt><dd>{t('apps:networkAccess.' + entry.networkAccess)}</dd></div><div><dt className="text-muted">{t('ux:account')}</dt><dd>{t('apps:accountPolicy.' + entry.accountPolicy)}</dd></div></dl>
      {entry.regionNotes && <p className="text-muted">{entry.regionNotes[lang]}</p>}
      {entry.testedAt && <bdi>{entry.testedAt}</bdi>}
      {entry.sourceUrl && <Button size="sm" variant="ghost" onClick={() => void source(entry.sourceUrl!)}>{t('ux:source')}</Button>}
    </div>)}
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted"><span>{t('ux:verifiedOn')}: <bdi>{app.lastVerified}</bdi></span><Button size="sm" variant="ghost" onClick={() => void source(app.sourceOfFreeAccess)}>{t('ux:source')}<ExternalLink size={14} aria-hidden="true" /></Button></div>
  </div>;
  return <div className="space-y-6">
    <Link className="vh-link" to="/discover">{t('ux:backDiscover')}</Link>
    <div className="vh-details-heading">
      <AppLogo appId={appId} name={app.name} size={48} />
      <PageHeader title={app.name} actions={installed ? <LaunchControls compact id={appId} name={app.name} showRtlRepair /> : <Button variant="primary" onClick={() => void source(app.installMethods?.find(method => method.method === 'official-installer')?.idOrUrl ?? app.websiteUrl)}><ExternalLink size={16} aria-hidden="true" />{t('apps:officialDownload')}</Button>} />
    </div>
    <AppSummary key={appId} appId={appId} />
    {error != null && <ErrorNotice error={error} />}
    {ctx.errors.length > 0 && <ErrorNotice error={ctx.errors.join('\n')} onRetry={() => void ctx.refresh()} />}
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Badge tone={installed ? 'success' : 'muted'}>{ctx.loading ? t('ux:checking') : t(installed ? 'ux:installed' : 'ux:notInstalled')}</Badge>
      {installed?.version && <bdi className="text-muted">{installed.version}</bdi>}
      <Button variant="ghost" loading={ctx.loading} onClick={() => void ctx.refresh()} aria-label={t('apps:refreshInstalled')} title={t('apps:refreshInstalled')}><RefreshCw size={16} aria-hidden="true" /></Button>
      <AppPath key={appId + '-quick-path'} appId={appId} />
      <Button variant="ghost" onClick={() => void source(app.websiteUrl)}>{t('ux:external')}</Button>
    </div>
    <Tabs panelId="app-panel" label={app.name} value={selectedTab} onChange={value => setParams({ tab: value })} items={tabs} />
    <div id="app-panel" role="tabpanel" aria-labelledby={'app-panel-tab-' + selectedTab}>
      <section hidden={selectedTab !== 'launch'} className="space-y-4">
        <Projects key={appId} appId={appId} />
        {appId === 'claude-code' && installed && <ClaudePersianTerminal />}
        <div className="space-y-3 text-sm">
          {appId === 'claude-code' ? <Badge tone="warning">{t('ux:claudePersian.experimental')}</Badge> : <VerificationBadge status={app.capabilities.rtl} />}
          {appId === 'antigravity' && <Badge tone="warning">{t('ux:rtlExperimental')}</Badge>}
          {appId !== 'claude-code' && <p className="text-muted">{t(setupSupported ? ready ? 'apps:rtlBundled' : 'ux:rtlMissing' : 'apps:rtlUnavailable')}</p>}
          {!setupSupported && rtlStatus?.reason && <p className="text-warning" role="status">{rtlStatus.reason}</p>}
          <p className="text-muted">{t('ux:launchNote')}</p>
          {!installed && <p className="text-muted">{t('ux:installNote')}</p>}
        </div>
      </section>
      <section hidden={selectedTab !== 'connections'} className="vh-card">
        <div className="space-y-6">
          <section><h2 className="mb-3 text-sm font-bold">{t('connectionsUx:nextLaunchProxy')}</h2><ToolProxy appId={appId} /></section>
          <AppConnection key={appId} appId={appId} />
          {appId === 'claude-desktop' && <Link className="vh-link" to="?tab=guide"><BookOpen size={16} aria-hidden="true" />{t('apps:claudeDesktopApiGuide')}</Link>}
          <Disclosure title={t('ux:compatible')}><h2 className="text-sm font-bold">{t('ux:modelSetup')}</h2><p className="text-sm text-muted">{t('ux:modelManual')}</p>
            <h3 className="text-sm font-bold">{t('ux:compatible')}</h3>
            {compatible.length ? compatible.map(provider => <div key={provider.id} className="flex flex-wrap items-center justify-between gap-3 text-sm"><Link className="vh-link" to={'/connections/api?provider=' + provider.id}>{provider.name}</Link><VerificationBadge status={provider.supportedApps[appId] ?? 'unknown'} /></div>) : <p className="text-sm text-muted">{t('ux:noCompatibility')}</p>}
          </Disclosure>
        </div>
      </section>
        {selectedTab === 'guide' && <LearningPage embeddedArticleId={appId} />}
      <section hidden={selectedTab !== 'about'} className="vh-card">{access}</section>
      {selectedTab === 'accounts' && <AccountsPage embedded />}
    </div>
    <Link className="vh-button vh-button-ghost" to={'/doctor?tool=' + encodeURIComponent(appId) + '&kind=app'}>{t('ux:doctor')}</Link>

  </div>;
}
