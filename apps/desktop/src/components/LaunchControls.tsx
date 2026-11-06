import { AppPath } from './AppPath';
import { RtlSetup } from './RtlSetup';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { launchBlocked, launchFailureKind, rtlAdapterAvailable, rtlAdapterConfigured, rtlAdapterSetupSupported, type LaunchMode } from '@core';
import { useToolContext } from '@/app/tool-context';
import { ipc } from '@/services/ipc';
import { Button, ErrorNotice } from './ui';
import { AppLogo } from './AppLogo';

export function LaunchControls({
  id,
  name,
  kind = 'app',
  compact = false,
  showRtlRepair = false,
}: {
  id: string;
  name: string;
  kind?: 'app' | 'editor';
  compact?: boolean;
  showRtlRepair?: boolean;
}) {
  const { t } = useTranslation(['ux', 'workbench']);
  const ctx = useToolContext();
  const [focusError, setFocusError] = useState<unknown>(null);
  const [focusing, setFocusing] = useState(false);
  const state = ctx.states[id];
  const key = kind + ':' + id;
  const failure = ctx.failures[key] || (state?.phase === 'failed' ? state.error : undefined);
  const failureKind = launchFailureKind(failure);
  const busy = ctx.busy[key] ?? false;
  const repeatCli = id === 'claude-code';
  const focusRunning = state?.phase === 'running' && !repeatCli;
  const managed = kind === 'app' || id === 'antigravity';
  const rtlAvailable = kind === 'app' && rtlAdapterAvailable(id, ctx.components);
  const rtlReady = kind === 'app' && (id === 'claude-code' || rtlAdapterConfigured(id, ctx.components));
  const rtlSetupSupported = kind === 'app' && rtlAdapterSetupSupported(id, ctx.components);
  const normalBlocked = repeatCli && state?.phase === 'running' ? busy : managed ? launchBlocked('normal', state, false, busy) : busy;
  const rtlBlocked = managed ? launchBlocked('rtl', state, rtlReady, busy) : busy;

  const run = (mode: LaunchMode) => { void ctx.launch(id, kind, mode); };
  const focus = () => {
    setFocusing(true); setFocusError(null);
    void (kind === 'editor' ? ipc.focusEditor(id) : ipc.focusApp(id)).catch(setFocusError).finally(() => setFocusing(false));
  };

  return <div className={compact ? 'vh-launch-compact' : 'vh-launch-full'}>
    <div className="vh-launch-actions">
      <Button variant="primary" disabled={focusRunning ? busy || focusing : normalBlocked} loading={busy || focusing} aria-label={(focusRunning ? t('focusApp') : repeatCli && state?.phase === 'running' ? t('openAnotherTerminal') : t('run')) + ' ' + name} onClick={() => focusRunning ? focus() : run('normal')}>
        <Play aria-hidden="true" size={15} />{focusRunning ? t('focusApp') : repeatCli && state?.phase === 'running' ? t('openAnotherTerminal') : t('run')}
      </Button>
      {rtlReady && <Button disabled={rtlBlocked} loading={busy && state?.phase === 'running' && state.rtl} aria-label={t('runRtlCompact') + ' ' + name} onClick={() => run('rtl')}><AppLogo appId={id} name={name} size={24} rtl /><span>{t('runRtlCompact')}</span></Button>}
      {rtlSetupSupported && (!rtlReady || showRtlRepair) && <RtlSetup key={id} id={id} name={name} available={rtlAvailable} configured={rtlReady} onReady={() => void ctx.refresh()} />}
    </div>
    {state === undefined && !busy && <p className="text-xs text-muted" role="status">{t('stateUnknown')} <button className="ms-2 underline" aria-label={t('recheckFor', { name })} onClick={() => void ctx.checkState(id)}>{t('retry')}</button></p>}
    {ctx.messages[key] && <p role="status" className="text-xs text-success">{t('requestAccepted')}</p>}
    {focusError != null && <ErrorNotice error={focusError} />}
    {failure && <details className="vh-launch-error" open={!!ctx.failures[key]}>
      <summary><AlertCircle size={14} aria-hidden="true" /><span>{t('workbench:launchIssue')}</span></summary>
      <div className="space-y-2">
        <ErrorNotice error={failure} message={failureKind ? t(`launchFailure.${failureKind}`, { name }) : undefined} recovery={failureKind ? t(`launchFailure.${failureKind}Recovery`, { name }) : undefined} onRetry={!busy ? () => run('normal') : undefined} />
        {kind === 'app' && <>
          <AppPath appId={id} />
          <Link className="vh-link" to={`/app/${id}?tab=connections`}>{t('connections')}</Link>
        </>}
        {kind === 'editor' && <Link className="vh-link" to="/connections/proxy">{t('connections')}</Link>}
        <Link className="vh-button vh-button-ghost text-sm" to={`/doctor?tool=${encodeURIComponent(id)}&kind=${kind}`}>{t('doctor')}</Link>
      </div>
    </details>}
  </div>;
}
