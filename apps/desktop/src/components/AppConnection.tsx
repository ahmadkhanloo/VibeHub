import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSettings } from '@/app/settings';
import { ipc, type ProviderConnection } from '@/services/ipc';
import { Button, CopyButton, ErrorNotice, Select } from './ui';

export function AppConnection({ appId }: { appId: string }) {
  const { t } = useTranslation('ux');
  const { settings, update } = useSettings();
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [error, setError] = useState<unknown>(null);
  const previous = settings.previousApiByApp[appId];
  useEffect(() => { let active = true; void ipc.providerConnections().then(value => { if (active) setConnections(value); }).catch(cause => { if (active) setError(cause); }); return () => { active = false; }; }, []);
  const selected = settings.apiConnectionByApp[appId] ?? '';
  const connection = connections.find(item => item.id === selected);
  const choose = (id: string) => update(current => ({ apiConnectionByApp: { ...current.apiConnectionByApp, [appId]: id } }));
  return <div className="space-y-3">
    <label className="block space-y-2 text-sm"><span>{t('apiReference')}</span><Select value={connection ? selected : ''} options={[{ value: '', label: t('noConnection') }, ...connections.map(item => ({ value: item.id, label: item.name }))]} onChange={id => update(current => ({ previousApiByApp: { ...current.previousApiByApp, [appId]: selected }, apiConnectionByApp: { ...current.apiConnectionByApp, [appId]: id } }))} /></label>
    <p className="text-sm text-muted">{t('apiReferenceHint')}</p>
    {connection && <div className="text-sm space-y-2"><p><bdi>{connection.baseUrl}</bdi> <CopyButton text={connection.baseUrl} label={t('common:copy')} /></p><p><bdi>{connection.modelId}</bdi> <CopyButton text={connection.modelId} label={t('common:copy')} /></p></div>}
    {previous !== undefined && <Button onClick={() => { choose(previous); update(current => { const next = { ...current.previousApiByApp }; delete next[appId]; return { previousApiByApp: next }; }); }}>{t('restoreConnection')}</Button>}
    {error != null && <ErrorNotice error={error} />}
    <Link className="vh-link" to="/connections/api">{t('apiConnections')}</Link>
  </div>;
}
