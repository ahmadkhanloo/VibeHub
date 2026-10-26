import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Gift, Play, ShieldCheck } from 'lucide-react';
import { appById } from '@/lib/catalog';
import { Badge, Button, Card, VerificationBadge } from '@/components/ui';
import { ipc, type InstallRunResult, type LaunchOutcome } from '@/services/ipc';
import type { DetectedApp } from '@core';
import { openUrl } from '@tauri-apps/plugin-opener';

export function AppDetailsPage() {
  const { appId = '' } = useParams();
  const { t, i18n } = useTranslation(['apps', 'common', 'install', 'errors']);
  const lang = i18n.language === 'fa' ? 'fa' : 'en';
  const app = appById(appId);
  const [detected, setDetected] = useState<DetectedApp | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void ipc.detectApps().then((all) => setDetected(all.find((d) => d.id === appId) ?? null)).catch(() => setDetected(null));
  }, [appId]);

  if (!app) return <p>{t('errors:notFound')}</p>;

  const iran = app.eligibility?.find((e) => e.countryCode === 'IR');
  const isCli = app.kind === 'cli_agent';
  const rtlDisabled = app.capabilities.rtl !== 'verified';

  const launch = async (rtl: boolean) => {
    setBusy(rtl ? 'rtl' : 'plain');
    setMessage(null);
    try {
      const out: LaunchOutcome = await ipc.launchApp({ appId, rtl });
      setMessage(out.detail);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(null);
    }
  };

  const runInstall = async (kind: 'winget' | 'npm') => {
    setBusy(kind);
    setMessage(null);
    try {
      const out: InstallRunResult =
        kind === 'winget' ? await ipc.installWinget(appId) : await ipc.installNpm(appId, 'opencode-ai');
      setMessage([out.ok ? t('install:installDone') : t('install:installFailed'), ...out.outputTail.slice(-3)].join('\n'));
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(null);
    }
  };

  const wingetId: Record<string, string> = { zcode: '', qoder: '', 'deepseek-harness': '', opencode: '', mimocode: '', freebuff: '' };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-border bg-surface-alt text-xl font-bold">
          {app.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">
            {app.name}
            {app.isOpenSource === true && <Badge tone="success">{app.licenseSpdx ?? 'OSS'}</Badge>}
            {app.isOpenSource === false && <Badge tone="warning">{t('apps:card.proprietary')}</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted">{app.summary[lang]}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <Badge tone="muted">{t('common:lastVerified')}: {app.lastVerified}</Badge>
            {detected?.installed && <Badge tone="success">{t('apps:installedVersion')}: {detected.version ?? '—'}</Badge>}
          </div>
        </div>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {detected?.installed ? (
            <>
              {!isCli && (
                <Button variant="primary" disabled={rtlDisabled} loading={busy === 'rtl'} onClick={() => void launch(true)} title={rtlDisabled ? t('errors:appNotDetected') : undefined}>
                  <Play size={14} /> {t('common:launchRtl')}
                </Button>
              )}
              <Button loading={busy === 'plain'} onClick={() => void launch(false)}>
                <Play size={14} /> {isCli ? t('common:openInTerminal') : t('common:launch')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={() => void openUrl(app.websiteUrl)}>
                <ExternalLink size={14} /> {t('apps:officialDownload')}
              </Button>
            </>
          )}
          <Link to={`/guides/${app.id}`}><Button><ShieldCheck size={14} /> {t('common:guide')}</Button></Link>
        </div>
        {rtlDisabled && !isCli && (
          <p className="text-xs text-muted">RTL: <VerificationBadge status={app.capabilities.rtl} /> — {t('apps:networkAccess.not_tested')}</p>
        )}
        {message && <pre className="ltr-tech max-h-32 overflow-auto whitespace-pre-wrap rounded-[10px] border border-border bg-surface-alt p-2 text-xs">{message}</pre>}
        {app.id === 'opencode' && busy === null && <p className="text-xs text-warning">{t('install:opencodeConflict')}</p>}
        {wingetId[app.id] === undefined ? null : null}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 font-semibold">{t('apps:sections.freeAccess')}</h3>
          <p className="text-sm text-muted">{app.freeAccessDetails[lang]}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>{app.requiresSignup === true ? t('apps:accountPolicy.review_terms') : app.requiresSignup === false ? 'No signup' : t('common:unknown')}</Badge>
            <Badge tone="muted">{t('common:source')}: {new URL(app.sourceOfFreeAccess).host}</Badge>
          </div>
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">{t('apps:sections.iran')}</h3>
          {iran ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted">Network:</span>
                <Badge tone={iran.networkAccess === 'direct_tested' ? 'success' : iran.networkAccess === 'proxy_may_be_needed' ? 'warning' : 'muted'}>
                  {t(`apps:networkAccess.${iran.networkAccess}`)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted">Account:</span>
                <Badge tone="muted">{t(`apps:accountPolicy.${iran.accountPolicy}`)}</Badge>
              </div>
              {iran.regionNotes && <p className="text-xs text-muted">{iran.regionNotes[lang]}</p>}
              {iran.confidence === 'low' && <Badge tone="warning">{t('apps:communityEvidence')}</Badge>}
              {iran.testedAt && <p className="text-[11px] text-muted">{iran.testedAt} · {iran.networkType ?? ''}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">{t(`apps:networkAccess.not_tested`)}</p>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">{t('apps:sections.capabilities')}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(Object.keys(app.capabilities) as (keyof typeof app.capabilities)[]).map((cap) => (
              <div key={cap} className="flex items-center justify-between gap-2">
                <span className="text-muted">{t(`apps:capabilities.${cap}`)}</span>
                <VerificationBadge status={app.capabilities[cap]} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">{t('apps:sections.overview')}</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">{t('apps:officialSite')}</span>
              <button className="text-primary hover:underline" onClick={() => void openUrl(app.websiteUrl)}>
                <span className="ltr-tech">{new URL(app.websiteUrl).host}</span>
              </button>
            </div>
            {app.sourceRepoUrl && (
              <div className="flex items-center justify-between">
                <span className="text-muted">GitHub</span>
                <button className="text-primary hover:underline" onClick={() => void openUrl(app.sourceRepoUrl!)}>
                  <span className="ltr-tech">{app.sourceRepoUrl.replace('https://github.com/', '')}</span>
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {app.referral && (
        <Card className="border-primary/30">
          <div className="flex items-start gap-3">
            <Gift size={18} className="mt-0.5 text-primary" />
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold">{t('apps:referralTitle')}</h3>
              <p className="text-sm text-muted">{lang === 'fa' ? app.referral.disclosureFa : app.referral.disclosureEn}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => void openUrl(app.referral!.url)}>{t('apps:referralUses')}</Button>
                <Button size="sm" onClick={() => void openUrl(app.websiteUrl)}>{t('apps:referralSkip')}</Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
