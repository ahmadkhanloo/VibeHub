import { useSettings } from '@/app/settings';
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil } from 'lucide-react';
import type { ProxyProfile } from '@core';
import { Button, ErrorNotice, Input, Modal, Select } from '@/components/ui';
import { useToolContext } from '@/app/tool-context';
import { ipc } from '@/services/ipc';

export function newProxyProfile(name = ''): ProxyProfile {
  return { id: `p-${crypto.randomUUID()}`, name, mode: 'http', host: '127.0.0.1', port: 10808 };
}

export function ProxyProfileEditor({ profile, onClose, onSaved }: {
  profile: ProxyProfile; onClose: () => void; onSaved: (profile: ProxyProfile) => Promise<void>;
}) {
  const { t } = useTranslation(['connectionsUx', 'proxy', 'common']);
  const id = useId();
  const [draft, setDraft] = useState({ ...profile });
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const local = draft.mode === 'http' || draft.mode === 'socks5';
  const save = async () => {
    if (saving.current) return;
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) nextErrors.name = t('connectionsUx:required');
    if (local && (!draft.host?.trim() || /[\s/\\@?#]/.test(draft.host))) nextErrors.host = t('connectionsUx:hostInvalid');
    if (local && (!Number.isInteger(draft.port) || draft.port! < 1 || draft.port! > 65535)) nextErrors.port = t('connectionsUx:portInvalid');
    if (local && draft.mode === 'socks5' && (password || draft.hasPassword) && !draft.username?.trim()) nextErrors.username = t('connectionsUx:socksUsername');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { requestAnimationFrame(() => document.getElementById(`${id}-${Object.keys(nextErrors)[0]}`)?.focus()); return; }
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      const normalized = { ...draft, name: draft.name.trim(), host: draft.host?.trim() };
      await ipc.proxySave(normalized, password || undefined);
      await onSaved(normalized);
      setPassword('');
      onClose();
    } catch (cause) { setError(cause); }
    finally { setBusy(false); saving.current = false; }
  };
  const field = (key: string, label: string, input: React.ReactNode) => (
    <label className="block space-y-2 text-sm" htmlFor={`${id}-${key}`}>
      <span className="block font-medium">{label}</span>{input}
      {errors[key] && <span id={`${id}-${key}-error`} role="alert" className="block text-sm text-danger">{errors[key]}</span>}
    </label>
  );
  return <Modal open title={t(profile.name ? 'connectionsUx:editProxy' : 'proxy:newProfile')} onClose={onClose} busy={busy}>
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {field('name', t('connectionsUx:profileName'), <Input id={`${id}-name`} dir="auto" data-autofocus value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id}-name-error` : undefined} />)}
        <label className="block space-y-2 text-sm"><span className="block font-medium">{t('common:mode')}</span><Select value={draft.mode} onChange={(mode) => setDraft({ ...draft, mode })} options={(['direct', 'system', 'http', 'socks5'] as const).map((value) => ({ value, label: t(`proxy:mode.${value}`) }))} /></label>
        {local && <>
          {field('host', t('proxy:host'), <Input id={`${id}-host`} dir="ltr" className="ltr-tech" value={draft.host ?? ''} onChange={(e) => setDraft({ ...draft, host: e.target.value })} aria-invalid={!!errors.host} aria-describedby={errors.host ? `${id}-host-error` : undefined} />)}
          {field('port', t('proxy:port'), <Input id={`${id}-port`} dir="ltr" type="number" min={1} max={65535} value={draft.port ?? ''} onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) })} aria-invalid={!!errors.port} aria-describedby={errors.port ? `${id}-port-error` : undefined} />)}
          {field('username', t('proxy:username'), <Input id={`${id}-username`} dir="auto" value={draft.username ?? ''} autoComplete="off" onChange={(e) => setDraft({ ...draft, username: e.target.value })} aria-invalid={!!errors.username} aria-describedby={errors.username ? `${id}-username-error` : undefined} />)}
          {field('password', t('proxy:password'), <Input id={`${id}-password`} dir="ltr" type="password" autoComplete="new-password" value={password} placeholder={draft.hasPassword ? t('connectionsUx:keepPassword') : ''} onChange={(e) => setPassword(e.target.value)} />)}
        </>}
      </fieldset>
      <p className="text-sm leading-6 text-muted">{t('proxy:passwordStoredVault')}</p>
      {local && (draft.username || password || draft.hasPassword) && <p className="text-sm text-warning">{t('connectionsUx:authenticatedLaunch')}</p>}
      {error != null && <ErrorNotice error={error} />}
      <div className="flex justify-end gap-2"><Button disabled={busy} onClick={onClose}>{t('common:cancel')}</Button><Button type="submit" variant="primary" loading={busy}>{t('common:save')}</Button></div>
    </form>
  </Modal>;
}

export function ToolProxy({ appId }: { appId: string }) {
  const { t } = useTranslation(['connectionsUx', 'proxy', 'common']);
  const { profiles, proxyConfig, refreshProxy, saveToolProxy } = useToolContext();
  const [editing, setEditing] = useState<ProxyProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const { settings, update } = useSettings();
  const previous = settings.previousProxyByApp[appId];
  const [testResult, setTestResult] = useState<string | null>(null);
  const selectedId = proxyConfig?.perApp[appId] ?? 'inherit';
  const selected = profiles.find((p) => p.id === (selectedId === 'inherit' ? proxyConfig?.globalProfileId : selectedId));
  const choose = async (value: string) => {
    setBusy(true); setError(null); setSaved(false);
    try { await saveToolProxy(appId, value); update(current => ({ previousProxyByApp: { ...current.previousProxyByApp, [appId]: selectedId } })); setSaved(true); }
    catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3" data-testid="tool-proxy">
    <p className="text-sm leading-6 text-muted">{t('connectionsUx:toolProxyIntro')}</p>
    {!proxyConfig ? <ErrorNotice error={t('connectionsUx:proxyReadFailed')} onRetry={() => { void refreshProxy().catch(setError); }} /> : <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-56 flex-1 space-y-2 text-sm"><span className="block font-medium">{t('connectionsUx:thisToolProxy')}</span>
          <Select value={selectedId} disabled={busy} onChange={(value) => void choose(value)} options={[
            { value: 'inherit', label: `${t('proxy:inherit')} (${profiles.find((p) => p.id === proxyConfig.globalProfileId)?.name ?? t('proxy:noDefault')})` },
            ...profiles.filter((p) => !proxyConfig.requireProxy || p.mode === 'http' || p.mode === 'socks5').map((p) => ({ value: p.id, label: p.name })),
          ]} />
        </label>
        <Button disabled={busy} onClick={() => setEditing(newProxyProfile())}><Plus size={16} aria-hidden="true" />{t('proxy:newProfile')}</Button>
        {selected && <Button disabled={busy} onClick={() => setEditing(selected)}><Pencil size={16} aria-hidden="true" />{t('common:edit')}</Button>}
      </div>
      {previous !== undefined && <Button disabled={busy} onClick={() => void choose(previous)}>{t('ux:restoreConnection')}</Button>}
      {selected && <Button disabled={busy} onClick={async () => { setBusy(true); setError(null); setTestResult(null); try { const result = await ipc.proxyTest(selected, 'handshake'); if (!result.ok) throw new Error(result.detail); setTestResult(result.detail); } catch (cause) { setError(cause); } finally { setBusy(false); } }}>{t('proxy:handshake')}</Button>}
      {testResult && <p role="status" className="text-sm text-success">{testResult}</p>}
      {saved && <p role="status" className="text-sm text-success">{t('connectionsUx:toolProxySaved')}</p>}
    </>}
    {error != null && <ErrorNotice error={error} />}
    <p className="text-sm leading-6 text-muted">{t('connectionsUx:proxyScope')}</p>
    <Link className="text-sm text-primary underline underline-offset-4" to="/proxy">{t('connectionsUx:manageProxy')}</Link>
    {editing && <ProxyProfileEditor key={editing.id} profile={editing} onClose={() => setEditing(null)} onSaved={async (profile) => {
      await refreshProxy();
      await saveToolProxy(appId, profile.id);
      setSaved(true);
    }} />}
  </div>;
}
