import { Disclosure } from '@/components/Disclosure';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorNotice, Input, Modal, PageHeader, Toggle, Select } from '@/components/ui';
import { ipc, type AccountsAction, type AccountsSnapshot, type CodexAccount } from '@/services/ipc';

export function AccountsPage({ embedded = false }: { embedded?: boolean }) {
  const { t, i18n } = useTranslation(['accounts', 'common']);
  const [adding, setAdding] = useState(false);

  const [data, setData] = useState<AccountsSnapshot | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(''), [threshold, setThreshold] = useState(1);
  const [dialog, setDialog] = useState<{ kind: 'rename' | 'delete' | 'switch'; account: CodexAccount } | null>(null);
  const [rename, setRename] = useState('');
  const flight = useRef(false);
  const translatedError = useCallback((cause: unknown) => {
    const key = String(cause).match(/accounts:([a-zA-Z]+)/)?.[1] ?? 'requestFailed';
    return t(`errors.${key}`, { defaultValue: t('errors.requestFailed') });
  }, [t]);
  const act = useCallback(async (action: AccountsAction, payload: Record<string, unknown> = {}, quiet = false) => {
    if (flight.current) return;
    flight.current = true;
    if (!quiet) { setBusy(true); setError(null); }
    try { setData(await ipc.codexAccounts(action, { ...payload, language: i18n.language.startsWith('fa') ? 'fa' : 'en' })); }
    catch (cause) { if (!quiet) setError(translatedError(cause)); }
    finally { flight.current = false; if (!quiet) setBusy(false); }
  }, [translatedError, i18n.language]);
  useEffect(() => { void act('list'); }, [act]);
  useEffect(() => { if (data?.loginPending) setAdding(false); }, [data?.loginPending]);
  useEffect(() => { if (data) setThreshold(data.settings.threshold); }, [data?.settings.threshold]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void act('list', {}, true); };
    const timer = setInterval(refresh, data?.loginPending ? 2000 : 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [act, data?.loginPending]);
  const date = (value: number | null) => value ? new Date(value * 1000).toLocaleString(i18n.language) : t('unknown');
  const previous = data?.accounts.find(a => a.id === data.previousId && a.id !== data.activeId);
  const pending = data?.accounts.find(a => a.id === data.pendingId);
  const submitDialog = async () => {
    if (!dialog) return;
    const { kind, account } = dialog;
    await act(kind, kind === 'rename' ? { id: account.id, name: rename } : { id: account.id, confirmRestart: kind === 'switch' });
    setDialog(null);
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-3">{!embedded && <h1>{t('title')}</h1>}<><Button disabled={busy} onClick={() => void act('list')}>{t('reload')}</Button><Button variant="primary" disabled={busy || !data || data.nativePreview} onClick={() => setAdding(true)}>{t('add')}</Button></></div>
    <>
    {error && !adding && <ErrorNotice error={error} message={error} />}
    {!data ? <p role="status">{t('loading')}</p> : data.nativePreview ? <Card className="space-y-3"><h2 className="font-bold">{t('browserAccountsTitle')}</h2><p role="status" className="text-sm leading-7">{t('browserAccountsHint')}</p><code dir="ltr" className="block">pnpm dev:desktop</code></Card> : <>
      {!data.cliReady && <Card className="space-y-3"><p role="status">{t('cliMissing', { version: data.supportedVersion })}</p><Link className="vh-link" to="/guides/chatgpt">{t('setup')}</Link></Card>}
      <Disclosure title={t('ux:help')}><p className="text-sm text-muted">{t('desktopUnverified')}</p><p className="mt-3 text-sm text-muted">{t('initialRead')}</p></Disclosure>
      {data.notice && <Card className="space-y-3" as="section"><p role="status">{t(`notices.${data.notice}`, { defaultValue: t(`errors.${data.notice}`, { defaultValue: t('errors.requestFailed') }) })}</p>
        {pending && <p><bdi>{pending.name}</bdi></p>}
        <div className="flex flex-wrap gap-2">{pending && <Button disabled={busy} onClick={() => setDialog({ kind: 'switch', account: pending })}>{t('restartAndSwitch')}</Button>}
          <Button variant="ghost" disabled={busy} onClick={() => void act('dismiss')}>{t('dismiss')}</Button></div>
      </Card>}
      {adding && <Modal open title={t('add')} onClose={() => setAdding(false)} busy={busy}><div className="space-y-4">{error && <ErrorNotice error={error} message={error} />}<label className="block space-y-2 text-sm"><span>{t('accountName')}</span><Input value={name} maxLength={120} dir="auto" onChange={e => setName(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={busy || !data.cliReady || data.loginPending} onClick={() => void act('login', { name })}>{t('signIn')}</Button>
          <Button disabled={busy || !data.cliReady || data.loginPending} onClick={() => void act('import', { name })}>{t('import')}</Button>
          <Button disabled={busy || data.loginPending} onClick={() => void act('importJson', { name })}>{t('importJson')}</Button>
        </div>
        <p className="text-xs leading-6 text-muted">{t('jsonHint')}</p>
      </div></Modal>}
      {data.loginPending && <div role="status" className="flex flex-wrap items-center gap-3 text-sm">{t('loginPending')}<Button disabled={busy} onClick={() => void act('cancel')}>{t('cancelLogin')}</Button></div>}
      <Disclosure title={t('automation')}>
        <Toggle label={t('enableAutomation')} checked={data.settings.enabled} disabled={busy || !data.cliReady} onChange={enabled => void act('settings', { enabled, threshold })} />
        <label className="block max-w-xs space-y-2 text-sm"><span>{t('threshold')}</span><Input type="number" min={0} max={90} value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></label>
        <Button disabled={busy || !Number.isInteger(threshold) || threshold < 0 || threshold > 90} onClick={() => void act('settings', { enabled: data.settings.enabled, threshold })}>{t('save')}</Button>
        <p className="text-sm leading-7 text-muted">{t('automationHint')}</p>
      </Disclosure>
      {previous && <Button disabled={busy || !data.cliReady} onClick={() => void act('switch', { id: previous.id })}>{t('undoSwitch', { name: previous.name })}</Button>}
      <section className="space-y-4" aria-label={t('saved')}>
        <h2 className="text-lg font-bold">{t('saved')}</h2>
        {!data.accounts.length && <EmptyState title={t('empty')} sub={t('emptyHint')} />}
        {data.accounts.map(account => <Card key={account.id} className="space-y-4" as="section">
          <div className="flex flex-wrap items-center gap-3"><h3 className="text-base font-bold" dir="auto">{account.name}</h3>
            {account.id === data.activeId && <Badge tone="primary">{t('active')}</Badge>}
            <Badge tone={account.error ? 'warning' : 'muted'}>{account.plan ?? t('unknown')}</Badge></div>
          <p className="break-all text-sm" dir="auto">{account.email}</p>
          {account.error && <p role="status" className="text-sm text-danger">{t(`errors.${account.error}`, { defaultValue: t('errors.requestFailed') })}</p>}
          {!account.windows.length && <p className="text-sm text-muted">{t('quotaUnknown')}</p>}
          <dl className="grid gap-3 md:grid-cols-2">{account.windows.map(window => <div key={`${window.bucket}-${window.name}`} className="rounded-lg border border-border p-3">
            <dt className="text-sm"><bdi>{window.bucket}</bdi> · {window.minutes ? t('window', { minutes: window.minutes }) : t('unknown')}</dt>
            <dd className="mt-2 font-bold">{window.remaining === null ? t('unknown') : t('remaining', { percent: Math.round(window.remaining) })}</dd>
            <dd className="mt-1 text-xs text-muted">{t('resets', { date: date(window.resetsAt) })}</dd>
          </div>)}</dl>
          <p className="text-xs text-muted">{t('checked', { date: date(account.checkedAt) })}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !data.cliReady} onClick={() => void act('refresh', { id: account.id })}>{t('refresh')}</Button>
            <Button variant="primary" disabled={busy || !data.cliReady} onClick={() => void act('switch', { id: account.id })}>{t(account.id === data.activeId ? 'applyAccount' : 'switch')}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setRename(account.name); setDialog({ kind: 'rename', account }); }}>{t('rename')}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setDialog({ kind: 'delete', account })}>{t('delete')}</Button>
          </div>
        </Card>)}
      </section>
    </>}
    </>
    <Modal open={!!dialog} title={t(dialog?.kind === 'switch' ? 'restartAndSwitch' : dialog?.kind ?? 'rename')} onClose={() => setDialog(null)} busy={busy}>
      {dialog?.kind === 'rename' ? <label className="block space-y-2"><span>{t('accountName')}</span><Input value={rename} maxLength={120} onChange={e => setRename(e.target.value)} /></label> : <p className="text-sm leading-7">{t(dialog?.kind === 'switch' ? 'restartConfirm' : 'deleteConfirm')}</p>}
      <div className="mt-5 flex gap-2"><Button variant="primary" disabled={busy || (dialog?.kind === 'rename' && !rename.trim())} onClick={() => void submitDialog()}>{t('confirm')}</Button><Button disabled={busy} onClick={() => setDialog(null)}>{t('common:cancel')}</Button></div>
    </Modal>
  </div>;
}
