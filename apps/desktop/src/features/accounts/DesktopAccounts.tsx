import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Plus } from 'lucide-react';
import { ipc, type DesktopAccount, type DesktopAccountsSnapshot } from '@/services/ipc';
import { Badge, Button, Card, EmptyState, ErrorNotice, Input, Modal } from '@/components/ui';
import { Tooltip } from '@/components/Tooltip';

export function DesktopAccounts({ appId }: { appId: string }) {
  const { t, i18n } = useTranslation(['accounts', 'ux', 'common']);
  const [snapshot, setSnapshot] = useState<DesktopAccountsSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ action: 'rename' | 'delete' | 'switch'; account: DesktopAccount } | null>(null);
  const [name, setName] = useState('');
  const flight = useRef(false);
  const act = useCallback(async (action: string, payload: Record<string, unknown> = {}, quiet = false) => {
    if (flight.current) return false;
    flight.current = true; if (!quiet) { setBusy(true); setError(null); }
    try { setSnapshot(await ipc.appAccounts(appId, action, payload)); return true; }
    catch (cause) { if (!quiet) { const key = String(cause).match(/accounts:([a-zA-Z]+)/)?.[1] ?? 'requestFailed'; setError(t('errors.' + key, { defaultValue: t('errors.requestFailed') })); } return false; }
    finally { flight.current = false; if (!quiet) setBusy(false); }
  }, [appId, t]);
  useEffect(() => { void act('list'); const timer = setInterval(() => { if (document.visibilityState === 'visible') void act('list', {}, true); }, 30000); return () => clearInterval(timer); }, [act]);
  const notice = snapshot?.notice?.replace('accounts:', '');
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {snapshot?.capabilities.canImport && <Button disabled={busy} onClick={() => void act('import')}><RefreshCw size={16} aria-hidden="true" />{t('reload')}</Button>}
      {snapshot?.capabilities.canLogin && <Button variant="primary" disabled={busy} onClick={() => void act('login')}><Plus size={16} aria-hidden="true" />{t('add')}</Button>}
      <Tooltip text={t('desktopAccountsHint')} />
    </div>
    {error && !dialog && <ErrorNotice error={error} message={error} onRetry={() => void act('list')} />}
    {notice && <p role="status" className="text-sm text-muted">{t('errors.' + notice, { defaultValue: t('errors.requestFailed') })}</p>}
    {snapshot && !snapshot.capabilities.canSwitch && <p role="status" className="text-sm text-warning">{snapshot.version === snapshot.supportedVersion && !snapshot.liveSwitchVerified ? t('errors.switchUnverified') : t('versionReadOnly', { version: snapshot.version || '—', supported: snapshot.supportedVersion })}</p>}
    {!snapshot ? <p role="status">{t('loading')}</p> : !snapshot.accounts.length ? <EmptyState title={t('empty')} sub={t('captureAfterLogin')} /> : <div className="vh-record-list">
      {snapshot.accounts.map(account => <Card key={account.id} data-testid={`desktop-account-${account.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1"><h2 className="font-bold" dir="auto">{account.name}</h2><p className="break-all text-sm text-muted" dir="auto">{account.email}</p></div>
          <div className="flex flex-wrap items-center gap-2">{account.id === snapshot.activeId && <Badge tone="primary">{t('active')}</Badge>}<span className="text-xs text-muted">{account.plan}</span></div>
        </div>
        <div className="my-4 space-y-2 text-sm">
          {!account.usage.length && <span className="text-muted">{t('quotaUnknown')}</span>}
          {account.usage.map((usage, index) => <div key={index} className="flex flex-wrap justify-between gap-2"><span dir="auto">{usage.label}</span><span>{usage.remaining != null ? usage.unit === 'percent' ? t('remaining', { percent: Math.round(usage.remaining) }) : t('remainingAmount', { amount: usage.remaining.toLocaleString(i18n.language), unit: t('units.' + usage.unit, { defaultValue: usage.unit }) }) : usage.granted != null ? t('grantedQuota', { amount: Number(usage.granted).toLocaleString(i18n.language), unit: t('units.' + usage.unit, { defaultValue: usage.unit }) }) : t('unknown')}</span></div>)}
          {appId === 'zcode' && account.usage.some(usage => usage.granted != null && usage.remaining == null) && <span className="block text-xs text-muted">{t('grantedNotRemaining')}</span>}
          {account.quotaError && <p role="status" className="text-sm text-warning">{t('errors.balanceUnavailable')}</p>}
          {account.expiresAt != null && <p className="text-xs text-muted">{t('expires', { date: new Date(account.expiresAt * 1000).toLocaleString(i18n.language) })}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy} onClick={() => void act('refresh', { id: account.id })}>{t('refresh')}</Button>
          {snapshot.capabilities.canSwitch && <Button size="sm" variant="primary" disabled={busy || snapshot.activeId === account.id} onClick={() => setDialog({ action: 'switch', account })}>{t('switch')}</Button>}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setName(account.name); setDialog({ action: 'rename', account }); }}>{t('rename')}</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDialog({ action: 'delete', account })}>{t('delete')}</Button>
          <Tooltip text={t('checked', { date: account.checkedAt ? new Date(account.checkedAt * 1000).toLocaleString() : t('unknown') })} />
        </div>
      </Card>)}
    </div>}
    <Modal open={!!dialog} title={t(dialog?.action === 'switch' && snapshot?.desktopRunning ? 'restartAndSwitch' : dialog?.action ?? 'rename')} busy={busy} onClose={() => setDialog(null)}>
      {dialog?.action === 'rename' ? <label className="block space-y-2"><span>{t('accountName')}</span><Input value={name} onChange={event => setName(event.target.value)} maxLength={120} /></label> : <p className="text-sm leading-7">{t(dialog?.action === 'delete' ? 'desktopDeleteConfirm' : snapshot?.desktopRunning ? 'desktopRestartConfirm' : 'switchConfirm')}</p>}
      {error && <ErrorNotice error={error} message={error} />}
      <div className="flex justify-end gap-2"><Button disabled={busy} onClick={() => setDialog(null)}>{t('common:cancel')}</Button><Button variant={dialog?.action === 'delete' ? 'danger' : 'primary'} loading={busy} disabled={dialog?.action === 'rename' && !name.trim()} onClick={async () => { if (dialog && await act(dialog.action, { id: dialog.account.id, name, confirmRestart: snapshot?.desktopRunning === true })) setDialog(null); }}>{t('confirm')}</Button></div>
    </Modal>
  </div>;
}
