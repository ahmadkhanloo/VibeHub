import { useState } from 'react';
import { Projects } from '@/components/Projects';
import { AppSummary } from '@/components/AppSummary';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw } from 'lucide-react';
import { useToolContext } from '@/app/tool-context';
import { useCatalog } from '@/lib/catalog';
import { AppLogo } from '@/components/AppLogo';
import { LaunchControls } from '@/components/LaunchControls';
import { Tooltip } from '@/components/Tooltip';
import { Disclosure } from '@/components/Disclosure';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ipc } from '@/services/ipc';
import { Button, EmptyState, ErrorNotice, PageHeader, Spinner } from '@/components/ui';
import { useSettings } from '@/app/settings';

export function HomePage() {
  const { t, i18n } = useTranslation(['ux', 'workbench']);
  const { settings } = useSettings();
  const ctx = useToolContext();
  const [openError, setOpenError] = useState<unknown>(null);
  const [versions, setVersions] = useState<Record<string, { version?: string; source?: string; comparison?: 'newer' | 'current' | 'ahead' | null; checkedAt?: string; error?: boolean; loading?: boolean }>>({});
  const checkVersion = async (id: string, installedVersion?: string) => {
    setVersions(old => ({ ...old, [id]: { loading: true } }));
    try { const result = await ipc.latestToolVersion(id, installedVersion); setVersions(old => ({ ...old, [id]: result })); }
    catch { setVersions(old => ({ ...old, [id]: { error: true, checkedAt: new Date().toISOString() } })); }
  };
  const catalog = useCatalog();
  const tools = ctx.apps.filter(app => app.installed).map(tool => ({
    ...tool, app: catalog.apps.find(app => app.id === tool.id),
  }));
  const running = tools.filter(tool => ctx.states[tool.id]?.phase === 'running').length;
  return <div className={`vh-workspace ${settings.density === 'compact' ? 'space-y-1' : 'space-y-6'}`}>
    <PageHeader title={t('ux:workspace')} description={t('workbench:workspaceIntro')} actions={<>
      <Button variant="ghost" loading={ctx.loading} onClick={() => void ctx.refresh()} aria-label={t('refresh')} title={t('refresh')}><RefreshCw size={18} aria-hidden="true" /></Button>
      <Link to="/discover" className="vh-button vh-button-primary"><Plus size={16} aria-hidden="true" />{t('addApp')}</Link>
    </>} />
    <div className="vh-workspace-meta"><span><i className="vh-count-dot" aria-hidden="true" />{t('workbench:installedCount', {count:tools.length})}</span>{running > 0 && <span><i className="vh-count-dot is-running" aria-hidden="true" />{t('workbench:runningCount', {count:running})}</span>}</div>
    <div className="vh-project-dock"><Projects /></div>
    {ctx.errors.length > 0 && <ErrorNotice error={ctx.errors.join('\n')} message={ctx.detectionFailed ? undefined : t('partial')} onRetry={() => void ctx.refresh()} />}
    {ctx.loading && !tools.length ? <Spinner /> : !tools.length && !ctx.detectionFailed ? <EmptyState title={t('noInstalled')} sub={t('noInstalledSub')} action={<Link to="/discover" className="vh-button vh-button-primary">{t('discover')}</Link>} /> : !!tools.length && <>
      <div className="vh-app-grid" aria-label={t('workspace')}>
        {tools.map(tool => {
          const name = tool.app?.name ?? tool.id;
          const phase = ctx.busy['app:' + tool.id] ? 'starting' : ctx.states[tool.id]?.phase ?? 'unknown';
          const status = ({running:'running', starting:'checking', failed:'launchError', idle:'installed', unknown:'stateUnknown'} as const)[phase];
          return <article key={tool.id} className="vh-app-tile" data-phase={phase} data-testid={`app-tile-${tool.id}`}>
            <div className="vh-app-tile-heading"><Link className="vh-app-identity" to={`/app/${tool.id}`} aria-label={t('prepare') + ' ' + name}>
              <AppLogo appId={tool.id} name={name} size={40} />
              <h2><bdi>{name}</bdi></h2>
            </Link>
            <span className="vh-app-status"><i aria-hidden="true" />{t('ux:' + status)}</span></div>
            {tool.app && <p className="vh-app-description">{tool.app.summary[i18n.language.startsWith('fa') ? 'fa' : 'en']}</p>}
            <AppSummary appId={tool.id} />
            <LaunchControls id={tool.id} name={name} compact supportsRtl={tool.id === 'antigravity' || tool.app?.capabilities.rtl === 'verified'} />
          </article>;
        })}
      </div>
      <Tooltip text={t('launchNote')} />
    </>}
    <Disclosure title={t('ux:versions.title')}>
      <p className="text-sm text-muted">{t('ux:versions.note')}</p>
      {openError != null && <ErrorNotice error={openError} />}
      <ul className="divide-y divide-border">{tools.map(tool => <li key={tool.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <Link className="vh-link" to={`/app/${tool.id}`}><bdi>{tool.app?.name ?? tool.id}</bdi></Link>
        <span>{t('ux:versions.installed')}: <bdi>{tool.version || t('ux:versions.unknown')}</bdi></span>
        {['opencode', 'freebuff'].includes(tool.id) ? <><Button size="sm" variant="ghost" loading={versions[tool.id]?.loading} onClick={() => void checkVersion(tool.id, tool.version)}>{t('ux:versions.check')}</Button><span>{versions[tool.id]?.error ? t('ux:versions.failed') : versions[tool.id]?.version ? `${t('ux:versions.latest')}: ${versions[tool.id]?.version} (${versions[tool.id]?.source})` : t('ux:versions.notChecked')}{versions[tool.id]?.version && ` · ${t('ux:versions.' + (versions[tool.id]?.comparison ?? 'incomparable'))}`}{versions[tool.id]?.checkedAt && ` · ${new Date(versions[tool.id]!.checkedAt!).toLocaleString(i18n.language)}`}</span></> : <span>{t('ux:versions.unsupported')}</span>}
        {tool.app && <Button size="sm" variant="ghost" onClick={() => void openUrl(tool.app!.websiteUrl).then(() => setOpenError(null)).catch(setOpenError)}>{t('ux:versions.official')}</Button>}
      </li>)}</ul>
    </Disclosure>
  </div>;
}
