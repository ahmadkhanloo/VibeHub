import { Disclosure } from '@/components/Disclosure';
import { Tooltip } from '@/components/Tooltip';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle2, Network, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';
import { Badge, Button, Card, EmptyState, ErrorNotice, Modal, PageHeader, SectionTitle, Select, Toggle } from '@/components/ui';
import { useToolContext } from '@/app/tool-context';
import { useCatalog } from '@/lib/catalog';
import { ipc } from '@/services/ipc';
import { newProxyProfile, ProxyProfileEditor } from './ToolProxy';
import type { ProxyConfig, ProxyProfile, ProxyTestResult } from '@core';

const V2RAY: ProxyProfile = { id: 'v2ray', name: 'V2Ray', mode: 'mixed', host: '127.0.0.1', port: 10808 };

export function ProxyPage() {
  const { t } = useTranslation(['proxy', 'connectionsUx', 'common']);
  const { profiles, proxyConfig: config, apps: detectedApps, editors, refreshProxy, saveToolProxy } = useToolContext();
  const { apps: catalogApps } = useCatalog();
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
    if (next.requireProxy && (!selected || selected.mode === 'direct' || selected.mode === 'system')) throw new Error(t('proxy:chooseDefaultFirst'));
    await ipc.proxySetConfig(next);
    await refreshProxy(); setMessage(t('connectionsUx:proxyConfigSaved'));
  });
  const installedIds = new Set(detectedApps.filter(app => app.installed).map(app => app.id));
  const installedCliTools = catalogApps
    .filter(app => installedIds.has(app.id) && app.kind === 'cli_agent')
    .map(app => ({ id: app.id, name: app.name, app: true }));
  const tools = installedCliTools.sort((a, b) => a.name.localeCompare(b.name));
  const affectedTools = deleting && config ? Object.entries(config.perApp).filter(([, value]) => value === deleting.id).map(([id]) => ({ id, name: catalogApps.find((a) => a.id === id)?.name ?? editors.find((e) => e.id === id)?.name ?? id, app: catalogApps.some((a) => a.id === id) })) : [];
  const usedAsDefault = !!deleting && config?.globalProfileId === deleting.id;
  const inUse = usedAsDefault || affectedTools.length > 0;
  const hasV2Ray = profiles.some(profile => profile.id === V2RAY.id);
  return <div className="space-y-8">
    <PageHeader title={t('proxy:title')} titleAside={<Tooltip text={t('proxy:scopeNote')} />} actions={<>
      {config && !hasV2Ray && <Button loading={busy === 'v2ray'} disabled={busy !== null} onClick={() => void act('v2ray', async () => {
        if (!(await ipc.proxyProfiles()).some(profile => profile.id === V2RAY.id)) await ipc.proxySave(V2RAY);
        await refreshProxy();
      })}>{t('proxy:addV2Ray')}</Button>}
      <Button disabled={busy !== null} variant="primary" onClick={() => setEditing(newProxyProfile())}><Plus size={16} aria-hidden="true" />{t('proxy:newProfile')}</Button>
    </>} />
    {error != null && !deleting && !testing && <ErrorNotice error={error} />}
    {message && <p role="status" className="text-sm text-success">{message}</p>}
    {!config ? <ErrorNotice error={t('connectionsUx:proxyReadFailed')} onRetry={() => { void act('refresh', async () => { await refreshProxy(); }); }} /> : <Card className="space-y-4" as="section" id="proxy-default-route">
      <SectionTitle>{t('proxy:defaultRoute')}</SectionTitle>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block w-full max-w-sm space-y-2 text-sm"><span className="block font-medium">{t('proxy:globalProfile')}</span><Select value={config.globalProfileId} disabled={busy !== null} onChange={(globalProfileId) => { void saveConfig({ globalProfileId }); }} options={[{ value: '', label: t('proxy:noDefault') }, ...profiles.filter((p) => !config.requireProxy || (p.mode !== 'direct' && p.mode !== 'system')).map((p) => ({ value: p.id, label: p.name }))]} /></label>
        <div className="flex min-h-10 items-center gap-1">
          <Toggle checked={config.requireProxy} disabled={busy !== null} onChange={(requireProxy) => { void saveConfig({ requireProxy }); }} label={t('proxy:requireProxy')} />
          <Tooltip text={t('proxy:requireProxyHint') + '\n' + t('proxy:editorProxyHint')} />
        </div>
      </div>
    </Card>}
    <section aria-labelledby="proxy-profiles-heading"><SectionTitle action={<Button size="sm" disabled={busy !== null} onClick={() => void act('refresh', async () => { await refreshProxy(); })}><RefreshCw size={16} aria-hidden="true" />{t('connectionsUx:refreshProfiles')}</Button>}><span id="proxy-profiles-heading">{t('proxy:profiles')}</span></SectionTitle>
      {profiles.length === 0 ? <EmptyState title={t('proxy:noProfiles')} /> : <div className="grid gap-3">{profiles.map((profile) => {
        const results = tests[profile.id] ?? [];
        const testable = profile.mode !== 'direct' && profile.mode !== 'system';
        const assignedTools = tools.filter(tool => config?.perApp[tool.id] === profile.id);
        const status = results.some((r) => !r.ok) ? 'failed' : results.length === 3 ? 'healthy' : results.length ? 'partial' : 'untested';
        return <Card key={profile.id} className="space-y-4" data-testid={`proxy-profile-${profile.id}`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-alt text-primary"><Network size={18} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1 basis-40">
              <h3 className="break-words font-bold"><bdi>{profile.name}</bdi></h3>
              <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                <span>{t(`proxy:mode.${profile.mode}`)}</span>
                {testable && <bdi dir="ltr" className="break-all font-mono text-xs">{profile.host}:{profile.port}</bdi>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {config?.globalProfileId === profile.id && <Badge tone="primary">{t('proxy:defaultProfile')}</Badge>}
              {testable && <Badge tone={status === 'healthy' ? 'success' : status === 'failed' ? 'danger' : 'muted'}>{t(`proxy:${status}`)}</Badge>}
            </div>
            <div className="flex flex-wrap gap-1">
              {testable && <Button size="sm" disabled={busy !== null} loading={busy === `test:${profile.id}`} onClick={() => { setError(null); setTesting(profile); }}>{t('proxy:testAll')}</Button>}
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setEditing(profile)}>{t('common:edit')}</Button>
              <Button size="sm" variant="ghost" disabled={busy !== null} aria-label={t('proxy:deleteNamedProfile', { name: profile.name })} onClick={() => { setError(null); setDeleting(profile); }}><Trash2 size={16} aria-hidden="true" /></Button>
            </div>
          </div>
          {config && <Disclosure defaultOpen={profile.id === V2RAY.id} title={t('connectionsUx:assignTools')}><div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm text-muted">{t('connectionsUx:assignToolsHint')}</p>
            <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <legend className="sr-only">{t('connectionsUx:assignTools')}</legend>
              {tools.map((tool) => {
              const assigned = config.perApp[tool.id] === profile.id;
              return <label key={tool.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm">
                <input type="checkbox" checked={assigned} disabled={busy !== null || (!assigned && config.requireProxy && !testable)} onChange={(event) => { const value = event.target.checked ? profile.id : 'inherit'; void act(`assign:${tool.id}`, async () => { await saveToolProxy(tool.id, value); setMessage(t('connectionsUx:toolProxySaved')); }); }} />
                <AppLogo appId={tool.id} name={tool.name} size={24} /><bdi>{tool.name}</bdi>
              </label>;
            })}</fieldset>
            {config.requireProxy && !testable && <p className="text-sm text-muted">{t('connectionsUx:assignmentRequiresProxy')}</p>}
          </div></Disclosure>}
          {assignedTools.length > 0 && <div className="flex flex-wrap gap-2">{assignedTools.map(tool => <Badge key={tool.id} tone="primary"><bdi>{tool.name}</bdi></Badge>)}</div>}
          {results.length > 0 && <Disclosure title={t('ux:details')} defaultOpen={status !== 'healthy'}><div className="space-y-2 border-t border-border pt-3" aria-live="polite">{results.map((result) => <div key={result.level} className="flex items-start gap-2 text-sm">{result.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />}<span>{t(`proxy:${result.level}`)}: {t(result.ok ? 'connectionsUx:confirmed' : 'connectionsUx:notConfirmed')}</span></div>)}</div></Disclosure>}
        </Card>;
      })}</div>}
    </section>
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
