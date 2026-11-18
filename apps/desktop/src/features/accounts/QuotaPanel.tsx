import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Spinner } from '@/components/ui';
import { ipc, type AppQuota, type AppQuotaSnapshot, type QuotaAppId } from '@/services/ipc';

/**
 * Daily quota for the apps that publish one.
 *
 * The numbers are read from inside the running app, so the app has to be open
 * through VibeHub: the DevTools port it starts with is the only channel that
 * does not require handling a session file. Claiming is a separate, explicit
 * press — nothing is taken in the background.
 */

const APPS: QuotaAppId[] = ['qoder', 'minimax-code'];
const STALE_AFTER_SECONDS = 300;
const POLL_MS = 60_000;

export function QuotaPanel() {
  const { t, i18n } = useTranslation(['accounts', 'common', 'ux']);
  const [data, setData] = useState<AppQuotaSnapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const flight = useRef(false);

  const number = useCallback(
    (value: number | null) => (value === null ? t('quota.unknown') : new Intl.NumberFormat(i18n.language).format(value)),
    [i18n.language, t]
  );
  const date = useCallback(
    (value: number | null) => (value ? new Date(value * 1000).toLocaleString(i18n.language) : t('quota.unknown')),
    [i18n.language, t]
  );
  const singapore = useCallback(
    (value: number | null) =>
      value
        ? new Date(value * 1000).toLocaleString(i18n.language, { timeZone: 'Asia/Singapore' })
        : t('quota.unknown'),
    [i18n.language, t]
  );

  const act = useCallback(
    async (action: 'list' | 'refresh' | 'claim', appId?: QuotaAppId) => {
      if (flight.current) return;
      flight.current = true;
      setBusy(appId ?? 'all');
      try {
        const result = await ipc.appQuota(action, appId ? { appId } : {});
        setData(result);
        if (action === 'claim' && result.claim) {
          setNotice(
            result.claim.ok
              ? t('quota.claimDone', { amount: number(result.claim.points), unit: t('units.points') })
              : t(`quota.errors.${result.claim.error ?? 'claimFailed'}`, { defaultValue: t('quota.claimFailed') })
          );
        }
      } catch {
        setNotice(t('quota.errors.probeFailed'));
      } finally {
        flight.current = false;
        setBusy(null);
      }
    },
    [number, t]
  );

  useEffect(() => { void act('list'); }, [act]);

  // A slow poll keeps the numbers close to the truth without hammering the app.
  useEffect(() => {
    const timer = setInterval(() => {
      const live = data?.apps.find(item => item.status === 'ok');
      if (live) void act('refresh', live.appId);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [act, data]);

  const openThroughVibeHub = useCallback(
    async (appId: QuotaAppId) => {
      setBusy(appId);
      try {
        const result = await ipc.launchApp({ appId, rtl: true });
        if (!result.ok) {
          setNotice(t('quota.openFailed'));
          return;
        }
        // The app needs a moment to open its DevTools port.
        setTimeout(() => { void act('refresh', appId); }, 8000);
      } catch {
        setNotice(t('quota.openFailed'));
      } finally {
        setBusy(null);
      }
    },
    [act, t]
  );

  const statusTone = (status: AppQuota['status']) =>
    status === 'ok' ? 'success' : status === 'error' ? 'danger' : status === 'signedOut' ? 'warning' : 'muted';

  return <section className="space-y-4" aria-label={t('quota.title')} data-testid="quota-panel">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-lg font-bold">{t('quota.title')}</h2>
      {busy && <Spinner />}
      <div className="ms-auto flex flex-wrap gap-2">
        <Button disabled={!!busy} onClick={() => void act('refresh')}>{t('quota.refresh')}</Button>
      </div>
    </div>
    <p className="text-sm leading-7 text-muted">{t('quota.intro')}</p>
    {notice && <p role="status" className="text-sm text-warning">{notice}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      {APPS.map(appId => {
        const entry = data?.apps.find(item => item.appId === appId);
        const stale = !!entry?.checkedAt && Math.floor(Date.now() / 1000) - entry.checkedAt > STALE_AFTER_SECONDS;
        const claimable = entry?.status === 'ok' && entry.claim.available === true;
        const canOpen = entry?.status === 'appNotRunning' || entry?.status === 'notLaunchedByVibeHub';
        return <Card key={appId} className="space-y-4" as="section" data-testid={`quota-${appId}`}>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-bold" dir="ltr">{t(`quota.apps.${appId}`)}</h3>
            <Badge tone={statusTone(entry?.status ?? 'error')}>{t(`quota.status.${entry?.status ?? 'error'}`)}</Badge>
            {stale && <Badge tone="warning">{t('quota.stale')}</Badge>}
          </div>
          {entry && entry.status === 'ok' ? <>
            <p className="text-sm">
              {t('quota.remaining', { amount: number(entry.remaining), total: number(entry.total), unit: t(`units.${entry.unit}`, { defaultValue: entry.unit }) })}
            </p>
            {entry.percent !== null && <div className="h-2 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, entry.percent))}%` }} />
            </div>}
            {entry.plan && entry.plan.total ? <p className="text-xs text-muted">
              {t('quota.planLine', {
                amount: number(entry.plan.remaining),
                total: number(entry.plan.total),
                unit: t(`units.${entry.plan.unit ?? 'credits'}`, { defaultValue: entry.plan.unit ?? 'credits' }),
              })}
            </p> : null}
            <dl className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <dt className="text-sm">{t('quota.resets')}</dt>
                <dd className="mt-2 text-sm" dir="ltr">{singapore(entry.resetsAt)}</dd>
              </div>
              <div className="rounded-lg border border-border p-3">
                <dt className="text-sm">{t('quota.checked')}</dt>
                <dd className="mt-2 text-sm" dir="ltr">{date(entry.checkedAt)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted">{t(`ux:accountSummary.source.${appId}`)}</p>
          </> : <p role="status" className="text-sm text-warning">
            {t(`quota.errors.${entry?.error ?? entry?.status ?? 'probeFailed'}`, { defaultValue: t('quota.errors.probeFailed') })}
          </p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!busy} onClick={() => void act('refresh', appId)}>{t('quota.refresh')}</Button>
            <Button variant="primary" disabled={!!busy || !claimable} onClick={() => void act('claim', appId)}>
              {entry?.status === 'ok' && !claimable ? t('quota.noReward') : t('quota.claim')}
            </Button>
            {canOpen && <Button disabled={!!busy} onClick={() => void openThroughVibeHub(appId)}>{t('quota.openApp')}</Button>}
          </div>
          {entry?.status === 'error' && entry.claim.claimed === null && <p className="text-xs text-muted">{t('quota.claimHint')}</p>}
          {entry?.status === 'ok' && !claimable && <p className="text-xs text-muted">{t('quota.noRewardHint')}</p>}
        </Card>;
      })}
    </div>
  </section>;
}
