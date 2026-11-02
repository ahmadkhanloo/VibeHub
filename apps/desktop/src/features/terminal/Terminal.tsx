import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CheckCircle2, ClipboardCopy, Download, ExternalLink, Package, Undo2, XCircle } from 'lucide-react';
import { Badge, Button, Card, ErrorNotice, Modal, PageHeader } from '@/components/ui';
import { ipc } from '@/services/ipc';
import type { TerminalSetupState } from '@core';
import { openUrl } from '@tauri-apps/plugin-opener';

const PROMPT_PREVIEW = `  3.14.7  main ≡ ?2  C:/Projects/VibeHub  0ms\n❯ _`;
const PERSIAN_SAMPLE = 'سلام، فارسی را پیوسته می‌نویسم.';
type Action = 'persian' | 'omp' | 'nerd' | 'vazir' | 'apply' | 'undo';

export function TerminalPage() {
  const { t } = useTranslation(['terminal', 'common', 'journeyUx']);
  const [state, setState] = useState<TerminalSetupState | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmation, setConfirmation] = useState<Action | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [completed, setCompleted] = useState(false);
  const [copied, setCopied] = useState(false);
  const actionLock = useRef(false);
  const say = useCallback((line: string) => setLog(lines => [...lines.slice(-8), line]), []);
  const detect = useCallback(async () => {
    setDetecting(true); setError(null);
    try { setState(await ipc.terminalDetect()); }
    catch (cause) { setError(cause); }
    finally { setDetecting(false); }
  }, []);
  useEffect(() => { void detect(); }, [detect]);

  const run = async (action: Action) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(action); setCompleted(false); setError(null);
    try {
      const result = action === 'persian' ? await ipc.terminalInstallPersian()
        : action === 'omp' ? await ipc.terminalInstallOhMyPosh()
        : action === 'nerd' ? await ipc.terminalInstallFont('nerd')
        : action === 'vazir' ? await ipc.terminalInstallFont('vazirmatn')
        : action === 'apply' ? await ipc.terminalApplyTheme() : await ipc.terminalUndo();
      const detail = 'detail' in result ? result.detail : result.outputTail.join('\n');
      if (!result.ok) throw new Error(detail || t('journeyUx:terminal.actionFailed'));
      say(detail || t('journeyUx:terminal.actionComplete'));
      setState(await ipc.terminalDetect());
      setCompleted(true); setConfirmation(null);
    } catch (cause) { setError(cause); }
    finally { actionLock.current = false; setBusy(null); }
  };
  const copySample = async () => {
    try { await navigator.clipboard.writeText(PERSIAN_SAMPLE); setCopied(true); }
    catch (cause) { setError(cause); setCopied(false); }
  };
  const status = (ok: boolean, label: string, okLabel = t('terminal:status.installed')) => <span key={label} className="vh-terminal-status">{ok ? <CheckCircle2 size={15} aria-hidden="true" className="text-success" /> : <XCircle size={15} aria-hidden="true" className="text-muted" />}<span>{label}</span><span>{ok ? okLabel : t('terminal:status.missing')}</span></span>;
  const blocked = !!busy || detecting || !state;
  const nextAction = !state ? t(detecting ? 'terminal:nextAction.loading' : 'terminal:nextAction.unknown')
    : !state.hasPersianTerminal ? t('terminal:nextAction.installHost')
    : !state.hasOhMyPosh ? t('terminal:nextAction.installOmp')
    : !state.hasNerdFont ? t('terminal:nextAction.installFont')
    : !state.themeApplied ? t('terminal:nextAction.applyTheme') : t('terminal:nextAction.ready');

  return <section className="vh-terminal-page space-y-5" aria-busy={detecting || !!busy}>
    <PageHeader title={t('terminal:title')} description={t('terminal:subtitle')} actions={<Button size="sm" variant="ghost" loading={detecting} disabled={!!busy} onClick={() => void detect()}>{t('journeyUx:terminal.retry')}</Button>} />
    {error != null && confirmation === null && <ErrorNotice error={error} onRetry={() => void detect()} />}
    {completed && <p role="status" className="text-sm text-success">{t('journeyUx:terminal.actionComplete')}</p>}

    <Card className="vh-terminal-overview space-y-3">
      <h2>{t('terminal:overview')}</h2>
      <p className="vh-terminal-next"><strong>{t('terminal:nextAction.label')}:</strong> {nextAction}</p>
      {detecting ? <p role="status" className="text-sm text-muted">{t('common:loading')}</p> : state ? <div className="vh-terminal-statuses">
        {status(!!state.hasPersianTerminal, t('terminal:persian.host'), t('terminal:persian.installedNeedsCheck'))}
        {status(state.hasOhMyPosh, t('terminal:detected.ohmyposh'))}
        {status(state.hasNerdFont, t('terminal:detected.nerdFont'))}
        {status(state.themeApplied, t('terminal:themeApplied'))}
      </div> : <p className="text-sm text-muted">{t('journeyUx:terminal.detectionFailed')}</p>}
      {state && <details className="vh-terminal-details"><summary>{t('journeyUx:terminal.details')}</summary><div>
        <p><strong>{t('terminal:persian.title')}:</strong> <bdi>{state.persianTerminalPath ?? t('terminal:status.unknown')}</bdi></p>
        <p><strong>{t('terminal:detected.ohmyposh')}:</strong> <bdi>{state.ohMyPoshVersion ?? t('terminal:status.unknown')}</bdi></p>
        <p><strong>{t('terminal:detected.nerdFont')}:</strong> <bdi>{state.nerdFontName ?? t('terminal:status.unknown')}</bdi></p>
        <p><strong>{t('terminal:detected.profile')}:</strong> <bdi>{state.profilePath ?? t('terminal:status.unknown')}</bdi></p>
        {state.backupPath && <p><strong>{t('terminal:backupAt')}:</strong> <bdi>{state.backupPath}</bdi></p>}
      </div></details>}
    </Card>

    <div className="vh-terminal-groups">
      <Card className="space-y-4">
        <div><h2 className="vh-terminal-heading">{t('terminal:persian.title')}</h2><p className="mt-1 text-sm leading-7 text-muted">{t('terminal:persian.description')}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={state?.hasPersianTerminal ? 'success' : 'muted'}>{state?.hasPersianTerminal ? t('terminal:persian.installedNeedsCheck') : t('terminal:status.notInstalled')}</Badge>
          {state?.hasPersianTerminal
            ? <Button size="sm" disabled><CheckCircle2 size={15} aria-hidden="true" />{t('terminal:persian.installed')}</Button>
            : <Button size="sm" variant="primary" disabled={blocked} loading={busy === 'persian'} onClick={() => setConfirmation('persian')}><Download size={16} aria-hidden="true" />{t('terminal:persian.install')}</Button>}
          <Button size="sm" variant="ghost" onClick={() => void openUrl('https://github.com/mirbehnam/RtlTerminal/releases/tag/v1.1.4').catch(setError)}><ExternalLink size={15} aria-hidden="true" />{t('terminal:persian.source')}</Button>
        </div>
        <p className="text-xs leading-6 text-muted">{t('terminal:persian.requirements')}</p>
        <div className="vh-terminal-sample"><pre tabIndex={0} dir="ltr">{PERSIAN_SAMPLE}</pre><Button size="sm" variant="ghost" onClick={() => void copySample()}>{copied ? <Check size={15} aria-hidden="true" /> : <ClipboardCopy size={15} aria-hidden="true" />}{copied ? t('terminal:copied') : t('terminal:copySample')}</Button></div>
        <p className="text-xs leading-6 text-muted">{t('terminal:persian.verify')} {t('terminal:persian.undo')}</p>
      </Card>

      <Card className="space-y-4">
        <div><h2 className="vh-terminal-heading">{t('terminal:customize')}</h2><p className="mt-1 text-sm leading-7 text-muted">{t('terminal:themeDesc')}</p></div>
        <div className="vh-terminal-preview-row">
          <div className="vh-terminal-preview-block"><pre tabIndex={0} dir="ltr" className="ltr-tech vh-terminal-preview">{PROMPT_PREVIEW}</pre><p className="text-xs text-muted">{t('terminal:previewNote')}</p></div>
          <div className="vh-terminal-actions">
            {state?.hasOhMyPosh ? <Badge tone="success">{t('terminal:status.ompInstalled')}</Badge> : <Button size="sm" disabled={blocked} loading={busy === 'omp'} onClick={() => setConfirmation('omp')}><Package size={15} aria-hidden="true" />{t('terminal:installOmp')}</Button>}
            {state && !state.hasOhMyPosh && <p className="vh-terminal-requirement">{t('terminal:requirements.ohmyposh')}</p>}
            {state?.hasNerdFont ? <Badge tone="success">{t('terminal:status.fontInstalled')}</Badge> : <Button size="sm" disabled={blocked} loading={busy === 'nerd'} onClick={() => setConfirmation('nerd')}><Download size={15} aria-hidden="true" />{t('terminal:installFont')}</Button>}
            <Button size="sm" variant="ghost" disabled={blocked} loading={busy === 'vazir'} onClick={() => setConfirmation('vazir')}><Download size={15} aria-hidden="true" />{t('terminal:installVazir')}<span className="vh-terminal-optional">{t('terminal:optional')}</span></Button>
          </div>
        </div>
        <p className="text-xs leading-6 text-muted">{t('terminal:fontSource')} {t('terminal:errors.ideMayNotApply')}</p>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button size="sm" variant="primary" disabled={blocked || state?.themeApplied || !state?.hasOhMyPosh} loading={busy === 'apply'} onClick={() => setConfirmation('apply')}>{t('terminal:applyTheme')}</Button>
          <Button size="sm" variant="ghost" disabled={blocked || !state?.themeApplied} loading={busy === 'undo'} onClick={() => setConfirmation('undo')}><Undo2 size={15} aria-hidden="true" />{t('terminal:undo')}</Button>
          {state?.themeApplied && <span className="text-xs text-muted">{t('terminal:undoNote')}</span>}
        </div>
        <p className="text-xs text-muted">{t('terminal:verifyHint')}</p>
      </Card>
    </div>

    {!!log.length && <details className="vh-terminal-details rounded-xl border border-border p-4"><summary>{t('journeyUx:terminal.details')}</summary><pre tabIndex={0} dir="ltr" className="ltr-tech mt-3 whitespace-pre-wrap break-all text-xs text-muted">{log.join('\n')}</pre></details>}
    <Modal open={confirmation !== null} title={t(confirmation === 'apply' ? 'journeyUx:terminal.confirmApplyTitle' : confirmation === 'undo' ? 'journeyUx:terminal.confirmRestoreTitle' : 'journeyUx:terminal.confirmInstallTitle')} busy={!!busy} onClose={() => { setConfirmation(null); setError(null); }}>
      <p className="text-sm leading-7">{t(confirmation === 'persian' ? 'terminal:persian.confirm' : confirmation === 'apply' ? 'journeyUx:terminal.confirmApply' : confirmation === 'undo' ? 'journeyUx:terminal.confirmRestore' : 'journeyUx:terminal.confirmInstall')}</p>
      {error != null && <ErrorNotice error={error} />}
      <div className="flex justify-end gap-3"><Button data-autofocus disabled={!!busy} onClick={() => { setConfirmation(null); setError(null); }}>{t('common:cancel')}</Button><Button variant="primary" loading={!!busy} onClick={() => { if (confirmation) void run(confirmation); }}>{t('common:confirm')}</Button></div>
    </Modal>
  </section>;
}
