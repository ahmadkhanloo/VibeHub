import { Ellipsis, RefreshCw, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorNotice, Input, Modal, Spinner, Toggle } from '@/components/ui';
import { ipc, type AccountsAction, type AccountsSnapshot, type CodexAccount } from '@/services/ipc';

function SubscriptionTiming({ value }: { value: string }) {
  const { t, i18n } = useTranslation('accounts');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(+date)) return null;
  const today = new Date();
  const dayStart = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = (+date - dayStart) / 86_400_000;
  const localizedDate = date.toLocaleDateString(i18n.language, { timeZone: 'UTC', dateStyle: 'medium' });
  return <p className="text-sm text-muted">
    <time dateTime={value}>{t('subscriptionRecordedDate', { date: localizedDate })}</time>
    <span className="block">{days > 0
      ? t('subscriptionDaysLeft', { count: days, days: new Intl.NumberFormat(i18n.language).format(days) })
      : t(days === 0 ? 'subscriptionToday' : 'subscriptionPast')}</span>
  </p>;
}

export function AccountsPage({ embedded = false }: { embedded?: boolean }) {
  const { t, i18n } = useTranslation(['accounts', 'common', 'ux']);
  const [adding, setAdding] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [menuAccount, setMenuAccount] = useState<CodexAccount | null>(null);
  const [batch, setBatch] = useState(false);
  const [checkingId, setCheckingId] = useState<string>();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [data, setData] = useState<AccountsSnapshot | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(''), [threshold, setThreshold] = useState(1);
  const [dialog, setDialog] = useState<{ kind: 'rename' | 'delete' | 'switch' | 'subscription'; account: CodexAccount } | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [rename, setRename] = useState('');
  const [subscription, setSubscription] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const notice = data?.notice;
  const noticeAt = data?.noticeAt;
  const transientNotice = notice === 'switched' || notice === 'externalChanged';
  useEffect(() => {
    if (!transientNotice || !noticeAt) return;
    const remaining = Math.min(6000, 6000 - (Date.now() - noticeAt * 1000));
    if (remaining <= 0) return;
    setToast(notice);
    const timeout = setTimeout(() => setToast(null), remaining);
    return () => { clearTimeout(timeout); setToast(null); };
  }, [notice, noticeAt, transientNotice]);
  const flight = useRef(false);
  const translatedError = useCallback((cause: unknown) => {
    const key = String(cause).match(/accounts:([a-zA-Z]+)/)?.[1] ?? 'requestFailed';
    return t(`errors.${key}`, { defaultValue: t('errors.requestFailed') });
  }, [t]);
  const act = useCallback(async (action: AccountsAction, payload: Record<string, unknown> = {}, quiet = false) => {
    if (flight.current) return;
    flight.current = true;
    if (!quiet) { setBusy(true); setError(null); }
    // Restarting the original app can take a while; say what is happening instead of
    // leaving the user with a silent spinner and a window that will not close.
    const restart = action === 'switch' && payload.confirmRestart === true;
    if (restart) setRestarting(true);
    try {
      setData(await ipc.codexAccounts(action, { ...payload, language: i18n.language.startsWith('fa') ? 'fa' : 'en' }));
      return true;
    }
    catch (cause) { if (!quiet) setError(translatedError(cause)); return false; }
    finally { flight.current = false; if (!quiet) setBusy(false); if (restart) setRestarting(false); }
  }, [translatedError, i18n.language]);
  useEffect(() => { void act('list'); }, [act]);
  useEffect(() => { void ipc.appVersion().then(setAppVersion).catch(() => setAppVersion(null)); }, []);
  useEffect(() => { if (data?.loginPending) setAdding(false); }, [data?.loginPending]);
  useEffect(() => { if (data) setThreshold(data.settings.threshold); }, [data?.settings.threshold]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void act('list', {}, true); };
    const timer = setInterval(refresh, data?.loginPending ? 2000 : 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [act, data?.loginPending]);
  const refreshAll = async () => {
    if (!data?.quotaBatchReady || data.loginPending || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(null);
    const accounts = data.accounts;
    setBatch(true);
    try {
      for (const account of accounts) {
        if (!mounted.current) break;
        if ((account.errorCode || account.error) === 'loginRequired') continue;
        setCheckingId(account.id);
        let code = '';
        try {
          const next = await ipc.codexAccounts('refreshQuota', { id: account.id, language: i18n.language.startsWith('fa') ? 'fa' : 'en' });
          if (!mounted.current) break;
          setData(next);
          code = next.quotaBatchCode ?? '';
        } catch (cause) {
          code = String(cause).match(/accounts:([a-zA-Z]+)/)?.[1] ?? 'requestFailed';
        }
        if (!mounted.current) break;
        setCheckingId(undefined);
        const stopped = !!code && !['loginRequired', 'quotaAuthRejected', 'quotaBatchSkipped'].includes(code);
        if (stopped) {
          setError(translatedError('accounts:' + code));
          break;
        }
        if (account !== accounts.at(-1) && code !== 'quotaBatchSkipped') await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      flight.current = false;
      if (mounted.current) { setBusy(false); setBatch(false); setCheckingId(undefined); }
    }
  };
  const date = (value: number | null) => value ? new Date(value * 1000).toLocaleString(i18n.language) : t('unknown');
  const pending = data?.accounts.find(a => a.id === data.pendingId);
  // A CLI that exists but is below the floor is reported as missing by the backend;
  // keep the detected version visible so the user can see why switching is refused.
  const cliBehind = !!data && !data.cliReady && !!data.cliVersion;
  const cliState = !data ? null : data.cliReady
    ? t('cliVersion', { version: data.cliVersion ?? data.supportedVersion, supported: data.supportedVersion })
    : cliBehind
      ? t('cliOutdated', { version: data.cliVersion, supported: data.supportedVersion })
      : t('cliMissing', { version: data.supportedVersion });
  const pendingLogin = data?.loginPending && <div role="status" className="flex flex-wrap items-center gap-3 text-sm">{t('loginPending')}<Button disabled={busy} onClick={() => void act('cancel')}>{t('cancelLogin')}</Button></div>;
  const submitDialog = async () => {
    if (!dialog) return;
    const { kind, account } = dialog;
    if (kind === 'subscription') {
      if (await act('subscriptionDate', { id: account.id, date: subscription || null })) setDialog(null);
      return;
    }
    await act(kind, kind === 'rename' ? { id: account.id, name: rename } : { id: account.id, confirmRestart: kind === 'switch' });
    setDialog(null);
  };
  return <div className="space-y-6">
    <div className="vh-accounts-toolbar flex flex-wrap items-center gap-3">{!embedded && <h1>{t('title')}</h1>}
      <div className="flex flex-wrap items-center gap-2" data-testid="accounts-versions">
        <Badge>{t('common:version')}: <bdi>{appVersion ?? '—'}</bdi></Badge>
        {!data?.nativePreview && <Badge tone={!data ? 'muted' : data.cliReady ? 'primary' : cliBehind ? 'warning' : 'muted'}>
          <bdi dir="ltr">Codex CLI</bdi>{data?.cliReady ? <>: <bdi>{data.cliVersion ?? data.supportedVersion}</bdi></> : cliBehind ? <>: <bdi>{data.cliVersion}</bdi></> : null}
        </Badge>}
      </div>
      <div className="ms-auto flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void act('list')}>{t('reload')}</Button>
        {data && !data.nativePreview && <>
          <Button loading={batch} disabled={busy || !data.quotaBatchReady || !data.accounts.length || !!data.loginPending} onClick={() => void refreshAll()}><RefreshCw size={16} aria-hidden="true" />{t('refreshAll')}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => { setAutomationEnabled(data.settings.enabled); setThreshold(data.settings.threshold); setAutomationOpen(true); }}><Settings2 size={16} aria-hidden="true" />{t('automationSettings')}</Button>
        </>}
        <Button variant="primary" disabled={busy || !data || data.nativePreview} onClick={() => setAdding(true)}>{t('add')}</Button>
      </div></div>
    {restarting && <div role="status" className="flex items-center gap-3 text-sm"><Spinner />{t('switching')}</div>}
    {toast && <div className="vh-account-toast" role="status">{t(`notices.${toast}`)}</div>}
    {error && !adding && dialog?.kind !== 'subscription' && <ErrorNotice error={error} message={error} />}
    {!data ? <p role="status">{t('loading')}</p> : data.nativePreview ? <Card className="space-y-3"><h2 className="font-bold">{t('browserAccountsTitle')}</h2><p role="status" className="text-sm leading-7">{t('browserAccountsHint')}</p><code dir="ltr" className="block">pnpm dev:desktop</code></Card> : <>
      {!data.cliReady && <Card className="space-y-3"><p role="status">{cliState}</p><Link className="vh-link" to="/guides/chatgpt">{t('setup')}</Link></Card>}
      {((notice && !transientNotice && !pending) || (!adding && data.loginPending)) && <div className="space-y-2">
        {notice && !transientNotice && !pending && <>
          <p role="status" className="text-sm leading-7">{t(`notices.${data.notice}`, { defaultValue: t(`errors.${data.notice}`, { defaultValue: t('errors.requestFailed') }) })}</p>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act('dismiss')}>{t('dismiss')}</Button>
        </>}
        {!adding && pendingLogin}
      </div>}
      {adding && <Modal open title={t('add')} onClose={() => setAdding(false)} busy={busy}><div className="space-y-4">{error && <ErrorNotice error={error} message={error} />}<label className="block space-y-2 text-sm"><span>{t('accountName')}</span><Input value={name} maxLength={120} dir="auto" onChange={e => setName(e.target.value)} /></label>
        {pendingLogin}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={busy || !data.cliReady || data.loginPending} onClick={() => void act('login', { name })}>{t('signIn')}</Button>
          <Button disabled={busy || !data.cliReady || data.loginPending} onClick={() => void act('import', { name })}>{t('import')}</Button>
          <Button disabled={busy || data.loginPending} onClick={() => void act('importJson', { name })}>{t('importJson')}</Button>
        </div>
        <p className="text-xs leading-6 text-muted">{t('jsonHint')}</p>
      </div></Modal>}
      <Modal open={automationOpen} title={t('automationSettings')} onClose={() => setAutomationOpen(false)} busy={busy}>
        <Toggle label={t('enableAutomation')} checked={automationEnabled} disabled={busy || !data.cliReady} onChange={setAutomationEnabled} />
        <label className="block max-w-xs space-y-2 text-sm"><span>{t('threshold')}</span><Input type="number" min={0} max={90} value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></label>
        <Button variant="primary" disabled={busy || !data.cliReady || !Number.isInteger(threshold) || threshold < 0 || threshold > 90} onClick={async () => {
          if (await act('settings', { enabled: automationEnabled, threshold })) setAutomationOpen(false);
        }}>{t('save')}</Button>
        <p className="text-sm leading-7 text-muted">{t('automationHint')}</p>
      </Modal>
      <section className="space-y-4" aria-label={t('saved')}>
        <h2 className="text-lg font-bold">{t('saved')}</h2>
        {!data.accounts.length && <EmptyState title={t('empty')} sub={t('emptyHint')} />}
        {data.cliReady && !data.quotaBatchReady && <p className="text-sm text-muted">{t('batchUnavailable')}</p>}
        <div className="vh-account-grid">{data.accounts.map(account => <Card key={account.id} className="vh-account-card space-y-3" as="section" data-active={account.id === data.activeId || undefined} data-testid={`account-${account.id}`}>
          <div className="flex items-center gap-2">
            <span className="vh-account-avatar" aria-hidden="true">{account.name.trim().slice(0, 1).toLocaleUpperCase()}</span>
            <h3 className="min-w-0 flex-1 break-words text-base font-bold"><bdi>{account.name}</bdi></h3>
            <Button size="sm" variant="ghost" disabled={busy} aria-label={t('accountActions', { name: account.name })} aria-haspopup="dialog" onClick={() => setMenuAccount(account)}><Ellipsis size={17} aria-hidden="true" /></Button>
          </div>
          {(account.id === data.activeId || account.plan) && <div className="flex flex-wrap gap-1">
            {account.id === data.activeId && <Badge tone="primary">{t('active')}</Badge>}
            {account.plan && <Badge><bdi>{account.plan}</bdi></Badge>}
          </div>}
          {/* Identity and freshness share one quiet line; the card's story is its status. */}
          <p className="vh-account-meta">
            <bdi dir="auto">{account.email}</bdi>
            <span aria-hidden="true"> · </span>
            <span>{t('checked', { date: date(account.checkedAt) })}</span>
          </p>
          {account.subscriptionDate && <SubscriptionTiming value={account.subscriptionDate} />}
          {checkingId === account.id && <p role="status" className="text-xs text-muted">{t('batchChecking')}</p>}
          {(account.errorCode || account.error) && <div className="flex flex-wrap items-center gap-2">
            <p role="status" className="text-sm text-danger">{t(`errors.${account.errorCode || account.error}`, { defaultValue: t('errors.readFailed') })}</p>
            {(account.errorCode || account.error) === 'loginRequired' &&
              <Button variant="primary" disabled={busy || !data.cliReady || data.loginPending} onClick={() => void act('login', { id: account.id })}>{t('ux:accountSummary.reauthAction')}</Button>}
          </div>}
          {account.id === pending?.id && data.notice && <div className="flex flex-wrap items-center gap-2">
            <p role="status" className="text-sm text-warning">{t(`notices.${data.notice}`, { defaultValue: t('errors.requestFailed') })}</p>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => setDialog({ kind: 'switch', account })}>{t('restartAndSwitch')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act('dismiss')}>{t('common:cancel')}</Button>
          </div>}
          {account.recoveredLogin && <p role="status" className="text-sm text-muted">{t('applyRecoveredLogin')}</p>}
          {account.quotaErrorCode && <p role="status" className="text-sm text-warning">
            {t(account.quotaErrorCode === 'balanceUnavailable' ? 'errors.balanceUnavailable' : 'errors.quotaReadFailed')}
            {['rateLimited', 'accessDenied', 'network', 'timeout', 'quotaAuthRejected'].includes(account.quotaErrorCode) && <> {t(`errors.${account.quotaErrorCode}`)}</>}
          </p>}
          {!account.windows.length && <p className="text-sm text-muted">{t('quotaUnknown')}</p>}
          {!!account.windows.length && <dl className="vh-account-quotas">{account.windows.map(window => <div key={`${window.bucket}-${window.name}`} className="vh-account-quota">
            <dt className="text-sm"><bdi>{window.bucket}</bdi> · {window.minutes === 300 ? t('fiveHour') : window.minutes === 10080 ? t('weekly') : window.minutes ? t('window', { minutes: window.minutes }) : t('unknown')}</dt>
            <dd className="mt-2 font-bold">{window.remaining === null ? t('unknown') : t('remaining', { percent: Math.round(window.remaining) })}</dd>
            {window.remaining !== null && <dd><progress className="vh-quota-progress" max={100} value={Math.max(0, Math.min(100, window.remaining))} aria-label={t('remaining', { percent: Math.round(window.remaining) })} /></dd>}
            <dd className="mt-1 text-xs text-muted">{t('resets', { date: date(window.resetsAt) })}</dd>
          </div>)}</dl>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || !data.cliReady} onClick={() => void act('refresh', { id: account.id })}>{t('refresh')}</Button>
            {account.id !== pending?.id && <Button variant="primary" disabled={busy || !data.cliReady} onClick={() => void act('switch', { id: account.id })}>{t(account.id === data.activeId ? 'applyAccount' : 'switch')}</Button>}
          </div>
        </Card>)}</div>
      </section>
    </>}
    <Modal open={!!menuAccount} title={t('accountActions', { name: menuAccount?.name })} onClose={() => setMenuAccount(null)}>
      {menuAccount && <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setRename(menuAccount.name); setDialog({ kind: 'rename', account: menuAccount }); setMenuAccount(null); }}>{t('rename')}</Button>
        <Button onClick={() => { setError(null); setSubscription(menuAccount.subscriptionDate ?? ''); setDialog({ kind: 'subscription', account: menuAccount }); setMenuAccount(null); }}>{t('subscriptionTitle')}</Button>
        <Button variant="danger" onClick={() => { setDialog({ kind: 'delete', account: menuAccount }); setMenuAccount(null); }}>{t('delete')}</Button>
      </div>}
    </Modal>
    <Modal open={dialog?.kind === 'subscription'} title={t('subscriptionTitle')} onClose={() => { setDialog(null); setError(null); }} busy={busy}>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void submitDialog(); }}>
        {error && <ErrorNotice error={error} message={error} />}
        <p className="text-sm text-muted">{t('subscriptionHint')}</p>
        <label className="block space-y-2 text-sm"><span>{t('subscriptionField')}</span>
          <Input type="date" dir="ltr" min="0001-01-01" max="9999-12-31" value={subscription} onChange={event => setSubscription(event.target.value)} />
        </label>
        <div className="flex gap-2"><Button variant="primary" type="submit" loading={busy}>{t('common:save')}</Button>
          <Button disabled={busy} onClick={() => { setDialog(null); setError(null); }}>{t('common:cancel')}</Button></div>
      </form>
    </Modal>
    <Modal open={!!dialog && dialog.kind !== 'subscription'} title={t(dialog?.kind === 'switch' ? 'restartAndSwitch' : dialog?.kind ?? 'rename')} onClose={() => setDialog(null)} busy={busy}>
      {dialog?.kind === 'rename' ? <label className="block space-y-2"><span>{t('accountName')}</span><Input value={rename} maxLength={120} onChange={e => setRename(e.target.value)} /></label> : <p className="text-sm leading-7">{t(dialog?.kind === 'switch' ? 'restartConfirm' : 'deleteConfirm')}</p>}
      <div className="mt-5 flex gap-2"><Button variant="primary" disabled={busy || (dialog?.kind === 'rename' && !rename.trim())} onClick={() => void submitDialog()}>{t('confirm')}</Button><Button disabled={busy} onClick={() => setDialog(null)}>{t('common:cancel')}</Button></div>
    </Modal>
  </div>;
}
