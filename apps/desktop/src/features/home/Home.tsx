import { AppSummary } from '@/components/AppSummary';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { useToolContext } from '@/app/tool-context';
import { useCatalog } from '@/lib/catalog';
import { AppLogo } from '@/components/AppLogo';
import { CatalogRow } from '@/components/CatalogRow';
import { LaunchControls } from '@/components/LaunchControls';
import { Tooltip } from '@/components/Tooltip';
import { Button, EmptyState, ErrorNotice, PageHeader, Spinner } from '@/components/ui';
import { useSettings } from '@/app/settings';

type WorkspaceView = 'installed' | 'available';

// Launchable agents are grouped by how they are usually run.
type HomeGroup = 'apps' | 'terminal';
const HOME_GROUPS = ['apps', 'terminal'] as const;
const groupOfApp = ({ id, kind }: { id: string; kind: string }): HomeGroup =>
  kind === 'cli_agent' && id !== 'mimocode' && id !== 'freebuff' ? 'terminal' : 'apps';
const groupKey = (group: HomeGroup) => group === 'apps' ? 'ux:groupApps' : 'ux:groupTerminal';

export function HomePage() {
  const { t, i18n } = useTranslation(['ux', 'workbench', 'apps']);
  const { settings } = useSettings();
  const ctx = useToolContext();
  const catalog = useCatalog();
  const [params, setParams] = useSearchParams();
  // One page, two views: what is installed and what can still be added. The view lives in
  // the URL so the browser history and the shell's search link keep working.
  const view: WorkspaceView = params.get('view') === 'available' ? 'available' : 'installed';
  const installedIds = new Set(ctx.apps.filter(app => app.installed).map(app => app.id));
  const tools = ctx.apps.filter(app => app.installed && catalog.apps.some(entry => entry.id === app.id)).map(tool => ({
      ...tool, name: catalog.apps.find(app => app.id === tool.id)?.name ?? tool.id,
      app: catalog.apps.find(app => app.id === tool.id), kind: 'app' as const,
    }));
  const available = ctx.detectionFailed ? [] : catalog.apps.filter(app => !installedIds.has(app.id));
  const installedGroups = HOME_GROUPS.map(id => ({ id, items: tools.filter(tool => groupOfApp(tool.app!) === id) })).filter(group => group.items.length > 0);
  const availableGroups = HOME_GROUPS.map(id => ({ id, items: available.filter(app => groupOfApp(app) === id) })).filter(group => group.items.length > 0);

  const setView = (next: WorkspaceView) => setParams(current => {
    const params = new URLSearchParams(current);
    params.delete('q');
    if (next === 'available') params.set('view', 'available'); else params.delete('view');
    return params;
  });

  const formatCount = new Intl.NumberFormat(i18n.language);
  const groupHeading = (group: { id: HomeGroup; items: unknown[] }) => {
    const count = formatCount.format(group.items.length);
    return <div className="vh-workspace-section-heading">
      <h2 className="vh-section-title">
        {view === 'installed' && group.id === 'apps'
          ? t('workbench:installedCount', { count: group.items.length, formattedCount: count })
          : <>{t(groupKey(group.id))} <span className="vh-section-count">({count})</span></>}
      </h2>
      {view === 'installed' && group.id === installedGroups[0]?.id && <Tooltip text={t('launchNote')} />}
    </div>;
  };

  return <div className={`vh-workspace ${settings.density === 'compact' ? 'space-y-1' : 'space-y-6'}`}>
    <PageHeader
      title={t('ux:workspace')}
      center={<nav className="vh-choice-group" data-view={view} aria-label={t('ux:workspace')}>
        {(['installed', 'available'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{t(value === 'installed' ? 'ux:installed' : 'ux:available')}</button>)}
      </nav>}
      actions={<>
        <Button variant="ghost" loading={ctx.loading} onClick={() => void ctx.refresh()} aria-label={t('refresh')} title={t('refresh')}><RefreshCw size={18} aria-hidden="true" /></Button>
      </>}
    />
    {ctx.errors.length > 0 && <ErrorNotice error={ctx.errors.join('\n')} message={ctx.detectionFailed ? undefined : t('partial')} onRetry={() => void ctx.refresh()} />}
    {ctx.loading && !tools.length && view === 'installed' ? <Spinner /> : view === 'available' ? (
      ctx.detectionFailed
        ? <EmptyState title={t('apps:installedUnknown')} sub={t('apps:installedUnknownHint')} action={<Button onClick={() => void ctx.refresh()}>{t('refresh')}</Button>} />
        : <>
            {available.length
              ? availableGroups.map(group => <section key={group.id} aria-label={t(groupKey(group.id))}>
                  {groupHeading(group)}
                  <div className="vh-app-grid">{group.items.map(app => <CatalogRow key={app.id} app={app} />)}</div>
                </section>)
              : <EmptyState title={t('ux:noResults')} sub={t('ux:trySearch')} action={<Button onClick={() => setView('installed')}>{t('ux:installed')}</Button>} />}
          </>
    ) : !tools.length && !ctx.detectionFailed ? <EmptyState title={t('noInstalled')} sub={t('noInstalledSub')} action={<Button variant="primary" onClick={() => setView('available')}>{t('ux:available')}</Button>} /> : <>
      {installedGroups.map(group => <section key={group.id} aria-label={t(groupKey(group.id))}>
      {groupHeading(group)}
      <div className="vh-app-grid vh-installed-grid">
        {group.items.map(tool => {
          const name = tool.name;
          const phase = ctx.busy[tool.kind + ':' + tool.id] ? 'starting' : ctx.states[tool.id]?.phase ?? 'unknown';
          const status = ({ running: 'running', starting: 'checking', failed: 'launchError', idle: null, unknown: null } as const)[phase];
          const identity = <>
            <AppLogo appId={tool.id} name={name} size={36} />
            <div className="vh-app-name">
              <h2><bdi>{name}</bdi></h2>
              {tool.version && <span className="vh-app-version"><bdi>{tool.version}</bdi></span>}
            </div>
          </>;
          return <article key={tool.id} id={`tool-${tool.id}`} className="vh-app-tile" data-phase={phase} data-testid={`app-tile-${tool.id}`}>
            <div className="vh-app-tile-heading">
              {tool.kind === 'app' ? <Link className="vh-app-identity" to={`/app/${tool.id}`} aria-label={t('prepare') + ' ' + name} title={tool.version ? name + ' · ' + tool.version : name}>
                {identity}
              </Link> : <div className="vh-app-identity">{identity}</div>}
              {status && <span className="vh-app-status"><i aria-hidden="true" />{t('ux:' + status)}</span>}
            </div>
            {tool.app ? <p className="vh-app-description"><bdi>{new URL(tool.app.websiteUrl).hostname.replace(/^www\./, '')}</bdi><span aria-hidden="true"> · </span>{t('ux:' + (tool.app.freeAccess === 'unknown' ? 'unknownAccess' : tool.app.freeAccess))}</p>
              : null}
            <AppSummary appId={tool.id} />
            <LaunchControls id={tool.id} name={name} kind={tool.kind} compact />
          </article>;
        })}
      </div>
    </section>)}
    </>}
  </div>;
}
