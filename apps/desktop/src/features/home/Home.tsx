import { AppSummary } from '@/components/AppSummary';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw } from 'lucide-react';
import { useToolContext } from '@/app/tool-context';
import { useCatalog } from '@/lib/catalog';
import { AppLogo } from '@/components/AppLogo';
import { CatalogRow } from '@/components/CatalogRow';
import { LaunchControls } from '@/components/LaunchControls';
import { ToolChipSection, TerminalCard, useToolchainStatus } from '@/components/ToolCards';
import { Tooltip } from '@/components/Tooltip';
import { Button, EmptyState, ErrorNotice, PageHeader, Spinner } from '@/components/ui';
import { useSettings } from '@/app/settings';

type WorkspaceView = 'installed' | 'available';

// The workspace reads as three plain groups: launchable apps, the terminal tools the
// CLI agents share, and the helper tools documented beside them. Editors are detected
// by the backend but intentionally not listed here — the grid stays about agents.
type HomeGroup = 'apps' | 'terminal';
const HOME_GROUPS = ['apps', 'terminal'] as const;
const groupOfKind = (kind: string): HomeGroup => kind === 'cli_agent' ? 'terminal' : 'apps';
const groupKey = (group: HomeGroup) => group === 'apps' ? 'ux:groupApps' : 'ux:groupTerminal';

