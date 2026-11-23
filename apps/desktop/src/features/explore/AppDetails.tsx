import { AppPath } from '@/components/AppPath';
import { Tooltip } from '@/components/Tooltip';
import { ClaudePersianTerminal } from '@/components/ClaudePersianTerminal';
import { Projects } from '@/components/Projects';
import { AppSummary } from '@/components/AppSummary';
import { AppConnection } from '@/components/AppConnection';
import { LearningPage } from '@/features/learning/Learning';
import { AccountsPage } from '@/features/accounts/Accounts';
import { ClaudeAccountsPage } from '@/features/accounts/ClaudeAccounts';
import { OpaqueAccountsPage } from '@/features/accounts/OpaqueAccounts';
import { QuotaPanel } from '@/features/accounts/QuotaPanel';
import type { QuotaAppId } from '@/services/ipc';
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
import { Badge, Button, CopyButton, EmptyState, ErrorNotice, PageHeader, VerificationBadge, Tabs } from '@/components/ui';
import { ToolProxy } from '@/features/proxy/ToolProxy';
import { rtlAdapterConfigured, rtlAdapterSetupSupported } from '@core';

/// Apps that manage more than one account through VibeHub.
const ACCOUNT_APPS = ['chatgpt', 'claude-code', 'zcode', 'qoder'];
// Apps that publish a daily quota get their own quota tab; the Codex accounts
// tab stays about accounts only.
const QUOTA_APPS = ['qoder', 'minimax-code'];

/// ZCode and Qoder keep their session in an opaque blob, so they get the swap UI.
function isOpaqueAccountApp(id: string): id is 'zcode' | 'qoder' {
  return id === 'zcode' || id === 'qoder';
}

