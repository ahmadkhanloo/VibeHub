import { Disclosure } from '@/components/Disclosure';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Download, Moon, RefreshCw, Sun } from 'lucide-react';
import { Badge, Button, ErrorNotice, Input, Modal, PageHeader, Select, Toggle, Tabs } from '@/components/ui';
import { useSettings, type Accent, type ThemeFamily, type ThemeModeSetting } from '@/app/settings';
import { ipc, type CredentialClearResult, type ProviderCredentialInventory } from '@/services/ipc';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Link, useSearchParams } from 'react-router-dom';


import { TerminalPage } from '@/features/terminal/Terminal';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

const FAMILIES: ThemeFamily[] = ['graphite', 'nord', 'catppuccin', 'solarized'];
const ACCENTS: Accent[] = ['auto', 'indigo', 'emerald', 'violet', 'amber'];

const MODES: ThemeModeSetting[] = ['system', 'light', 'dark'];
const LEGACY_NAMES: Record<string, string> = { openrouter: 'OpenRouter', 'nvidia-build': 'NVIDIA', 'custom-openai-compatible': 'OpenAI-compatible' };

function ThemeGallery() {
  const { t } = useTranslation(['settings', 'common']);
  const { settings, update, resolvedMode } = useSettings();
  return <div className="space-y-4">
    <h3 className="font-semibold">{t('settings:appearance.gallery')}</h3>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {FAMILIES.flatMap((family) => (['light', 'dark'] as const).map((mode) => {
        const active = settings.themeFamily === family && resolvedMode === mode;
        return <button key={`${family}-${mode}`} type="button" aria-pressed={active}
          onClick={() => update({ themeFamily: family, themeMode: mode })}
          data-theme={family} data-mode={mode} data-accent={settings.accent}
          className={`rounded-xl border p-4 text-start ${active ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
          style={{ background: 'var(--surface)', color: 'var(--text)' }}>
          <span className="vh-theme-preview" aria-hidden="true">
            <span className="vh-theme-preview-nav"><i /><i /><i /></span>
            <span className="vh-theme-preview-content"><span className="vh-theme-preview-heading" /><span className="vh-theme-preview-line" /><span className="vh-theme-preview-card"><i /><span /></span><span className="vh-theme-preview-action" /></span>
            {active && <Check size={16} className="vh-theme-preview-check" />}
          </span>
          <span className="flex items-center justify-between gap-2 text-sm">
            {t(`settings:appearance.families.${family}`)}
            {mode === 'dark' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
          </span>
          <span className="mt-1 block text-xs">{t(`settings:appearance.mode${mode === 'dark' ? 'Dark' : 'Light'}`)}</span>
        </button>;
      }))}
    </div>
  </div>;
}

export function SettingsPage() {
  const { t } = useTranslation(['settingsUx', 'settings', 'common']);
  const { settings, update } = useSettings();
  const [params, setParams] = useSearchParams();
  const panels = ['appearance', 'terminal', 'updates', 'notifications', 'data'];
  const selectedPanel = params.get('panel') === 'terminal' ? 'terminal' : panels.includes(params.get('section') ?? '') ? params.get('section')! : 'appearance';
  const [version, setVersion] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<Awaited<ReturnType<typeof check>>>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncDate, setSyncDate] = useState<string | null>(null);
  const [modal, setModal] = useState<'credentials' | 'reset' | null>(null);
  const [inventory, setInventory] = useState<ProviderCredentialInventory | null>(null);
  const [clearReport, setClearReport] = useState<CredentialClearResult | null>(null);
  const [credentialError, setCredentialError] = useState<unknown>(null);

  useEffect(() => { void ipc.appVersion().then(setVersion).catch(() => setVersion(null)); }, []);

  const perform = async (name: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(name); setError(null); setMessage(null);
    try { await action(); } catch (reason) { setError(reason); } finally { setBusy(null); }
  };
  const inspectCredentials = async () => {
    setModal('credentials'); setBusy('inventory'); setCredentialError(null); setClearReport(null); setInventory(null);
    try { setInventory(await ipc.providerCredentialsInventory()); }
    catch (reason) { setCredentialError(reason); }
    finally { setBusy(null); }
  };
  const clearCredentials = async () => {
    if (!inventory || busy) return;
    setBusy('clear'); setCredentialError(null);
    try {
      const report = await ipc.providerCredentialsClear(inventory.connections.map((item) => item.id), inventory.legacyProviderIds);
      setClearReport(report);
      if (!report.failures.length) {
        setModal(null); setInventory(null); setMessage(t('settingsUx:credentialsDone'));
      } else {
        // Keep retry scoped to the selection the user actually confirmed.
        setInventory({
          connections: inventory.connections.filter((item) => report.failures.some((failure) => failure.kind === 'connection' && failure.id === item.id)),
          legacyProviderIds: inventory.legacyProviderIds.filter((id) => report.failures.some((failure) => failure.kind === 'legacy' && failure.id === id)),
        });
        const current = await ipc.providerCredentialsInventory();
        setInventory({
          connections: current.connections.filter((item) => report.failures.some((failure) => failure.kind === 'connection' && failure.id === item.id)),
          legacyProviderIds: current.legacyProviderIds.filter((id) => report.failures.some((failure) => failure.kind === 'legacy' && failure.id === id)),
        });
      }
    } catch (reason) { setCredentialError(reason); }
    finally { setBusy(null); }
  };
  const selectionCount = (inventory?.connections.length ?? 0) + (inventory?.legacyProviderIds.length ?? 0);

  return <div className="space-y-6 vh-settings-sections">
    <PageHeader title={t('settings:title')} />
    <Tabs panelId="settings-panel" label={t('settings:title')} value={selectedPanel} onChange={value => setParams(current => { const next = new URLSearchParams(current); next.delete('panel'); next.set('section', value); return next; })} items={panels.map(value => ({ value, label: t('ux:' + value + 'Tab') }))} />
    <div id="settings-panel" role="tabpanel" aria-labelledby={'settings-panel-tab-' + selectedPanel}>
    {error != null && <ErrorNotice error={error} />}
    {message && <p className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm" role="status">{message}</p>}

    <section hidden={selectedPanel !== 'appearance'} className="vh-settings-panel space-y-4">

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block space-y-2 text-sm"><span>{t('settings:appearance.language')}</span>
          <Select value={settings.language} onChange={(language) => update({ language })} options={[{ value: 'fa', label: t('common:languagePersian') }, { value: 'en', label: t('common:languageEnglish') }]} /></label>
        <label className="block space-y-2 text-sm"><span>{t('settings:appearance.mode')}</span>
          <Select<ThemeModeSetting> value={settings.themeMode} onChange={(themeMode) => update({ themeMode })} options={MODES.map((mode) => ({ value: mode, label: t(`settings:appearance.mode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`) }))} /></label>
        <label className="block space-y-2 text-sm"><span>{t('settings:appearance.family')}</span>
          <Select<ThemeFamily> value={settings.themeFamily} onChange={(themeFamily) => update({ themeFamily })} options={FAMILIES.map((family) => ({ value: family, label: t(`settings:appearance.families.${family}`) }))} /></label>
        <label className="block space-y-2 text-sm"><span>{t('settings:appearance.accent')}</span>
          <Select<Accent> value={settings.accent} onChange={(accent) => update({ accent })} options={ACCENTS.map((accent) => ({ value: accent, label: t(`settings:appearance.accents.${accent}`) }))} /></label>
      </div>
      <ThemeGallery />
    </section>

    <section hidden={selectedPanel !== 'terminal'} className="vh-settings-panel">{selectedPanel === 'terminal' && <TerminalPage />}</section>





    <section hidden={selectedPanel !== 'updates'} className="vh-settings-panel space-y-4">

      <div className="flex flex-wrap items-center gap-3">
        <Badge>{t('settings:updates.currentVersion')}: <bdi>{version ?? '—'}</bdi></Badge>
        <Button loading={busy === 'check'} disabled={busy !== null} onClick={() => void perform('check', async () => { setAvailableUpdate(await check()); setChecked(true); })}>
          <RefreshCw size={16} aria-hidden="true" />{t('settings:updates.checkNow')}
        </Button>
        {availableUpdate && <Button variant="primary" loading={busy === 'install'} disabled={busy !== null} onClick={() => void perform('install', async () => { await availableUpdate.downloadAndInstall(); await relaunch(); })}>
          <Download size={16} aria-hidden="true" />{t('settings:updates.downloadInstall')} <bdi>{availableUpdate.version}</bdi>
        </Button>}
      </div>
      {checked && !availableUpdate && !error && <p role="status" className="text-sm">{t('settings:updates.upToDate')}</p>}
      {availableUpdate?.body && <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-alt p-4 text-sm">{availableUpdate.body}</pre>}
      <p className="text-sm text-muted">{t('settings:updates.updatePolicy')}</p>
      <Disclosure title={t("ux:advanced")}>
        <label className="block max-w-2xl space-y-2 text-sm"><span>{t('settingsUx:feedAddress')}</span>
          <Input dir="ltr" type="url" value={settings.feedBaseUrl} onChange={(event) => update({ feedBaseUrl: event.target.value })} /></label>
        <Button loading={busy === 'sync'} disabled={busy !== null} onClick={() => void perform('sync', async () => {
          const result = await ipc.feedSync(settings.feedBaseUrl);
          setSyncDate(result.generatedAt ?? null); setMessage(t('settingsUx:contentUpdated'));
        })}>{t('settings:updates.contentCheck')}</Button>
        {syncDate && <p className="text-sm text-muted">{t('settings:updates.lastSynced')}: <bdi>{syncDate}</bdi></p>}
      </Disclosure>
      <p className="text-sm text-muted">{t('settingsUx:manualUpdates')}</p>
    </section>



    <section hidden={selectedPanel !== 'notifications'} className="vh-settings-panel space-y-4">

      <Toggle checked={settings.nativeNotifications} disabled={busy !== null} onChange={(enabled) => {
        if (!enabled) { update({ nativeNotifications: false }); return; }
        void perform('notifications', async () => {
          const granted = await isPermissionGranted() || await requestPermission() === 'granted';
          if (!granted) throw new Error(t('settingsUx:notificationPermissionDenied'));
          update({ nativeNotifications: true });
        });
      }} label={t('settings:notifications.system')} />
      <p className="text-sm leading-7 text-muted">{t('settingsUx:notificationsHint')}</p>
      <Toggle checked={settings.quietHours.enabled} disabled={busy !== null} onChange={(enabled) => update({ quietHours: { ...settings.quietHours, enabled } })} label={t('settingsUx:quietHours')} />
      {settings.quietHours.enabled && <div className="grid max-w-md grid-cols-2 gap-4">
        <label className="block space-y-2 text-sm"><span>{t('settingsUx:quietFrom')}</span><Input type="time" dir="ltr" value={settings.quietHours.from} onChange={(event) => update({ quietHours: { ...settings.quietHours, from: event.target.value } })} /></label>
        <label className="block space-y-2 text-sm"><span>{t('settingsUx:quietTo')}</span><Input type="time" dir="ltr" value={settings.quietHours.to} onChange={(event) => update({ quietHours: { ...settings.quietHours, to: event.target.value } })} /></label>
      </div>}
    </section>

    <section hidden={selectedPanel !== 'data'} className="vh-settings-panel space-y-4">

      <p className="text-sm text-muted">{t('settings:privacy.noTelemetry')}</p>
      <Link className="vh-link text-sm" to="/doctor">{t('ux:doctor')}</Link>
      <Button disabled={busy !== null} onClick={() => void perform('undo', async () => { const result = await ipc.terminalUndo(); if (!result.ok) throw new Error(result.detail); setMessage(result.detail); })}>{t('ux:terminalRestore')}</Button>
      <Button disabled={busy !== null} onClick={() => void perform('docs', async () => { await import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl('https://github.com/ahmadkhanloo/VibeHub/tree/codex/restore-tools-modern-desktop/docs/tutorials')); })}>{t('ux:externalDocs')}</Button>
      <div className="divide-y divide-border">
        <div className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="max-w-xl"><h3 className="font-semibold">{t('settings:privacy.wipeCache')}</h3><p className="mt-1 text-sm text-muted">{t('settingsUx:cacheHint')}</p></div>
          <Button disabled={busy !== null} onClick={() => { localStorage.removeItem('vibehub.content.v1'); location.reload(); }}>{t('settings:privacy.wipeCache')}</Button></div>
        <div className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="max-w-xl"><h3 className="font-semibold">{t('settingsUx:resetTitle')}</h3><p className="mt-1 text-sm text-muted">{t('settingsUx:resetHint')}</p></div>
          <Button disabled={busy !== null} onClick={() => setModal('reset')}>{t('settingsUx:resetTitle')}</Button></div>
        <div className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="max-w-xl"><h3 className="font-semibold">{t('settingsUx:clearCredentials')}</h3><p className="mt-1 text-sm text-muted">{t('settingsUx:credentialsHint')}</p></div>
          <Button variant="danger" disabled={busy !== null} onClick={() => void inspectCredentials()}>{t('settingsUx:reviewDeletion')}</Button></div>
      </div>
    </section>

    <section hidden={selectedPanel !== 'data'} className="vh-settings-panel space-y-4">

      <p className="font-semibold">{t('common:appName')} <bdi>{version ? `v${version}` : ''}</bdi></p>
      <p className="text-sm">{t('settings:about.freeOss')}</p>
      <p className="text-sm text-muted">{t('settings:about.thirdPartyNote')}</p>
      <Badge>{t('settings:about.license')}</Badge>
      <p className="text-sm text-muted">{t('settings:about.funding')}</p>
    </section>

    </div>
    <Modal open={modal === 'reset'} title={t('settingsUx:resetTitle')} onClose={() => setModal(null)}>
      <p className="text-sm leading-7">{t('settingsUx:resetConfirm')}</p>
      <div className="mt-6 flex justify-end gap-3"><Button autoFocus onClick={() => setModal(null)}>{t('common:cancel')}</Button><Button variant="danger" onClick={() => { localStorage.removeItem('vibehub.settings.v1'); location.reload(); }}>{t('settingsUx:resetTitle')}</Button></div>
    </Modal>

    <Modal open={modal === 'credentials'} title={t('settingsUx:clearCredentials')} busy={busy !== null} onClose={() => { if (!busy) setModal(null); }}>
      <div className="space-y-4">
        <p className="text-sm leading-7">{t('settingsUx:credentialsConfirm')}</p>
        {busy === 'inventory' && <p role="status">{t('common:loading')}</p>}
        {credentialError != null && <ErrorNotice error={credentialError} onRetry={() => void inspectCredentials()} />}
        {inventory && <>
          <p className="font-semibold">{t('settingsUx:selectionCount', { count: selectionCount })}</p>
          <ul className="max-h-52 list-disc space-y-2 overflow-auto rounded-lg bg-surface-alt p-4 ps-8 text-sm">
            {inventory.connections.map((connection) => <li key={connection.id}>{connection.name} <span className="text-muted">({connection.hasKey ? t('settingsUx:connectionWithKey') : t('settingsUx:connectionOnly')})</span></li>)}
            {inventory.legacyProviderIds.map((id) => <li key={id}>{LEGACY_NAMES[id] ?? id} — {t('settingsUx:legacyKey')}</li>)}
          </ul>
          {selectionCount === 0 && <p role="status">{t('settingsUx:nothingToDelete')}</p>}
        </>}
        {clearReport && clearReport.failures.length > 0 && <div role="alert" className="space-y-2 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm">
          <p>{t('settingsUx:partialDelete', { count: clearReport.deletedConnectionIds.length + clearReport.deletedLegacyProviderIds.length })}</p>
          <ul className="space-y-1">{clearReport.failures.map((failure) => <li key={`${failure.kind}:${failure.id}`}>{inventory?.connections.find((item) => item.id === failure.id)?.name ?? LEGACY_NAMES[failure.id] ?? failure.id}: {t(`settingsUx:deleteErrors.${failure.errorKey}`, { defaultValue: t('settingsUx:deleteErrors.connectionDeleteFailed') })}</li>)}</ul>
        </div>}
        <div className="flex justify-end gap-3"><Button autoFocus disabled={busy !== null} onClick={() => setModal(null)}>{t('common:cancel')}</Button>
          <Button variant="danger" loading={busy === 'clear'} disabled={busy !== null || !inventory || selectionCount === 0} onClick={() => void clearCredentials()}>{clearReport?.failures.length ? t('settingsUx:retryRemaining') : t('settingsUx:confirmDelete')}</Button></div>
      </div>
    </Modal>
  </div>;
}
