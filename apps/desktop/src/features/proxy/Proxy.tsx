import { Disclosure } from '@/components/Disclosure';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle2, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorNotice, Modal, PageHeader, SectionTitle, Select, Toggle } from '@/components/ui';
import { useToolContext } from '@/app/tool-context';
import { useCatalog } from '@/lib/catalog';
import { ipc } from '@/services/ipc';
import { newProxyProfile, ProxyProfileEditor } from './ToolProxy';
import type { ProxyConfig, ProxyProfile, ProxyTestResult } from '@core';

export function ProxyPage() {
  const { t } = useTranslation(['proxy', 'connectionsUx', 'common']);
  const { profiles, proxyConfig: config, refreshProxy, editors } = useToolContext();
  const { apps } = useCatalog();
  const [editing, setEditing] = useState<ProxyProfile | null>(null);
  const [deleting, setDeleting] = useState<ProxyProfile | null>(null);
  const [testing, setTesting] = useState<ProxyProfile | null>(null);
  const [tests, setTests] = useState<Record<string, ProxyTestResult[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const operation = useRef(false);
  const act = async (key: string, fn: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true; setBusy(key); setError(null); setMessage('');
    try { await fn(); } catch (cause) { setError(cause); }
    finally { operation.current = false; setBusy(null); }
  };
  const saveConfig = (change: Partial<ProxyConfig>) => act('config', async () => {
    const latest = await ipc.proxyConfig();
    const next = { ...latest, ...change };
    const selected = profiles.find((p) => p.id === next.globalProfileId);
    if (next.requireProxy && (!selected || !['http', 'socks5'].includes(selected.mode))) throw new Error(t('proxy:chooseDefaultFirst'));
    await ipc.proxySetConfig(next);
    await refreshProxy(); setMessage(t('connectionsUx:proxyConfigSaved'));
  });
  const defaultProfile = profiles.find((p) => p.id === config?.globalProfileId);
  const affectedTools = deleting && config ? Object.entries(config.perApp).filter(([, value]) => value === deleting.id).map(([id]) => ({ id, name: apps.find((a) => a.id === id)?.name ?? editors.find((e) => e.id === id)?.name ?? id, app: apps.some((a) => a.id === id) })) : [];
  const usedAsDefault = !!deleting && config?.globalProfileId === deleting.id;
  const inUse = usedAsDefault || affectedTools.length > 0;
  return <div className="space-y-8">
    <PageHeader title={t('proxy:title')} actions={<Button disabled={busy !== null} variant="primary" onClick={() => setEditing(newProxyProfile())}><Plus size={16} aria-hidden="true" />{t('proxy:newProfile')}</Button>} />
    {error != null && !deleting && !testing && <ErrorNotice error={error} />}
    {message && <p role="status" className="text-sm text-success">{message}</p>}
    {!config ? <ErrorNotice error={t('connectionsUx:proxyReadFailed')} onRetry={() => { void act('refresh', async () => { await refreshProxy(); }); }} /> : <Card className="space-y-4" as="section" id="proxy-default-route">
      <SectionTitle>{t('proxy:defaultRoute')}</SectionTitle>
      <div className="max-w-xl space-y-4">
        <label className="block space-y-2 text-sm"><span className="block font-medium">{t('proxy:globalProfile')}</span><Select value={config.globalProfileId} disabled={busy !== null} onChange={(globalProfileId) => { void saveConfig({ globalProfileId }); }} options={[{ value: '', label: t('proxy:noDefault') }, ...profiles.filter((p) => !config.requireProxy || p.mode === 'http' || p.mode === 'socks5').map((p) => ({ value: p.id, label: p.name }))]} /></label>
        {defaultProfile && <div className="flex flex-wrap items-center gap-2"><Badge tone="primary">{t('proxy:defaultProfile')}</Badge><span className="text-sm">{defaultProfile.name}</span><Badge tone="muted">{t(`proxy:mode.${defaultProfile.mode}`)}</Badge></div>}
        <Toggle checked={config.requireProxy} disabled={busy !== null} onChange={(requireProxy) => { void saveConfig({ requireProxy }); }} label={t('proxy:requireProxy')} />
      </div>
      <p className="max-w-3xl text-sm leading-7 text-muted">{t('proxy:requireProxyHint')}</p>
      <details className="text-sm"><summary className="cursor-pointer font-medium">{t('connectionsUx:proxyLimitations')}</summary><p className="mt-2 max-w-3xl leading-7 text-muted">{t('proxy:editorProxyHint')}</p></details>
    </Card>}
    <section aria-labelledby="proxy-profiles-heading"><SectionTitle action={<Button size="sm" disabled={busy !== null} onClick={() => void act('refresh', async () => { await refreshProxy(); })}><RefreshCw size={16} aria-hidden="true" />{t('connectionsUx:refreshProfiles')}</Button>}><span id="proxy-profiles-heading">{t('proxy:profiles')}</span></SectionTitle>
      {profiles.length === 0 ? <EmptyState title={t('proxy:noProfiles')} sub={t('proxy:addFirstProfile')} /> : <div className="vh-record-list">{profiles.map((profile) => {
        const results = tests[profile.id] ?? [];
        const testable = profile.mode === 'http' || profile.mode === 'socks5';
        const status = results.some((r) => !r.ok) ? 'failed' : results.length === 3 ? 'healthy' : results.length ? 'partial' : 'untested';
        return <Card key={profile.id} className="space-y-4" data-testid={`proxy-profile-${profile.id}`}>
          <div className="flex flex-wrap items-start gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-base font-bold" dir="auto">{profile.name}</h3>{config?.globalProfileId === profile.id && <Badge tone="primary">{t('proxy:defaultProfile')}</Badge>}</div><div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone="muted">{t(`proxy:mode.${profile.mode}`)}</Badge>{profile.hasPassword && <Badge tone="muted">{t('common:secureVault')}</Badge>}<Badge tone={!testable || status === 'untested' ? 'muted' : status === 'healthy' ? 'success' : status === 'failed' ? 'danger' : 'warning'}>{t(testable ? `proxy:${status}` : 'proxy:notTestable')}</Badge></div>{testable && <p className="ltr-tech mt-2 break-all text-sm text-muted">{profile.host}:{profile.port}</p>}</div><div className="flex gap-2"><Button size="sm" disabled={busy !== null} onClick={() => setEditing(profile)}>{t('common:edit')}</Button><Button size="sm" variant="ghost" disabled={busy !== null} aria-label={t('proxy:deleteNamedProfile', { name: profile.name })} onClick={() => { setError(null); setDeleting(profile); }}><Trash2 size={16} aria-hidden="true" />{t('common:delete')}</Button></div></div>
          {testable && <Button size="sm" disabled={busy !== null} loading={busy === `test:${profile.id}`} onClick={() => { setError(null); setTesting(profile); }}>{t('proxy:testAll')}</Button>}
          {results.length > 0 && <Disclosure title={t('ux:details')} defaultOpen={status !== 'healthy'}><div className="space-y-2 border-t border-border pt-3" aria-live="polite">{results.map((result) => <div key={result.level} className="flex items-start gap-2 text-sm">{result.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />}<span>{t(`proxy:${result.level}`)}: {t(result.ok ? 'connectionsUx:confirmed' : 'connectionsUx:notConfirmed')}</span></div>)}</div></Disclosure>}
        </Card>;
      })}</div>}
    </section>
    <Disclosure title={t('ux:help')}><p className="max-w-3xl text-sm leading-7 text-muted">{t('proxy:scopeNote')}</p><p className="max-w-3xl text-sm leading-7 text-muted">{t('proxy:termsNote')}</p></Disclosure>
    {editing && <ProxyProfileEditor key={editing.id} profile={editing} onClose={() => setEditing(null)} onSaved={async (profile) => { await refreshProxy(); setTests((current) => { const next = { ...current }; delete next[profile.id]; return next; }); setMessage(t('connectionsUx:profileSaved')); }} />}
    <Modal open={!!deleting} title={t(inUse ? 'connectionsUx:profileInUse' : 'connectionsUx:deleteProxy')} onClose={() => setDeleting(null)} busy={busy !== null}>
      <p className="text-sm leading-7">{t(inUse ? 'connectionsUx:profileInUseHint' : 'connectionsUx:deleteProxyHint', { name: deleting?.name })}</p>
      {usedAsDefault && <Button variant="ghost" className="mt-3" onClick={() => { setDeleting(null); requestAnimationFrame(() => { const control = document.querySelector<HTMLSelectElement>('#proxy-default-route select'); control?.scrollIntoView({ block: 'center' }); control?.focus(); }); }}>{t('connectionsUx:changeGlobalFirst')}</Button>}
      {affectedTools.length > 0 && <ul className="mt-3 space-y-2 text-sm">{affectedTools.map((tool) => <li key={tool.id}>{tool.app ? <Link to={`/app/${tool.id}`} onClick={() => setDeleting(null)} className="text-primary underline">{tool.name}</Link> : <Link to="/" onClick={() => setDeleting(null)} className="text-primary underline">{tool.name}</Link>}</li>)}</ul>}
      {error != null && <ErrorNotice error={error} />}
      <div className="mt-5 flex justify-end gap-2"><Button disabled={busy !== null} onClick={() => setDeleting(null)}>{t('common:cancel')}</Button>{!inUse && <Button variant="danger" loading={busy === 'delete'} onClick={() => void act('delete', async () => { if (!deleting) return; await ipc.proxyDelete(deleting.id); await refreshProxy(); setTests((current) => { const next = { ...current }; delete next[deleting.id]; return next; }); setDeleting(null); setMessage(t('connectionsUx:profileDeleted')); })}>{t('common:delete')}</Button>}</div>
    </Modal>
    <Modal open={!!testing} title={t('proxy:healthTitle')} onClose={() => setTesting(null)} busy={busy !== null}>
      <p className="text-sm leading-7">{t('proxy:testConsent')}</p>{error != null && <ErrorNotice error={error} />}
      <div className="mt-5 flex justify-end gap-2"><Button disabled={busy !== null} onClick={() => setTesting(null)}>{t('common:cancel')}</Button><Button variant="primary" loading={busy !== null} onClick={() => void act(`test:${testing?.id}`, async () => { if (!testing) return; const profile = testing; setTests((current) => ({ ...current, [profile.id]: [] })); const results: ProxyTestResult[] = []; for (const level of ['tcp', 'handshake', 'request'] as const) { results.push(await ipc.proxyTest(profile, level)); setTests((current) => ({ ...current, [profile.id]: [...results] })); } setTesting(null); })}>{t('common:confirm')}</Button></div>
    </Modal>
  </div>;
}
