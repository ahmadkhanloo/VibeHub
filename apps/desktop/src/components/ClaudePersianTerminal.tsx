import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { ipc, type ProviderConnection } from '@/services/ipc';
import { Badge, Button, ErrorNotice } from './ui';
import { claudeLaunchPreferences } from '@/services/claude-launch';
import { ConnectionEditor, newClaudeConnection } from '@/features/models/Models';

export function ClaudePersianTerminal() {
  const { t } = useTranslation(['ux', 'models']);
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [draft, setDraft] = useState<ProviderConnection>();
  const [connectionId, setConnectionId] = useState(() => claudeLaunchPreferences().connectionId ?? '');
  const [authHeader, setAuthHeader] = useState<'api-key' | 'bearer'>(() => claudeLaunchPreferences().authHeader);
  const [cwd, setCwd] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const reload = () => { void ipc.providerConnections().then(setConnections).catch(setError); };
  useEffect(reload, []);
  useEffect(() => {
    try { localStorage.setItem('vibehub.claude.connection', connectionId); localStorage.setItem('vibehub.claude.auth', authHeader); } catch { /* Session selection still works. */ }
  }, [connectionId, authHeader]);
  const run = async (rtl: boolean) => {
    setBusy(true); setError(null); setMessage('');
    try {
      await ipc.launchApp({appId:'claude-code', rtl, cwd, ...(connectionId ? {connectionId, authHeader} : {})});
      setMessage(t('claudePersian.opened'));
    } catch (reason) { setError(reason); }
    finally { setBusy(false); }
  };
  return <section className="vh-card space-y-4" aria-label={t('claudePersian.title')}>
    <div className="flex flex-wrap items-center gap-3"><h2 className="font-bold">{t('claudePersian.title')}</h2><Badge tone="warning">{t('claudePersian.experimental')}</Badge></div>
    <p className="text-sm leading-7">{t('claudePersian.description')}</p>
    {error != null && <ErrorNotice error={error} onRetry={reload} />}
    <label className="block space-y-2"><span>{t('claudePersian.connection')}</span>
      <select className="vh-input w-full" value={connectionId} disabled={busy} onChange={e => setConnectionId(e.target.value)}>
        <option value="">{t('claudePersian.existing')}</option>
        {connections.map(c => <option key={c.id} value={c.id} disabled={!c.modelId.trim()}>{c.name} — {c.modelId}</option>)}
      </select>
    </label>
    <Button disabled={busy} onClick={() => setDraft(newClaudeConnection())}>{t('models:addConnection')}</Button>
    {connectionId && <label className="block space-y-2"><span>{t('claudePersian.auth')}</span>
      <select className="vh-input w-full" value={authHeader} disabled={busy} onChange={e => setAuthHeader(e.target.value as typeof authHeader)}>
        <option value="api-key">x-api-key</option><option value="bearer">Bearer</option>
      </select>
    </label>}
    <p className="text-sm leading-7 text-muted">{t('claudePersian.compatibility')}</p>
    <div className="flex flex-wrap items-center gap-3">
      <Link className="vh-link" to="/models">{t('claudePersian.manage')}</Link>
      <Button disabled={busy} variant="ghost" onClick={reload}>{t('claudePersian.refresh')}</Button>
      <Button disabled={busy} onClick={async () => { try { const path = await open({directory:true,multiple:false}); if(typeof path === 'string') setCwd(path); } catch(reason) { setError(reason); } }}>{t('chooseProject')}</Button>
    </div>
    {cwd && <p><bdi>{cwd}</bdi></p>}
    <div className="flex flex-wrap gap-3">
      <Button variant="primary" disabled={busy} loading={busy} onClick={() => void run(true)}>{t('claudePersian.open')}</Button>
      <Button disabled={busy} onClick={() => void run(false)}>{t('claudePersian.normal')}</Button>
    </div>
    {message && <p role="status">{message}</p>}
    <p className="text-sm leading-7 text-muted">{t('claudePersian.verify')}</p>
    <Link className="vh-link" to="/app/claude-code?tab=guide">{t('claudePersian.apiGuide')}</Link>
    {draft && <ConnectionEditor connection={draft} existing={false} forClaude onClose={() => setDraft(undefined)}
      onSaved={saved => {
        setConnections(saved);
        setConnectionId(draft.id);
        setAuthHeader('api-key');
      }} />}
  </section>;
}
