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
  const { t } = useTranslation('ux');
  const ctx = useToolContext();
  const catalog = useCatalog();
  const tools = ctx.apps.filter(app => app.installed).map(tool => ({
    ...tool, app: catalog.apps.find(app => app.id === tool.id),
  }));
  return <div className="space-y-6">
    <PageHeader title={t('workspace')} actions={<>
      <Button variant="ghost" loading={ctx.loading} onClick={() => void ctx.refresh()} aria-label={t('refresh')} title={t('refresh')}><RefreshCw size={18} aria-hidden="true" /></Button>
      <Link to="/discover" className="vh-button vh-button-secondary"><Plus size={16} aria-hidden="true" />{t('addApp')}</Link>
    </>} />
    <Projects />
    {ctx.errors.length > 0 && <ErrorNotice error={ctx.errors.join('\n')} message={ctx.detectionFailed ? undefined : t('partial')} onRetry={() => void ctx.refresh()} />}
    {ctx.loading && !tools.length ? <Spinner /> : !tools.length && !ctx.detectionFailed ? <EmptyState title={t('noInstalled')} sub={t('noInstalledSub')} action={<Link to="/discover" className="vh-button vh-button-primary">{t('discover')}</Link>} /> : !!tools.length && <>
      <div className="vh-app-grid" aria-label={t('workspace')}>
        {tools.map(tool => {
          const name = tool.app?.name ?? tool.id;
          return <article key={tool.id} className="vh-app-tile" data-testid={`app-tile-${tool.id}`}>
            <Link className="vh-app-identity" to={`/app/${tool.id}`} aria-label={t('prepare') + ' ' + name}>
              <AppLogo appId={tool.id} name={name} size={48} />
              <h2><bdi>{name}</bdi></h2>
            </Link>
            <span className="vh-app-status">{t(!ctx.states[tool.id] ? 'stateUnknown' : ctx.states[tool.id]?.phase === 'running' ? 'running' : ctx.states[tool.id]?.phase === 'starting' || ctx.busy['app:' + tool.id] ? 'checking' : ctx.states[tool.id]?.phase === 'failed' || ctx.failures['app:' + tool.id] ? 'launchError' : 'installed')}</span>
            <AppSummary appId={tool.id} />
            <LaunchControls id={tool.id} name={name} compact supportsRtl={tool.id === 'antigravity' || tool.app?.capabilities.rtl === 'verified'} />
          </article>;
        })}
      </div>
      <Tooltip text={t('launchNote')} />
    </>}
  </div>;
}
