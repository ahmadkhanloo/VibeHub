import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSettings } from '@/app/settings';
import { useToolContext } from '@/app/tool-context';
import { Button, CopyButton, ErrorNotice, Select } from './ui';

export function AppConnection({ appId }: { appId: string }) {
  const { t } = useTranslation('ux');
  const { settings, update } = useSettings();
  const { connections, connectionsError } = useToolContext();
  const previous = settings.previousApiByApp[appId];
  const selected = settings.apiConnectionByApp[appId] ?? '';
  const connection = connections?.find(item => item.id === selected);
  const missingSelection = !!selected && !!connections && !connection;
  const choose = (id: string) => update(current => ({ apiConnectionByApp: { ...current.apiConnectionByApp, [appId]: id } }));
  return <div className="space-y-3">
    <label className="block space-y-2 text-sm"><span>{t('apiReference')}</span><Select value={connection ? selected : ''} disabled={connections === null} options={[{ value: '', label: t('noConnection') }, ...(connections ?? []).map(item => ({ value: item.id, label: item.name }))]} onChange={id => update(current => ({ previousApiByApp: { ...current.previousApiByApp, [appId]: selected }, apiConnectionByApp: { ...current.apiConnectionByApp, [appId]: id } }))} /></label>
    <p className="text-sm text-muted">{t('apiReferenceHint')}</p>
    {connectionsError && <ErrorNotice error={t('connectionsUx:apiReferenceReadFailed')} />}
    {missingSelection && <p className="text-sm text-warning" role="status">{t('connectionsUx:apiReferenceUnavailable')}</p>}
    {connection && <div className="text-sm space-y-2"><p><bdi>{connection.baseUrl}</bdi> <CopyButton text={connection.baseUrl} label={t('common:copy')} /></p><p><bdi>{connection.modelId}</bdi> <CopyButton text={connection.modelId} label={t('common:copy')} /></p></div>}
    {previous !== undefined && (previous === '' || connections?.some(item => item.id === previous)) && <Button onClick={() => { choose(previous); update(current => { const next = { ...current.previousApiByApp }; delete next[appId]; return { previousApiByApp: next }; }); }}>{t('restoreConnection')}</Button>}
    {previous !== undefined && previous !== '' && connections && !connections.some(item => item.id === previous) && <p className="text-sm text-muted" role="status">{t('connectionsUx:previousApiUnavailable')}</p>}
    <Link className="vh-link" to="/connections/api">{t('apiConnections')}</Link>
  </div>;
}
