import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, EmptyState, ErrorNotice, Input, Modal } from '@/components/ui';
import {
  ipc,
  type AppAccount,
  type AppAccountsAction,
  type AppAccountsSnapshot,
  type OpaqueAccountApp,
} from '@/services/ipc';

/**
 * Accounts for apps whose session is an opaque, machine-bound blob (ZCode, Qoder).
 * VibeHub never reads the token: it snapshots the session file, backs up the live copy
 * before every switch, and can revert. Every one of those caveats is stated in the page.
 */
export function OpaqueAccountsPage({ appId, appName }: { appId: OpaqueAccountApp; appName: string }) {
  const { t, i18n } = useTranslation(['appAccounts', 'common']);
  const [data, setData] = useState<AppAccountsSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'rename' | 'delete' | 'revert'; account?: AppAccount } | null>(null);
  const [name, setName] = useState('');
  const flight = useRef(false);

  const translatedError = useCallback((cause: unknown) => {
    const key = String(cause).match(/accounts:([a-zA-Z]+)/)?.[1] ?? 'requestFailed';
    return t(`errors.${key}`, { defaultValue: t('errors.requestFailed') });
  }, [t]);

  const act = useCallback(async (action: AppAccountsAction, payload: Record<string, unknown> = {}) => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(null);
    try { setData(await ipc.appAccounts(appId, action, payload)); }
    catch (cause) { setError(translatedError(cause)); }
    finally { flight.current = false; setBusy(false); }
  }, [appId, translatedError]);

  useEffect(() => { void act('list'); }, [act]);

  const submitDialog = async () => {
    if (!dialog) return;
    if (dialog.kind === 'rename' && dialog.account) await act('rename', { id: dialog.account.id, name });
    if (dialog.kind === 'delete' && dialog.account) await act('delete', { id: dialog.account.id });
    if (dialog.kind === 'revert') await act('revert');
    setDialog(null);
  };

  const date = (value: number | null) => value ? new Date(value * 1000).toLocaleString(i18n.language) : t('unknown');
  const notice = data?.notice ? t(`notices.${data.notice}`, { defaultValue: t('notices.captured') }) : null;
  const blocked = busy || !data || !data.filesPresent;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-lg font-bold">{t('title', { app: appName })}</h2>
      <Badge tone={data?.running ? 'warning' : 'muted'}>{data?.running ? t('running') : t('notRunning')}</Badge>
      <div className="ms-auto flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void act('list')}>{t('reload')}</Button>
        <Button variant="primary" disabled={blocked || data!.running} onClick={() => void act('capture', { name: '' })}>{t('capture')}</Button>
      </div>
    </div>

    {error && <ErrorNotice error={error} message={error} />}
    {!data ? <p role="status">{t('loading')}</p> : data.nativePreview ? <Card className="space-y-3">
      <h3 className="font-bold">{t('browserTitle', { app: appName })}</h3>
      <p role="status" className="text-sm leading-7">{t('browserHint')}</p>
      <code dir="ltr" className="block">pnpm dev:desktop</code>
    </Card> : <>
      <Card className="space-y-3" as="section">
        {data.running && <p role="status" className="text-sm leading-7">{t('closeToCapture')}</p>}
        {!data.filesPresent && <p role="status" className="text-sm leading-7">{t('notSignedIn', { app: appName })}</p>}
        <p className="text-sm leading-7 text-muted">{t('explain', { app: appName })}</p>
        <p className="break-all text-xs text-muted" dir="ltr">{data.sessionPath}</p>
        <p className="break-all text-xs text-muted" dir="ltr">{data.managedFiles.join(' · ')}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{t('backupInfo', { count: data.backupCount })}</span>
          {data.lastBackupAt && <span>· {t('lastBackup', { date: date(data.lastBackupAt) })}</span>}
          {data.backupCount > 0 && <Button variant="ghost" disabled={busy || data.running} onClick={() => setDialog({ kind: 'revert' })}>{t('revert')}</Button>}
        </div>
      </Card>

      {/* The three things that surprise people about blob switching, stated up front. */}
      <Card className="space-y-2" as="section">
        <p className="text-sm leading-7">{t('warnNotPortable')}</p>
        <p className="text-sm leading-7">{t('warnSharedFile')}</p>
        <p className="text-sm leading-7">{t('warnVerifyInApp', { app: appName })}</p>
      </Card>

      {data.sessionChanged && <p role="status" className="text-sm leading-7 text-warning">{t('sessionChanged', { app: appName })}</p>}
      {notice && <Card className="space-y-3" as="section">
        <p role="status">{notice}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => void act('dismiss')}>{t('dismiss')}</Button>
        </div>
      </Card>}

      <section className="space-y-4" aria-label={t('saved')}>
        <h3 className="text-base font-bold">{t('saved')}</h3>
        {!data.accounts.length && <EmptyState title={t('empty')} sub={t('emptyHint', { app: appName })} />}
        {data.accounts.map(account => <Card key={account.id} className="space-y-3" as="section">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-bold" dir="auto">{account.name}</h4>
            {account.active && <Badge tone="primary">{t('active')}</Badge>}
          </div>
          <p className="text-xs text-muted" dir="ltr">{account.size} B · {account.files.join(' · ')}</p>
          <p className="text-xs text-muted">{t('capturedAt', { date: date(account.capturedAt) })}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy || account.active} onClick={() => void act('apply', { id: account.id })}>{account.active ? t('applied') : t('apply')}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setName(account.name); setDialog({ kind: 'rename', account }); }}>{t('rename')}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setDialog({ kind: 'delete', account })}>{t('delete')}</Button>
          </div>
        </Card>)}
      </section>
    </>}

    <Modal open={!!dialog} title={t(dialog?.kind ?? 'rename')} onClose={() => setDialog(null)} busy={busy}>
      {dialog?.kind === 'rename'
        ? <label className="block space-y-2"><span>{t('accountName')}</span><Input value={name} maxLength={120} dir="auto" onChange={event => setName(event.target.value)} /></label>
        : dialog?.kind === 'revert'
          ? <p className="text-sm leading-7">{t('revertConfirm')}</p>
          : <p className="text-sm leading-7">{t('deleteConfirm')}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="primary" disabled={busy || (dialog?.kind === 'rename' && !name.trim())} onClick={() => void submitDialog()}>{t('confirm')}</Button>
        <Button disabled={busy} onClick={() => setDialog(null)}>{t('common:cancel')}</Button>
      </div>
    </Modal>
  </div>;
}
