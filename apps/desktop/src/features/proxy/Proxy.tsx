import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Plus, Trash2, XCircle } from 'lucide-react';
import { Badge, Button, Card, Input, SectionTitle, Select, Toggle } from '@/components/ui';
import { ipc } from '@/services/ipc';
import type { ProxyProfile, ProxyTestResult } from '@core';
import { apps } from '@/lib/catalog';

type Level = 'tcp' | 'handshake' | 'request';

export function ProxyPage() {
  const { t } = useTranslation(['proxy', 'common']);
  const [profiles, setProfiles] = useState<ProxyProfile[]>([]);
  const [config, setConfig] = useState<{ globalProfileId: string; requireProxy: boolean; perApp: Record<string, string> } | null>(null);
  const [editing, setEditing] = useState<ProxyProfile | null>(null);
  const [password, setPassword] = useState('');
  const [tests, setTests] = useState<Record<string, ProxyTestResult[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      setProfiles(await ipc.proxyProfiles());
      setConfig(await ipc.proxyConfig());
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => void reload(), []);

  const activeProfile = profiles.find((p) => p.id === config?.globalProfileId) ?? profiles[0];

  const runTests = async (profile: ProxyProfile) => {
    setBusy(profile.id);
    const results: ProxyTestResult[] = [];
    try {
      for (const level of ['tcp', 'handshake', 'request'] as Level[]) {
        results.push(await ipc.proxyTest(profile, level));
        setTests((t2) => ({ ...t2, [profile.id]: [...results] }));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!editing) return;
    setBusy('save');
    try {
      setProfiles(await ipc.proxySave(editing, password || undefined));
      setPassword('');
      setEditing(null);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t('proxy:title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t('proxy:subtitle')}</p>
      </div>

      {error && <Card className="border-danger/40"><p className="text-sm text-danger ltr-tech">{error}</p></Card>}

      <Card>
        <SectionTitle
          action={
            <Button size="sm" onClick={() => setEditing({ id: `p-${Date.now()}`, name: 'v2rayN', mode: 'http', host: '127.0.0.1', port: 10808 })}>
              <Plus size={13} /> {t('proxy:newProfile')}
            </Button>
          }
        >
          {t('proxy:profiles')}
        </SectionTitle>
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border p-3">
              <Badge tone={config?.globalProfileId === p.id ? 'primary' : 'neutral'}>{p.name}</Badge>
              <Badge tone="muted">{t(`proxy:mode.${p.mode}`)}</Badge>
              {(p.mode === 'http' || p.mode === 'socks5') && (
                <span className="ltr-tech text-xs text-muted">{p.host}:{p.port}</span>
              )}
              {p.hasPassword && <Badge tone="muted">🔑 vault</Badge>}
              <div className="flex-1" />
              <Select
                value={config?.perApp['*'] ?? config?.globalProfileId ?? p.id}
                onChange={async (v) => {
                  await ipc.proxySetConfig({ globalProfileId: v, requireProxy: config?.requireProxy ?? false, perApp: config?.perApp ?? {} });
                  await reload();
                }}
                options={profiles.map((pp) => ({ value: pp.id, label: pp.name }))}
              />
              <Button size="sm" loading={busy === p.id} onClick={() => void runTests(p)}>{t('proxy:testAll')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>{t('common:edit')}</Button>
              <Button size="sm" variant="ghost" onClick={async () => { await ipc.proxyDelete(p.id); await reload(); }}>
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
        </div>
        {(tests[activeProfile?.id ?? ''] ?? []).map((r) => (
          <div key={r.level} className="mt-2 flex items-center gap-2 text-sm">
            {r.ok ? <CheckCircle2 size={15} className="text-success" /> : <XCircle size={15} className="text-danger" />}
            <span className="text-muted">{t(`proxy:${r.level === 'tcp' ? 'tcp' : r.level === 'handshake' ? 'handshake' : 'request'}`)}</span>
            <span className="ltr-tech text-xs text-muted">{r.detail}</span>
          </div>
        ))}
      </Card>

      {editing && (
        <Card className="space-y-3">
          <SectionTitle>{t('proxy:newProfile')}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm"><span className="text-muted">{t('common:details')}</span>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label className="space-y-1 text-sm"><span className="text-muted">Mode</span>
              <Select value={editing.mode} onChange={(v) => setEditing({ ...editing, mode: v })} options={[
                { value: 'direct', label: t('proxy:mode.direct') },
                { value: 'system', label: t('proxy:mode.system') },
                { value: 'http', label: t('proxy:mode.http') },
                { value: 'socks5', label: t('proxy:mode.socks5') },
              ]} /></label>
            <label className="space-y-1 text-sm"><span className="text-muted">{t('proxy:host')}</span>
              <Input value={editing.host ?? ''} onChange={(e) => setEditing({ ...editing, host: e.target.value })} disabled={editing.mode === 'direct' || editing.mode === 'system'} /></label>
            <label className="space-y-1 text-sm"><span className="text-muted">{t('proxy:port')}</span>
              <Input type="number" value={editing.port ?? 10808} onChange={(e) => setEditing({ ...editing, port: Number(e.target.value) })} disabled={editing.mode === 'direct' || editing.mode === 'system'} /></label>
            <label className="space-y-1 text-sm"><span className="text-muted">{t('proxy:username')}</span>
              <Input value={editing.username ?? ''} onChange={(e) => setEditing({ ...editing, username: e.target.value })} /></label>
            <label className="space-y-1 text-sm"><span className="text-muted">{t('proxy:password')}</span>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          </div>
          <p className="text-xs text-muted">{t('proxy:passwordStoredVault')}</p>
          <div className="flex gap-2">
            <Button variant="primary" loading={busy === 'save'} onClick={() => void save()}>{t('common:save')}</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>{t('common:cancel')}</Button>
          </div>
        </Card>
      )}

      {config && (
        <Card className="space-y-4">
          <SectionTitle>{t('proxy:globalProfile')} / {t('proxy:perApp')}</SectionTitle>
          <Toggle
            checked={config.requireProxy}
            onChange={async (v) => {
              await ipc.proxySetConfig({ ...config, requireProxy: v });
              await reload();
            }}
            label={t('proxy:requireProxy')}
          />
          <p className="text-xs text-muted">{t('proxy:requireProxyHint')}</p>
          <div className="space-y-2">
            {apps.map((app) => (
              <div key={app.id} className="flex items-center gap-3 text-sm">
                <span className="w-32 truncate">{app.name}</span>
                <Select
                  value={config.perApp[app.id] ?? 'inherit'}
                  onChange={async (v) => {
                    const perApp = { ...config.perApp, [app.id]: v };
                    await ipc.proxySetConfig({ ...config, perApp });
                    await reload();
                  }}
                  options={[{ value: 'inherit', label: t('proxy:inherit') }, ...profiles.map((p) => ({ value: p.id, label: p.name }))]}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <p className="text-xs text-muted">{t('proxy:scopeNote')}</p>
        <p className="mt-1 text-xs text-warning">{t('proxy:termsNote')}</p>
      </Card>
    </div>
  );
}