export function HomePage() {
  const { t } = useTranslation(['ux', 'workbench', 'apps']);
  const { settings } = useSettings();
  const ctx = useToolContext();
  const catalog = useCatalog();
  const toolchain = useToolchainStatus();
  const [params, setParams] = useSearchParams();
  // One page, two views: what is installed and what can still be added. The view lives in
  // the URL so the browser history and the shell's search link keep working.
  const view: WorkspaceView = params.get('view') === 'available' ? 'available' : 'installed';
  const installedIds = new Set(ctx.apps.filter(app => app.installed).map(app => app.id));
  const tools = ctx.apps.filter(app => app.installed && catalog.apps.some(entry => entry.id === app.id)).map(tool => ({
      ...tool, name: catalog.apps.find(app => app.id === tool.id)?.name ?? tool.id,
      app: catalog.apps.find(app => app.id === tool.id), kind: 'app' as const,
    }));
  const running = tools.filter(tool => ctx.states[tool.id]?.phase === 'running').length;
  const available = ctx.detectionFailed ? [] : catalog.apps.filter(app => !installedIds.has(app.id));
  const installedGroups = HOME_GROUPS.map(id => ({ id, items: tools.filter(tool => groupOfKind(tool.app!.kind) === id) })).filter(group => group.items.length > 0);
  const availableGroups = HOME_GROUPS.map(id => ({ id, items: available.filter(app => groupOfKind(app.kind) === id) })).filter(group => group.items.length > 0);

  const setView = (next: WorkspaceView) => setParams(current => {
    const params = new URLSearchParams(current);
    params.delete('q');
    if (next === 'available') params.set('view', 'available'); else params.delete('view');
    return params;
  });

  const groupHeading = (group: { id: HomeGroup; items: unknown[] }) =>
    <h2 className="vh-section-title mb-3">{t(groupKey(group.id))} <span className="vh-section-count">({group.items.length})</span></h2>;

  return <div className={`vh-workspace ${settings.density === 'compact' ? 'space-y-1' : 'space-y-6'}`}>
    <PageHeader title={t('ux:workspace')} actions={<>
      <Button variant="ghost" loading={ctx.loading} onClick={() => void ctx.refresh()} aria-label={t('refresh')} title={t('refresh')}><RefreshCw size={18} aria-hidden="true" /></Button>
      <Button variant="primary" onClick={() => setView('available')}><Plus size={16} aria-hidden="true" />{t('addApp')}</Button>
    </>} />
    <nav className="vh-choice-group" aria-label={t('ux:workspace')}>
      {(['installed', 'available'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{t(value === 'installed' ? 'ux:installed' : 'ux:available')}</button>)}
    </nav>
    <div className="vh-workspace-meta">
      {view === 'installed'
        ? <>
            <span><i className="vh-count-dot" aria-hidden="true" />{t('workbench:installedCount', { count: tools.length })}</span>
            {running > 0 && <span><i className="vh-count-dot is-running" aria-hidden="true" />{t('workbench:runningCount', { count: running })}</span>}
            <Tooltip text={t('launchNote')} />
          </>
        : <span role="status"><i className="vh-count-dot" aria-hidden="true" />{t('ux:searchCount', { count: available.length })}</span>}
    </div>
    {ctx.errors.length > 0 && <ErrorNotice error={ctx.errors.join('\n')} message={ctx.detectionFailed ? undefined : t('partial')} onRetry={() => void ctx.refresh()} />}
    {ctx.loading && !tools.length && view === 'installed' ? <Spinner /> : view === 'available' ? (
      ctx.detectionFailed
        ? <EmptyState title={t('apps:installedUnknown')} sub={t('apps:installedUnknownHint')} action={<Button onClick={() => void ctx.refresh()}>{t('refresh')}</Button>} />
        : <>
            {available.length
              ? availableGroups.map(group => <section key={group.id} aria-label={t(groupKey(group.id))}>
                  {groupHeading(group)}
                  <div className="vh-app-grid">{group.items.map(app => <CatalogRow key={app.id} app={app} />)}</div>
                  {group.id === 'terminal' && <div className="vh-tools-grid mt-3"><TerminalCard /></div>}
                </section>)
              : <EmptyState title={t('ux:noResults')} sub={t('ux:trySearch')} action={<Button onClick={() => setView('installed')}>{t('ux:installed')}</Button>} />}
            {/* Missing helpers and skills belong in the available view, next to the apps. */}
            <ToolChipSection status={toolchain} filter="missing" />
          </>
    ) : !tools.length && !ctx.detectionFailed ? <EmptyState title={t('noInstalled')} sub={t('noInstalledSub')} action={<Button variant="primary" onClick={() => setView('available')}>{t('ux:available')}</Button>} /> : <>
      {installedGroups.map(group => <section key={group.id} aria-label={t(groupKey(group.id))}>
      {groupHeading(group)}
      <div className="vh-app-grid">
        {group.items.map(tool => {
          const name = tool.name;
          const phase = ctx.busy[tool.kind + ':' + tool.id] ? 'starting' : ctx.states[tool.id]?.phase ?? 'unknown';
          const status = ({running:'running', starting:'checking', failed:'launchError', idle:'installed', unknown:'stateUnknown'} as const)[phase];
          return <article key={tool.id} className="vh-app-tile" data-phase={phase} data-testid={`app-tile-${tool.id}`}>
            <div className="vh-app-tile-heading">{tool.kind === 'app' ? <Link className="vh-app-identity" to={`/app/${tool.id}`} aria-label={t('prepare') + ' ' + name} title={tool.version ? name + ' · ' + tool.version : name}>
              <AppLogo appId={tool.id} name={name} size={36} />
              <h2><bdi>{name}</bdi></h2>
              {tool.version && <span className="vh-app-version"><bdi>{tool.version}</bdi></span>}
            </Link> : <div className="vh-app-identity"><AppLogo appId={tool.id} name={name} size={36} /><h2><bdi>{name}</bdi></h2>{tool.version && <span className="vh-app-version"><bdi>{tool.version}</bdi></span>}</div>}
            {status !== 'installed' && <span className="vh-app-status"><i aria-hidden="true" />{t('ux:' + status)}</span>}</div>
            {tool.app ? <p className="vh-app-description"><bdi>{new URL(tool.app.websiteUrl).hostname.replace(/^www\./, '')}</bdi><span aria-hidden="true"> · </span>{t('ux:' + (tool.app.freeAccess === 'unknown' ? 'unknownAccess' : tool.app.freeAccess))}</p>
              : null}
            <AppSummary appId={tool.id} />
            <LaunchControls id={tool.id} name={name} kind={tool.kind} compact />
          </article>;
        })}
      </div>
      {group.id === 'terminal' && <div className="vh-tools-grid mt-3"><TerminalCard /></div>}
    </section>)}
      {/* Detected helpers and skills stay deliberately low-key: slim chip rows that
          link to their learning articles, where the full explanation lives. */}
      <ToolChipSection status={toolchain} filter="installed" />
    </>}
  </div>;
}
