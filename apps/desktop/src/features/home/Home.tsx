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
import { Button, EmptyState, ErrorNotice, PageHeader, Spinner } from '@/components/ui';

export function HomePage() {
  const { t, i18n } = useTranslation(['ux', 'workbench']);
  const ctx = useToolContext();
  const catalog = useCatalog();
  const tools = ctx.apps.filter(app => app.installed).map(tool => ({
    ...tool, app: catalog.apps.find(app => app.id === tool.id),
  }));
  const running = tools.filter(tool => ctx.states[tool.id]?.phase === 'running').length;
  return <div className="vh-workspace space-y-6">
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
  </div>;
}
