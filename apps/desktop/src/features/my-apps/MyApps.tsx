import { Tooltip } from '@/components/Tooltip';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ExternalLink, Play, RefreshCw } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { apps } from '@/lib/catalog';
import { AppLogo } from '@/components/AppLogo';
import { Badge, Button, Card, EmptyState, SectionTitle, VerificationBadge } from '@/components/ui';
import { ipc, type DetectedEditor, type LaunchOutcome, type RtlComponentStatus } from '@/services/ipc';
import type { DetectedApp } from '@core';

export function MyAppsPage() {
  const { t } = useTranslation(['common', 'apps', 'errors', 'home']);
  const [detected, setDetected] = useState<DetectedApp[] | null>(null);
  const [editors, setEditors] = useState<DetectedEditor[] | null>(null);
  const [rtlComponents, setRtlComponents] = useState<RtlComponentStatus[] | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const refresh = () => {
    setDetected(null);
    setDetectionError(null);
    setRtlComponents(null);
    void ipc.detectApps().then(setDetected).catch((e) => {
      setDetected([]);
      setDetectionError(String(e));
    });
    void ipc.detectEditors().then(setEditors).catch(() => setEditors([]));
    void ipc.rtlComponents().then(setRtlComponents).catch(() => setRtlComponents([]));
  };
  useEffect(refresh, []);

  const rtlIds = new Set(['zcode', 'qoder', 'deepseek-harness']);
  const rtlApps = apps.filter((app) => rtlIds.has(app.id));
  const installed = (detected ?? []).filter((d) => d.installed);
  const otherInstalled = installed.filter((d) => !rtlIds.has(d.id));

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

  const launchEditor = async (editorId: string) => {
    const key = `editor:${editorId}`;
    setBusy(key);
    try {
      const out = await ipc.launchEditor(editorId);
      setMessages((m) => ({ ...m, [key]: out.detail }));
    } catch (e) {
      setMessages((m) => ({ ...m, [key]: String(e) }));
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

      <section className="space-y-3">
        <div>
          <SectionTitle>{t('apps:rtlHub')}</SectionTitle>
          <Tooltip text={t('apps:rtlHubNote')} />
        </div>
        {detected === null || rtlComponents === null ? (
          <p className="text-sm text-muted">{t('common:loading')}</p>
        ) : detectionError ? (
          <EmptyState title={t('errors:detectionFailed')} sub={detectionError} />
        ) : (
          <div className="space-y-3">
            {rtlApps.map((app) => {
              const target = detected.find((item) => item.id === app.id);
              const available = rtlComponents.find((item) => item.id === app.id)?.available === true;
              return (
                <Card key={app.id}>
                  <div className="flex flex-wrap items-center gap-3">
                    <AppLogo appId={app.id} name={app.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 font-semibold">
                        <Link to={`/app/${app.id}`} className="hover:underline">{app.name}</Link>
                        {target?.version && <Badge tone="muted">{target.version}</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge tone={available ? 'success' : 'warning'}>
                          {available ? t('apps:rtlReady') : t('apps:rtlMissing')}
                        </Badge>
                        <Badge tone={target?.installed ? 'muted' : 'warning'}>
                          {target?.installed ? t('apps:installed') : t('apps:hostMissing')}
                        </Badge>
                      </div>
                    </div>
                    {target?.installed ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="primary" disabled={!available} loading={busy === `${app.id}:true`} onClick={() => void launch(app.id, true)}>
                          <Play size={13} /> {t('common:launchRtl')}
                        </Button>
                        <Button size="sm" loading={busy === `${app.id}:false`} onClick={() => void launch(app.id, false)}>
                          <Play size={13} /> {t('common:launch')}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="primary" disabled={!available} loading={busy === `${app.id}:true`} onClick={() => void launch(app.id, true)}>
                          <Play size={13} /> {t('common:launchRtl')}
                        </Button>
                        <Button size="sm" onClick={() => void openUrl(app.websiteUrl)}>
                          <ExternalLink size={13} /> {t('apps:officialDownload')}
                        </Button>
                      </div>
                    )}
                  </div>
                  {messages[app.id] && (
                    <pre className="ltr-tech mt-2 whitespace-pre-wrap rounded-[10px] border border-border bg-surface-alt p-2 text-xs">{messages[app.id]}</pre>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {detected === null ? (
        <p className="text-sm text-muted">{t('common:loading')}</p>
      ) : detectionError ? (
        <EmptyState
          title={t('errors:detectionFailed')}
          sub={detectionError}
        />
      ) : otherInstalled.length === 0 ? null : (
        <div className="space-y-3">
          {otherInstalled.map((d) => {
            const app = apps.find((a) => a.id === d.id);
            const rtlOk = app?.capabilities.rtl === 'verified';
            const isCli = app?.kind === 'cli_agent';
            return (
              <Card key={d.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <AppLogo appId={d.id} name={app?.name ?? d.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <Link to={`/app/${d.id}`} className="hover:underline">{app?.name ?? d.id}</Link>
                      {d.version && <Badge tone="muted">{d.version}</Badge>}
                    </div>
                    <details className="mt-1 text-[11px] text-muted">
                      <summary className="w-fit cursor-pointer">{t('common:details')}</summary>
                      <p className="ltr-tech mt-1 break-all" title={d.path}>{d.path}</p>
                      <p>{t('apps:detectedVia')}: {d.via === 'registry' ? t('apps:detectionMethods.registry') : d.via === 'standard-path' || d.via === 'standard-path-or-PATH' ? t('apps:detectionMethods.standardPath') : d.via}</p>
                    </details>
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
                    {t('common:rtl')}: <VerificationBadge status={app?.capabilities.rtl ?? 'unknown'} />
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

      {editors && editors.length > 0 && (
        <Card>
          <SectionTitle>{t('apps:otherEditors')}</SectionTitle>
          <Tooltip text={t('apps:otherEditorsNote')} />
          <div className="space-y-2">
            {editors.map((editor) => (
              <div key={editor.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-surface-alt px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      <span>{editor.name}</span>
                      {editor.version && <Badge tone="muted">{editor.version}</Badge>}
                    </div>
                    <details className="mt-1 text-[11px] text-muted">
                      <summary className="w-fit cursor-pointer">{t('common:details')}</summary>
                      <p className="ltr-tech mt-1 break-all" title={editor.path}>{editor.path}</p>
                    </details>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="success">{t('apps:detected')}</Badge>
                    <Button size="sm" variant="primary" loading={busy === `editor:${editor.id}`} onClick={() => void launchEditor(editor.id)}>
                      <Play size={13} /> {t('common:open')}
                    </Button>
                  </div>
                </div>
              {messages[`editor:${editor.id}`] && (
                <pre className="ltr-tech whitespace-pre-wrap rounded-[10px] border border-border bg-surface-alt p-2 text-xs">{messages[`editor:${editor.id}`]}</pre>
              )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