export function AppDetailsPage() {
  const { appId = '' } = useParams();
  const { t, i18n } = useTranslation(['ux', 'apps', 'common', 'connectionsUx', 'accounts']);
  const catalog = useCatalog();
  const [params, setParams] = useSearchParams();
  const ctx = useToolContext();
  const [error, setError] = useState<unknown>(null);
  const app = catalog.apps.find(a => a.id === appId);
  // Only the apps below expose the accounts tab; elsewhere the query would
  // silently select nothing, so drop it. Known tabs are left alone here.
  useEffect(() => {
    if (ACCOUNT_APPS.includes(appId)) return;
    if (params.get('tab') !== 'accounts') return;
    const next = new URLSearchParams(params);
    next.delete('tab');
    setParams(next, { replace: true });
  }, [appId, params, setParams]);
  if (!app) return <EmptyState title={t('ux:notFound')} action={<Link className="vh-link" to="/discover">{t('ux:backDiscover')}</Link>} />;
  const installed = ctx.apps.find(a => a.id === appId && a.installed);
  const tabs = [
    ...(installed ? [{ value: 'launch', label: t('ux:launchTab') }] : []),
    { value: 'connections', label: t('ux:connections') },
    { value: 'guide', label: t('ux:guideTab') },
    { value: 'about', label: t('ux:aboutTab') },
  ];
  if (ACCOUNT_APPS.includes(appId)) tabs.push({ value: 'accounts', label: t('ux:accountsTab') });
  if (QUOTA_APPS.includes(appId)) tabs.push({ value: 'quota', label: t('accounts:quota.title') });
  const selectedTab = tabs.find(tab => tab.value === params.get('tab'))?.value ?? (installed ? 'launch' : 'about');
  const lang = i18n.language.startsWith('fa') ? 'fa' : 'en';
  const ready = rtlAdapterConfigured(appId, ctx.components);
  const setupSupported = rtlAdapterSetupSupported(appId, ctx.components);
  const launchHelp = [
    t('ux:launchNote'),
    ready || setupSupported ? t(ready ? 'apps:rtlBundled' : 'ux:rtlMissing') : '',
    ready && app.capabilities.rtl === 'unknown' ? `RTL: ${t('common:unverified')}` : '',
  ].filter(Boolean).join('\n');
  const npmMethod = app.installMethods?.find(method => method.method === 'npm' && /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/.test(method.idOrUrl));
  const installCommand = npmMethod && `npm install -g ${appId === 'pi' ? '--ignore-scripts ' : ''}${npmMethod.idOrUrl}`;
  const installUrl = app.installMethods?.find(method => method.method === 'official-installer')?.idOrUrl
    ?? app.installMethods?.find(method => method.method === 'guide')?.idOrUrl
    ?? app.docsUrl ?? app.websiteUrl;
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
      <div><dt className="text-muted">{t('apps:capabilities.rtl')}</dt><dd><VerificationBadge status={app.capabilities.rtl} /></dd></div>
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
    <Link className="vh-link" to={installed || ctx.loading ? '/' : '/?view=available'}>{t('ux:backDiscover')}</Link>
    <div className="vh-details-heading">
      <AppLogo appId={appId} name={app.name} size={48} />
      <PageHeader title={app.name} titleAside={selectedTab === 'accounts' && appId === 'chatgpt' && <Tooltip text={t('accounts:initialRead')} />} actions={installed ? <>
        <LaunchControls compact id={appId} name={app.name} showRtlRepair />
        <Tooltip text={launchHelp} />
      </> : <Button variant="primary" onClick={() => void source(installUrl)}><ExternalLink size={16} aria-hidden="true" />{t(npmMethod || app.kind === 'cli_agent' ? 'install:manualGuide' : 'apps:officialDownload')}</Button>} />
    </div>
    {error != null && <ErrorNotice error={error} />}
    {ctx.errors.length > 0 && <ErrorNotice error={ctx.errors.join('\n')} onRetry={() => void ctx.refresh()} />}
    <div id="app-status" className="vh-card flex flex-wrap items-center gap-x-4 gap-y-2 py-2 text-sm">
      <Badge tone={installed ? 'success' : 'muted'}>{ctx.loading ? t('ux:checking') : t(installed ? 'ux:installed' : 'ux:notInstalled')}</Badge>
      {installed?.version && <bdi className="text-muted">{installed.version}</bdi>}
      {installed && <AppSummary key={appId} appId={appId} />}
      <Button size="sm" variant="ghost" className="ms-auto" loading={ctx.loading} onClick={() => void ctx.refresh()} aria-label={t('apps:refreshInstalled')} title={t('apps:refreshInstalled')}><RefreshCw size={16} aria-hidden="true" /></Button>
    </div>
    {!installed && !ctx.loading && <div className="space-y-2">
      {installCommand && <section className="vh-card flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-bold">{t('ux:install')}</h2>
        <code dir="ltr" className="break-all">{installCommand}</code>
        <CopyButton text={installCommand} label={t('common:copy')} />
      </section>}
      <AppPath key={appId + '-quick-path'} appId={appId} />
    </div>}
    <Tabs panelId="app-panel" label={app.name} value={selectedTab} onChange={value => setParams({ tab: value })} items={tabs} />
    <div id="app-panel" role="tabpanel" aria-labelledby={'app-panel-tab-' + selectedTab}>
      <section hidden={selectedTab !== 'launch'} className="space-y-4">
        <Projects key={appId} appId={appId} />
        {appId === 'claude-code' && installed && <ClaudePersianTerminal />}
      </section>
      <section hidden={selectedTab !== 'connections'} className="vh-card">
        <div className="space-y-6">
          <section>
            <div className="mb-2 flex items-center gap-1">
              <h2 className="text-sm font-bold">{t('connectionsUx:nextLaunchProxy')}</h2>
              <Tooltip text={t('connectionsUx:toolProxyIntro')} />
            </div>
            <ToolProxy appId={appId} />
          </section>
          <AppConnection key={appId} appId={appId} />
          {appId === 'claude-desktop' && <Link className="vh-link" to="?tab=guide"><BookOpen size={16} aria-hidden="true" />{t('apps:claudeDesktopApiGuide')}</Link>}
          <Disclosure title={t('ux:compatible')}><h2 className="text-sm font-bold">{t('ux:modelSetup')}</h2><p className="text-sm text-muted">{t('ux:modelManual')}</p>
            <h3 className="text-sm font-bold">{t('ux:compatible')}</h3>
            {compatible.length ? compatible.map(provider => <div key={provider.id} className="flex flex-wrap items-center justify-between gap-3 text-sm"><Link className="vh-link" to={'/connections/api?provider=' + provider.id}>{provider.name}</Link><VerificationBadge status={provider.supportedApps[appId] ?? 'unknown'} /></div>) : <p className="text-sm text-muted">{t('ux:noCompatibility')}</p>}
          </Disclosure>
        </div>
      </section>
        {selectedTab === 'guide' && <LearningPage embeddedArticleId={appId} />}
      <section hidden={selectedTab !== 'about'} className="vh-card space-y-4">
        {access}
        {installed && <AppPath key={appId + '-about-path'} appId={appId} />}
      </section>
      {selectedTab === 'accounts' && (appId === 'claude-code'
        ? <ClaudeAccountsPage />
        : isOpaqueAccountApp(appId)
          ? <OpaqueAccountsPage appId={appId} appName={app.name} />
          : <AccountsPage embedded />)}
      {selectedTab === 'quota' && <QuotaPanel apps={[appId as QuotaAppId]} />}
    </div>

  </div>;
}
