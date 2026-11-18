import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, EmptyState, ErrorNotice, Input, Modal } from '@/components/ui';
import { ipc, type ClaudeAccount, type ClaudeAccountsAction, type ClaudeAccountsSnapshot } from '@/services/ipc';

/**
 * Claude Code stores its provider in ~/.claude/settings.json. VibeHub can save the
 * current provider as a named account and apply another one; the token never leaves
 * the native backend, so this page only ever sees names and labels.
 */
export function ClaudeAccountsPage() {
  const { t } = useTranslation(['claudeAccounts', 'common']);
  const [data, setData] = useState<ClaudeAccountsSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'rename' | 'delete'; account: ClaudeAccount } | null>(null);
  const [name, setName] = useState('');
  const flight = useRef(false);

  const translatedError = useCallback((cause: unknown) => {
    const key = String(cause).match(/accounts:([a-zA-Z]+)/)?.[1] ?? 'requestFailed';
    return t(`errors.${key}`, { defaultValue: t('errors.requestFailed') });
  }, [t]);

  const act = useCallback(async (action: ClaudeAccountsAction, payload: Record<string, unknown> = {}) => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(null);
    try { setData(await ipc.claudeAccounts(action, payload)); }
    catch (cause) { setError(translatedError(cause)); }
    finally { flight.current = false; setBusy(false); }
  }, [translatedError]);

  useEffect(() => { void act('list'); }, [act]);

  const submitDialog = async () => {
    if (!dialog) return;
    const { kind, account } = dialog;
    await act(kind, kind === 'rename' ? { id: account.id, name } : { id: account.id });
    setDialog(null);
  };

  const notice = data?.notice
    ? t(`notices.${data.notice}`, { defaultValue: t('notices.saved') })
    : null;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-lg font-bold">{t('title')}</h2>
      <div className="ms-auto flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void act('list')}>{t('reload')}</Button>
        <Button variant="primary" disabled={busy || !data?.configured} onClick={() => void act('save', { name: '' })}>{t('save')}</Button>
      </div>
    </div>

    {error && <ErrorNotice error={error} message={error} />}
    {!data ? <p role="status">{t('loading')}</p> : data.nativePreview ? <Card className="space-y-3">
      <h3 className="font-bold">{t('browserTitle')}</h3>
      <p role="status" className="text-sm leading-7">{t('browserHint')}</p>
      <code dir="ltr" className="block">pnpm dev:desktop</code>
    </Card> : <>
      <Card className="space-y-2" as="section">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{t('currentProvider')}</span>
          <Badge tone={data.configured ? 'primary' : 'muted'}><bdi dir="ltr">{data.current ?? t('notConfigured')}</bdi></Badge>
        </div>
        {data.settingsPath && <p className="break-all text-xs text-muted" dir="ltr">{data.settingsPath}</p>}
        {!data.configured && <p role="status" className="text-sm leading-7">{t('noToken')}</p>}
        <p className="text-sm leading-7 text-muted">{t('explain')}</p>
      </Card>

      {notice && <Card className="space-y-3" as="section">
        <p role="status">{notice}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => void act('dismiss')}>{t('dismiss')}</Button>
        </div>
      </Card>}

      <section className="space-y-4" aria-label={t('saved')}>
        <h3 className="text-base font-bold">{t('saved')}</h3>
        {!data.accounts.length && <EmptyState title={t('empty')} sub={t('emptyHint')} />}
        {data.accounts.map(account => <Card key={account.id} className="space-y-3" as="section">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-bold" dir="auto">{account.name}</h4>
            {account.active && <Badge tone="primary">{t('active')}</Badge>}
          </div>
          <p className="break-all text-sm text-muted" dir="ltr">{account.label}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy || account.active} onClick={() => void act('apply', { id: account.id })}>{account.active ? t('applied') : t('apply')}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setName(account.name); setDialog({ kind: 'rename', account }); }}>{t('rename')}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setDialog({ kind: 'delete', account })}>{t('delete')}</Button>
          </div>
        </Card>)}
      </section>
      <p className="text-sm leading-7 text-muted">{t('restartHint')}</p>
    </>}

    <Modal open={!!dialog} title={t(dialog?.kind === 'rename' ? 'rename' : 'delete')} onClose={() => setDialog(null)} busy={busy}>
      {dialog?.kind === 'rename'
        ? <label className="block space-y-2"><span>{t('accountName')}</span><Input value={name} maxLength={120} dir="auto" onChange={event => setName(event.target.value)} /></label>
        : <p className="text-sm leading-7">{t('deleteConfirm')}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="primary" disabled={busy || (dialog?.kind === 'rename' && !name.trim())} onClick={() => void submitDialog()}>{t('confirm')}</Button>
        <Button disabled={busy} onClick={() => setDialog(null)}>{t('common:cancel')}</Button>
      </div>
    </Modal>
  </div>;
}
