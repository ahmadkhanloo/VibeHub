import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function ConnectionsPage() {
  const { t } = useTranslation('ux');
  const { pathname } = useLocation();
  return <div className="space-y-6">
    <nav className="flex gap-3" aria-label={t('connections')}>
      {([['/connections/api', 'apiConnections'], ['/connections/proxy', 'proxy']] as const).map(([to, key]) =>
        <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined} className={'vh-button ' + (pathname === to ? 'vh-button-primary' : 'vh-button-secondary')}>{t(key)}</Link>)}
    </nav>
    <Outlet />
  </div>;
}
