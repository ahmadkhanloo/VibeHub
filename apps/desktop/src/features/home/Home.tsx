import { useState } from 'react';
import { AppSummary } from '@/components/AppSummary';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw } from 'lucide-react';
import { useToolContext } from '@/app/tool-context';
import { useCatalog } from '@/lib/catalog';
import { AppLogo } from '@/components/AppLogo';
import { LaunchControls } from '@/components/LaunchControls';
import { Tooltip } from '@/components/Tooltip';
import { ipc } from '@/services/ipc';
import { Button, EmptyState, ErrorNotice, PageHeader, Spinner } from '@/components/ui';
import { useSettings } from '@/app/settings';

export function HomePage() {
  const { t } = useTranslation(['ux', 'workbench']);
  const { settings } = useSettings();
  const ctx = useToolContext();
  const [versions, setVersions] = useState<Record<string, { version?: string; source?: string; comparison?: 'newer' | 'current' | 'ahead' | null; checkedAt?: string; error?: boolean; loading?: boolean }>>({});
  const checkVersion = async (id: string, installedVersion?: string) => {
    setVersions(old => ({ ...old, [id]: { loading: true } }));
    try { const result = await ipc.latestToolVersion(id, installedVersion); setVersions(old => ({ ...old, [id]: result })); }
    catch { setVersions(old => ({ ...old, [id]: { error: true, checkedAt: new Date().toISOString() } })); }
  };
  const catalog = useCatalog();
  const appTools = ctx.apps.filter(app => app.installed).map(tool => ({
      ...tool, name: catalog.apps.find(app => app.id === tool.id)?.name ?? tool.id,
      app: catalog.apps.find(app => app.id === tool.id), kind: 'app' as const,
    }));
  const tools = [
    ...appTools,
    ...ctx.editors.filter(editor => editor.installed).map(editor => ({
      ...editor, name: editor.name, app: undefined, kind: 'editor' as const,
    })),
  ];
  const running = tools.filter(tool => ctx.states[tool.id]?.phase === 'running').length;
  return <div className={`vh-workspace ${settings.density === 'compact' ? 'space-y-1' : 'space-y-6'}`}>
    <PageHeader title={t('ux:workspace')} actions={<>
      <Button variant="ghost" loading={ctx.loading} onClick={() => void ctx.refresh()} aria-label={t('refresh')} title={t('refresh')}><RefreshCw size={18} aria-hidden="true" /></Button>
      <Link to="/discover" className="vh-button vh-button-primary"><Plus size={16} aria-hidden="true" />{t('addApp')}</Link>
    </>} />
    <div className="vh-workspace-meta"><span><i className="vh-count-dot" aria-hidden="true" />{t('workbench:installedCount', {count:tools.length})}</span>{running > 0 && <span><i className="vh-count-dot is-running" aria-hidden="true" />{t('workbench:runningCount', {count:running})}</span>}</div>
    {ctx.errors.length > 0 && <ErrorNotice error={ctx.errors.join('\n')} message={ctx.detectionFailed ? undefined : t('partial')} onRetry={() => void ctx.refresh()} />}
    {ctx.loading && !tools.length ? <Spinner /> : !tools.length && !ctx.detectionFailed ? <EmptyState title={t('noInstalled')} sub={t('noInstalledSub')} action={<Link to="/discover" className="vh-button vh-button-primary">{t('discover')}</Link>} /> : !!tools.length && <>
      <div className="vh-app-grid" aria-label={t('workspace')}>
        {tools.map(tool => {
          const name = tool.name;
          const phase = ctx.busy[tool.kind + ':' + tool.id] ? 'starting' : ctx.states[tool.id]?.phase ?? 'unknown';
          const status = ({running:'running', starting:'checking', failed:'launchError', idle:'installed', unknown:'stateUnknown'} as const)[phase];
          return <article key={tool.id} className="vh-app-tile" data-phase={phase} data-testid={`app-tile-${tool.id}`}>
            <div className="vh-app-tile-heading">{tool.kind === 'app' ? <Link className="vh-app-identity" to={`/app/${tool.id}`} aria-label={t('prepare') + ' ' + name}>
              <AppLogo appId={tool.id} name={name} size={40} />
              <h2><bdi>{name}</bdi></h2>
            </Link> : <Link className="vh-app-identity" to={`/editor/${tool.id}`} aria-label={t('prepare') + ' ' + name}><AppLogo appId={tool.id} name={name} size={40} /><h2><bdi>{name}</bdi></h2></Link>}
            <span className="vh-app-status"><i aria-hidden="true" />{t('ux:' + status)}</span></div>
            {tool.app ? <p className="vh-app-description"><bdi>{new URL(tool.app.websiteUrl).hostname.replace(/^www\./, '')}</bdi><span aria-hidden="true"> · </span>{t('ux:' + (tool.app.freeAccess === 'unknown' ? 'unknownAccess' : tool.app.freeAccess))}</p>
              : tool.id === 'antigravity-ide' && <p className="vh-app-description">{t('workbench:ideProvider')}<span aria-hidden="true"> · </span>{t('workbench:ideFreeAccess')}</p>}
            <AppSummary appId={tool.id} />
            {tool.version && <span className="vh-app-version"><bdi>{tool.version}</bdi></span>}
            <LaunchControls id={tool.id} name={name} kind={tool.kind} compact supportsRtl={tool.kind === 'app' && (tool.id === 'antigravity' || tool.app?.capabilities.rtl === 'verified')} />
          </article>;
        })}
      </div>
      <Tooltip text={t('launchNote')} />
    </>}
    <section className="vh-update-checks space-y-3" aria-labelledby="version-check-heading">
      <h2 id="version-check-heading" className="font-semibold">{t('ux:versions.title')}</h2>
      <ul className="divide-y divide-border">{tools.map(tool => {
        const supported = tool.kind === 'app' && ['opencode', 'freebuff'].includes(tool.id);
        const name = tool.kind === 'app' ? tool.app?.name ?? tool.id : tool.name;
        const href = tool.kind === 'editor' ? `/editor/${tool.id}` : `/app/${tool.id}`;
        const result = versions[tool.id];
        return <li key={tool.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <Link className="vh-link" to={href}><bdi>{name}</bdi></Link>
        {supported ? <><Button size="sm" variant="ghost" loading={result?.loading} onClick={() => void checkVersion(tool.id, tool.version)}>{t('ux:versions.check')}</Button><span role="status">{result?.loading ? t('ux:versions.checking') : result?.error ? t('ux:versions.failed') : result?.version ? t('ux:versions.' + (result.comparison ?? 'incomparable')) : t('ux:versions.notChecked')}</span></> : <span role="status">{t('ux:versions.unsupported')}</span>}
        </li>;
      })}</ul>
    </section>
  </div>;
}
