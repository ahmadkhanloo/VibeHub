import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Play, RefreshCw } from 'lucide-react';
import { apps } from '@/lib/catalog';
import { Badge, Button, Card, EmptyState, SectionTitle, VerificationBadge } from '@/components/ui';
import { ipc, type LaunchOutcome } from '@/services/ipc';
import type { DetectedApp } from '@core';

export function MyAppsPage() {
  const { t, i18n } = useTranslation(['common', 'apps', 'errors']);
  const lang = i18n.language === 'fa' ? 'fa' : 'en';
  const [detected, setDetected] = useState<DetectedApp[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const refresh = () => void ipc.detectApps().then(setDetected).catch(() => setDetected([]));
  useEffect(refresh, []);

  const installed = (detected ?? []).filter((d) => d.installed);

  const launch = async (appId: string, rtl: boolean) => {
    const key = `${appId}:${rtl}`;
    setBusy(key);
    try {
      const out: LaunchOutcome = await ipc.launchApp({ appId, rtl });
      setMessages((m) => ({ ...m, [appId]: out.detail }));
    } catch (e) {
      setMessages((m) => ({ ...m, [appId]: String(e) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('nav:myApps', { ns: 'nav' })}</h1>
        <Button size="sm" onClick={refresh}><RefreshCw size={13} /> {t('common:retry')}</Button>
      </div>

      {detected === null ? (
        <p className="text-sm text-muted">{t('common:loading')}</p>
      ) : installed.length === 0 ? (
        <EmptyState
          title={t('errors:appNotDetected')}
          sub={t('home:quickLaunchEmpty', { ns: 'home' })}
        />
      ) : (
        <div className="space-y-3">
          {installed.map((d) => {
            const app = apps.find((a) => a.id === d.id);
            const rtlOk = app?.capabilities.rtl === 'verified';
            const isCli = app?.kind === 'cli_agent';
            return (
              <Card key={d.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-surface-alt font-bold">{(app?.name ?? d.id).slice(0, 1)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <Link to={`/app/${d.id}`} className="hover:underline">{app?.name ?? d.id}</Link>
                      {d.version && <Badge tone="muted">{d.version}</Badge>}
                    </div>
                    <p className="ltr-tech truncate text-[11px] text-muted" title={d.path}>{d.path}</p>
                    <p className="text-[11px] text-muted">{t('apps:detectedVia')}: {d.via}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isCli && (
                      <Button size="sm" variant="primary" disabled={!rtlOk} loading={busy === `${d.id}:true`} onClick={() => void launch(d.id, true)}>
                        <Play size={13} /> {t('common:launchRtl')}
                      </Button>
                    )}
                    <Button size="sm" loading={busy === `${d.id}:false`} onClick={() => void launch(d.id, false)}>
                      <Play size={13} /> {isCli ? t('common:openInTerminal') : t('common:launch')}
                    </Button>
                  </div>
                </div>
                {!rtlOk && !isCli && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                    RTL: <VerificationBadge status={app?.capabilities.rtl ?? 'unknown'} />
                  </p>
                )}
                {messages[d.id] && (
                  <pre className="ltr-tech mt-2 whitespace-pre-wrap rounded-[10px] border border-border bg-surface-alt p-2 text-xs">{messages[d.id]}</pre>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <SectionTitle>{t('common:unknown')}</SectionTitle>
        <p className="text-sm text-muted">
          {(detected ?? []).filter((d) => !d.installed).map((d) => d.id).join(', ') || '—'}
        </p>
      </Card>
    </div>
  );
}
