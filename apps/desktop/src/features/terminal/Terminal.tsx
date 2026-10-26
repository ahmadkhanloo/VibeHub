import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Download, Package, Undo2, XCircle } from 'lucide-react';
import { Button, Card, ErrorNotice, Modal, SectionTitle } from '@/components/ui';
import { ipc } from '@/services/ipc';
import type { TerminalSetupState } from '@core';

const PROMPT_PREVIEW = `  3.14.7  main ≡ ?2  C:/Projects/VibeHub  0ms
❯ _`;
type Action = 'omp' | 'nerd' | 'vazir' | 'apply' | 'undo';

export function TerminalPage() {
  const { t } = useTranslation(['terminal', 'common', 'journeyUx']);
  const [state, setState] = useState<TerminalSetupState | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmation, setConfirmation] = useState<Action | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [completed, setCompleted] = useState(false);
  const actionLock = useRef(false);
  const say = useCallback((line: string) => setLog((lines) => [...lines.slice(-8), line]), []);
  const detect = useCallback(async () => {
    setDetecting(true); setError(null);
    try { setState(await ipc.terminalDetect()); }
    catch (e) { setError(e); }
    finally { setDetecting(false); }
  }, []);
  useEffect(() => { void detect(); }, [detect]);
  const run = async (action: Action) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(action); setCompleted(false); setError(null);
    try {
      const result = action === 'omp' ? await ipc.terminalInstallOhMyPosh()
        : action === 'nerd' ? await ipc.terminalInstallFont('nerd')
        : action === 'vazir' ? await ipc.terminalInstallFont('vazirmatn')
        : action === 'apply' ? await ipc.terminalApplyTheme() : await ipc.terminalUndo();
      const detail = 'detail' in result ? result.detail : result.outputTail.join('\n');
      if (!result.ok) throw new Error(detail || t('journeyUx:terminal.actionFailed'));
      say(detail || t('journeyUx:terminal.actionComplete'));
      setState(await ipc.terminalDetect());
      setCompleted(true); setConfirmation(null);
    } catch (e) { setError(e); }
    finally { actionLock.current = false; setBusy(null); }
  };
  const Row = ({ ok, label, value }: { ok: boolean; label: string; value?: string }) => <div className="flex flex-wrap items-center gap-2 text-sm">
    {ok ? <CheckCircle2 size={16} aria-hidden="true" className="text-success" /> : <XCircle size={16} aria-hidden="true" className="text-muted" />}
    <span>{label}</span><span className="text-muted">{ok ? t('common:yes') : t('common:no')}</span>{value && <bdi className="ltr-tech break-all text-xs text-muted">{value}</bdi>}
  </div>;
  const blocked = !!busy || detecting || !state;

  return <section className="space-y-6" aria-busy={detecting || !!busy}>
    <p className="text-sm leading-7 text-muted">{t('terminal:subtitle')}</p>
    {error != null && confirmation === null && <ErrorNotice error={error} onRetry={() => void detect()} />}
    {completed && <p role="status" className="text-sm text-success">{t('journeyUx:terminal.actionComplete')}</p>}
    <Card className="space-y-3">
      <SectionTitle>{t('terminal:steps.detect')}</SectionTitle>
      {detecting ? <p role="status" className="text-sm text-muted">{t('common:loading')}</p> : state ? <>
        <Row ok={state.hasOhMyPosh} label={t('terminal:detected.ohmyposh')} value={state.ohMyPoshVersion} />
        <Row ok={state.hasNerdFont} label={t('terminal:detected.nerdFont')} value={state.nerdFontName} />
        <Row ok={!!state.profilePath} label={t('terminal:detected.profile')} value={state.profilePath} />
        <Row ok={state.themeApplied} label={t('terminal:themeApplied')} value={state.backupPath} />
        <p className="text-xs text-muted">{t('terminal:errors.ideMayNotApply')}</p>
      </> : <p className="text-sm text-muted">{t('journeyUx:terminal.detectionFailed')}</p>}
      <Button size="sm" loading={detecting} disabled={!!busy} onClick={() => void detect()}>{t('journeyUx:terminal.retry')}</Button>
    </Card>
    <Card className="space-y-3">
      <SectionTitle>{t('terminal:steps.preview')}</SectionTitle>
      <p className="text-sm text-muted">{t('terminal:themeDesc')}</p>
      <pre className="ltr-tech overflow-auto rounded-lg border border-border bg-bg p-4 text-sm leading-7">{PROMPT_PREVIEW}</pre>
      <p className="text-xs text-muted">{t('terminal:previewNote')}</p>
    </Card>
    <Card className="space-y-3">
      <SectionTitle>{t('terminal:steps.install')}</SectionTitle>
      <div className="flex flex-wrap gap-3">
        <Button disabled={blocked || state?.hasOhMyPosh} onClick={() => setConfirmation('omp')}><Package size={16} aria-hidden="true" />{t('terminal:installOmp')}</Button>
        <Button disabled={blocked || state?.hasNerdFont} onClick={() => setConfirmation('nerd')}><Download size={16} aria-hidden="true" />{t('terminal:installFont')}</Button>
        <Button disabled={blocked} onClick={() => setConfirmation('vazir')}><Download size={16} aria-hidden="true" />{t('terminal:installVazir')}</Button>
      </div>
      <p className="text-xs leading-6 text-muted">{t('terminal:fontSource')}</p>
    </Card>
    <Card className="space-y-3">
      <SectionTitle>{t('terminal:steps.apply')}</SectionTitle>
      <p className="text-sm leading-7 text-muted">{t('terminal:applyWhat')}</p>
      <div className="flex flex-wrap gap-3"><Button variant="primary" disabled={blocked || state?.themeApplied || !state?.hasOhMyPosh} onClick={() => setConfirmation('apply')}>{t('terminal:applyTheme')}</Button><Button disabled={blocked || !state?.themeApplied} onClick={() => setConfirmation('undo')}><Undo2 size={16} aria-hidden="true" />{t('terminal:undo')}</Button></div>
      <p className="text-xs leading-6 text-muted">{t('terminal:undoNote')}</p>
    </Card>
    <Card className="space-y-3"><SectionTitle>{t('terminal:steps.verify')}</SectionTitle><p className="text-sm leading-7 text-muted">{t('terminal:verifyHint')}</p></Card>
    {!!log.length && <details className="rounded-lg border border-border p-4"><summary className="cursor-pointer text-sm font-medium">{t('journeyUx:terminal.details')}</summary><pre dir="ltr" className="ltr-tech mt-3 whitespace-pre-wrap break-all text-xs text-muted">{log.join('\n')}</pre></details>}
    <Modal open={confirmation !== null} title={t(confirmation === 'apply' ? 'journeyUx:terminal.confirmApplyTitle' : confirmation === 'undo' ? 'journeyUx:terminal.confirmRestoreTitle' : 'journeyUx:terminal.confirmInstallTitle')} busy={!!busy} onClose={() => { setConfirmation(null); setError(null); }}>
      <p className="text-sm leading-7">{t(confirmation === 'apply' ? 'journeyUx:terminal.confirmApply' : confirmation === 'undo' ? 'journeyUx:terminal.confirmRestore' : 'journeyUx:terminal.confirmInstall')}</p>
      {error != null && <ErrorNotice error={error} />}
      <div className="flex justify-end gap-3"><Button data-autofocus disabled={!!busy} onClick={() => { setConfirmation(null); setError(null); }}>{t('common:cancel')}</Button><Button variant="primary" loading={!!busy} onClick={() => { if (confirmation) void run(confirmation); }}>{t('common:confirm')}</Button></div>
    </Modal>
  </section>;
}
