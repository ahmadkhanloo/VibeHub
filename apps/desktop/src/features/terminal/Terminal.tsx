import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Download, Package, Undo2, XCircle } from 'lucide-react';
import { Badge, Button, Card, SectionTitle } from '@/components/ui';
import { ipc, type FontInstallResult, type InstallRunResult } from '@/services/ipc';
import type { TerminalSetupState } from '@core';

const PROMPT_PREVIEW = `  3.14.7  main ≡ ?2  C:/Projects/VibeHub  0ms
❯ _`;

export function TerminalPage() {
  const { t } = useTranslation(['terminal', 'common']);
  const [state, setState] = useState<TerminalSetupState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const say = useCallback((line: string) => setLog((l) => [...l.slice(-8), line]), []);

  const detect = () =>
    ipc.terminalDetect().then(setState).catch((e) => say(`detect: ${e}`));
  useEffect(() => void detect(), []);

  const run = async (key: string, fn: () => Promise<{ detail?: string; outputTail?: string[] }>) => {
    setBusy(key);
    try {
      const r = await fn();
      say(r.detail ?? r.outputTail?.join('\n') ?? key);
      await detect();
    } catch (e) {
      say(`${key}: ${e}`);
    } finally {
      setBusy(null);
    }
  };

  const Row = ({ ok, label, value }: { ok: boolean | null; label: string; value?: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {ok === true ? <CheckCircle2 size={15} className="text-success" /> : ok === false ? <XCircle size={15} className="text-muted" /> : null}
      <span className="text-muted">{label}</span>
      {value && <span className="ltr-tech text-xs">{value}</span>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t('terminal:title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t('terminal:subtitle')}</p>
      </div>

      <Card className="space-y-2">
        <SectionTitle>{t('terminal:steps.detect')}</SectionTitle>
        {state === null ? (
          <p className="text-sm text-muted">{t('common:loading')}</p>
        ) : (
          <>
            <Row ok label={t('terminal:detected.ohmyposh')} value={state.ohMyPoshVersion ?? t('common:no')} />
            <Row ok={state.hasNerdFont} label={t('terminal:detected.nerdFont')} value={state.nerdFontName ?? undefined} />
            <Row ok label={t('terminal:detected.profile')} value={state.profilePath} />
            <Row ok={state.themeApplied} label={t('terminal:themeApplied') + (state.backupPath ? ` (${t('terminal:backupAt')}: ${state.backupPath})` : '')} />
            {state.profilePath && <p className="text-xs text-muted">{t('terminal:errors.ideMayNotApply')}</p>}
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>{t('terminal:steps.preview')} — {t('terminal:themeName')}</SectionTitle>
        <p className="mb-3 text-sm text-muted">{t('terminal:themeDesc')}</p>
        <pre className="ltr-tech overflow-auto rounded-[10px] border border-border bg-bg p-4 text-sm leading-6">{PROMPT_PREVIEW}</pre>
        <p className="mt-2 text-xs text-muted">{t('terminal:previewNote')}</p>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>{t('terminal:steps.install')}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button loading={busy === 'omp'} disabled={state?.hasOhMyPosh} onClick={() => void run('omp', () => ipc.terminalInstallOhMyPosh())}>
            <Package size={14} /> {t('terminal:installOmp')}
          </Button>
          <Button loading={busy === 'nerd'} disabled={state?.hasNerdFont} onClick={() => void run('nerd', () => ipc.terminalInstallFont('nerd'))}>
            <Download size={14} /> {t('terminal:installFont')}
          </Button>
          <Button loading={busy === 'vazir'} onClick={() => void run('vazir', () => ipc.terminalInstallFont('vazirmatn'))}>
            <Download size={14} /> {t('terminal:installVazir')}
          </Button>
        </div>
        <p className="text-xs text-muted">{t('terminal:fontSource')}</p>
        <p className="ltr-tech text-xs text-muted">winget install JanDeDobbeleer.OhMyPosh --source winget</p>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>{t('terminal:steps.apply')}</SectionTitle>
        <p className="text-sm text-muted">{t('terminal:applyWhat')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" loading={busy === 'apply'} disabled={state?.themeApplied} onClick={() => void run('apply', () => ipc.terminalApplyTheme())}>
            {t('terminal:applyTheme')}
          </Button>
          <Button variant="danger" loading={busy === 'undo'} disabled={!state?.themeApplied} onClick={() => void run('undo', () => ipc.terminalUndo())}>
            <Undo2 size={14} /> {t('terminal:undo')}
          </Button>
        </div>
        <p className="text-xs text-muted">{t('terminal:undoNote')}</p>
      </Card>

      <Card>
        <SectionTitle>{t('terminal:steps.verify')}</SectionTitle>
        <p className="text-sm text-muted">{t('terminal:verifyHint')}</p>
      </Card>

      {!!log.length && (
        <Card>
          <SectionTitle>log</SectionTitle>
          <pre className="ltr-tech space-y-1 text-xs text-muted">{log.join('\n')}</pre>
        </Card>
      )}
    </div>
  );
}
