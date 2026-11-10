import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { filterApps } from '@catalog';
import { useCatalog } from '@/lib/catalog';
import { useToolContext } from '@/app/tool-context';
import { CatalogRow } from '@/components/CatalogRow';
import { Button, EmptyState, ErrorNotice, PageHeader, Spinner } from '@/components/ui';

export function DiscoverPage() {
  const { t } = useTranslation(['ux', 'apps']);
  const [params, setParams] = useSearchParams();
  const catalog = useCatalog();
  const ctx = useToolContext();
  const query = params.get('q') ?? '';
  const installedIds = new Set(ctx.apps.filter(app => app.installed).map(app => app.id));
  const results = ctx.detectionFailed ? [] : filterApps(catalog, {
    query,
    openSourceOnly: false,
    freeAccess: 'all',
    rtlVerified: false,
    installedIds: [...installedIds],
    installedOnly: false,
  }).filter(app => !installedIds.has(app.id));

  return <div className="space-y-6">
    <PageHeader title={t('ux:discover')} />
    <nav className="vh-choice-group" aria-label={t('ux:workspace')}><Link to="/">{t('ux:installed')}</Link><Link aria-current="page" to="/discover">{t('ux:discover')}</Link></nav>
    {ctx.errors.length > 0 && <ErrorNotice error={ctx.errors.join('\n')} onRetry={() => void ctx.refresh()} />}
    {query && <Button size="sm" onClick={() => setParams({})}>{t('ux:clearSearch')}: {query}</Button>}
    {ctx.loading ? <Spinner /> : ctx.detectionFailed ? <EmptyState title={t('apps:installedUnknown')} sub={t('apps:installedUnknownHint')} action={<Button onClick={() => void ctx.refresh()}>{t('refresh')}</Button>} /> : <>
      <p role="status" className="vh-section-kicker">{t('ux:searchCount', { count: results.length })}</p>
      {results.length ? <div className="vh-app-grid">{results.map(app => <CatalogRow key={app.id} app={app} />)}</div>
        : <EmptyState title={t('ux:noResults')} sub={t('ux:trySearch')} action={query ? <Button onClick={() => setParams({})}>{t('ux:clearSearch')}</Button> : undefined} />}
    </>}
  </div>;
}
