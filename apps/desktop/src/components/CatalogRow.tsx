import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AppManifest } from '@core';
import { AppLogo } from './AppLogo';

export function CatalogRow({ app, installed = false }: { app: AppManifest; installed?: boolean }) {
  const { t, i18n } = useTranslation('ux');
  return <Link className="vh-app-tile vh-catalog-tile" to={`/app/${app.id}`}>
    <div className="vh-app-identity"><AppLogo appId={app.id} name={app.name} size={48} /><h2><bdi>{app.name}</bdi></h2></div>
    <p className="vh-app-summary" title={app.summary[i18n.language.startsWith('fa') ? 'fa' : 'en']}>{t('appSummary.' + app.id, { defaultValue: app.summary[i18n.language.startsWith('fa') ? 'fa' : 'en'].split(/\s+/).slice(0, 6).join(' ') })}</p>
    <span className="vh-app-status">{t(installed ? 'installed' : app.freeAccess === 'unknown' ? 'unknownAccess' : app.freeAccess)}</span>
  </Link>;
}
