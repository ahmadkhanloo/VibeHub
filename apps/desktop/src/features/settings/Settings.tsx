import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, Input, SectionTitle, Select, Toggle } from '@/components/ui';
import { useSettings, type Accent, type ThemeFamily, type ThemeModeSetting } from '@/app/settings';
import { ipc, type FeedSyncResult } from '@/services/ipc';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const FAMILIES: ThemeFamily[] = ['graphite', 'nord', 'catppuccin', 'solarized'];
const MODES: ThemeModeSetting[] = ['system', 'light', 'dark'];
const ACCENTS: Accent[] = ['auto', 'indigo', 'emerald', 'violet', 'amber'];

function ThemeGallery() {
  const { t } = useTranslation('settings');
  const { settings, update, resolvedMode } = useSettings();
  return (
    <div className="space-y-3">
      <SectionTitle>{t('settings:appearance.gallery')}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FAMILIES.flatMap((family) =>
          MODES.filter((m) => m !== 'system').map((mode) => {
            const active = settings.themeFamily === family && settings.themeMode === mode;
            return (
              <button
                key={`${family}-${mode}`}
                type="button"
                onClick={() => update({ themeFamily: family, themeMode: mode })}
                data-theme={family}
                data-mode={mode}
                data-accent={settings.accent}
                className={`rounded-[12px] border p-3 text-start transition-colors ${active ? 'border-primary' : 'border-border hover:border-primary/50'}`}
                style={{ background: 'var(--surface)', color: 'var(--text)' }}
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: 'var(--primary)' }} />
                  <span className="h-3 w-3 rounded-full" style={{ background: 'var(--bg)' }} />
                  <span className="h-3 w-3 rounded-full" style={{ background: 'var(--success)' }} />
                </div>
                <div className="text-xs font-medium">
                  {t(`settings:appearance.families.${family}`)} · {mode === 'dark' ? '🌙' : '☀️'}
                </div>
                <div className="mt-1 h-1.5 w-8 rounded" style={{ background: 'var(--border)' }} />
              </button>
            );
          })
        )}
      </div>
      <p className="text-xs text-muted">
        resolved mode: {resolvedMode} ({settings.themeMode})
      </p>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation(['settings', 'common']);
  const { settings, update } = useSettings();
  const [updateState, setUpdateState] = useState<{ checking: boolean; version?: string; available?: { version: string; body?: string }; err?: string }>({ checking: false });
  const [syncState, setSyncState] = useState<string | null>(null);

  const checkUpdates = async () => {
    setUpdateState({ checking: true });
    try {
      const result = await check();
      setUpdateState({ checking: false, available: result ? { version: result.version, body: result.body } : undefined });
    } catch (e) {
      setUpdateState({ checking: false, err: String(e) });
    }
  };

  const installUpdate = async () => {
    const result = await check();
    if (!result) return;
    await result.downloadAndInstall();
    await relaunch();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('settings:title')}</h1>

      <Card className="space-y-4">
        <SectionTitle>{t('settings:appearance.title')}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm"><span className="text-muted">{t('settings:appearance.language')}</span>
            <Select value={settings.language} onChange={(v) => update({ language: v })} options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]} /></label>
          <label className="space-y-1 text-sm"><span className="text-muted">{t('settings:appearance.mode')}</span>
            <Select<ThemeModeSetting> value={settings.themeMode} onChange={(v) => update({ themeMode: v })}
              options={MODES.map((m) => ({ value: m, label: t(`settings:appearance.mode${m.charAt(0).toUpperCase()}${m.slice(1)}`) }))} /></label>
          <label className="space-y-1 text-sm"><span className="text-muted">{t('settings:appearance.family')}</span>
            <Select<ThemeFamily> value={settings.themeFamily} onChange={(v) => update({ themeFamily: v })}
              options={FAMILIES.map((f) => ({ value: f, label: t(`settings:appearance.families.${f}`) }))} /></label>
          <label className="space-y-1 text-sm"><span className="text-muted">{t('settings:appearance.accent')}</span>
            <Select<Accent> value={settings.accent} onChange={(v) => update({ accent: v })}
              options={ACCENTS.map((a) => ({ value: a, label: t(`settings:appearance.accents.${a}`) }))} /></label>
        </div>
      </Card>

      <Card><ThemeGallery /></Card>

      <Card className="space-y-3">
        <SectionTitle>{t('settings:updates.title')}</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Button loading={updateState.checking} onClick={() => void checkUpdates()}><RefreshCw size={14} /> {t('settings:updates.checkNow')}</Button>
          {updateState.available && (
            <>
              <Badge tone="success">{t('settings:updates.newVersion')}: {updateState.available.version}</Badge>
              <Button variant="primary" onClick={() => void installUpdate()}><Download size={14} /> {t('settings:updates.downloadInstall')}</Button>
            </>
          )}
          {!updateState.available && updateState.checking === false && !updateState.err && <Badge tone="muted">{t('settings:updates.currentVersion')}: {updateState.version ?? '—'}</Badge>}
          {updateState.err && <span className="text-xs text-warning">{t('errors:offlineFeed', { ns: 'errors' })}</span>}
        </div>
        {updateState.available?.body && <pre className="ltr-tech max-h-40 overflow-auto whitespace-pre-wrap rounded-[10px] border border-border bg-surface-alt p-2 text-xs">{updateState.available.body}</pre>}
        <p className="text-xs text-muted">{t('settings:updates.updatePolicy')}</p>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <Button loading={syncState === 'busy'} onClick={async () => {
            setSyncState('busy');
            try {
              const r: FeedSyncResult = await ipc.feedSync(settings.feedBaseUrl);
              setSyncState(r.ok ? r.generatedAt ?? 'ok' : r.detail);
            } catch (e) { setSyncState(String(e)); }
          }}>{t('settings:updates.contentCheck')}</Button>
          {syncState && syncState !== 'busy' && <Badge tone="muted">{t('settings:updates.lastSynced')}: {syncState.slice(0, 16)}</Badge>}
          <Input value={settings.feedBaseUrl} onChange={(e) => update({ feedBaseUrl: e.target.value })} className="max-w-md" />
        </div>
        <Toggle checked={settings.autoUpdateCheck} onChange={(v) => update({ autoUpdateCheck: v })} label={t('settings:updates.autoCheck')} />
      </Card>

      <Card className="space-y-3">
        <SectionTitle>{t('settings:notifications.title')}</SectionTitle>
        <Toggle checked={settings.nativeNotifications} onChange={(v) => update({ nativeNotifications: v })} label={t('settings:notifications.system')} />
        <Toggle checked={settings.quietHours.enabled} onChange={(v) => update({ quietHours: { ...settings.quietHours, enabled: v } })} label={t('offers:notifications.quietHours', { ns: 'offers' })} />
        {settings.quietHours.enabled && (
          <div className="flex items-center gap-2 text-sm">
            <Input type="time" value={settings.quietHours.from} onChange={(e) => update({ quietHours: { ...settings.quietHours, from: e.target.value } })} />
            <span className="text-muted">→</span>
            <Input type="time" value={settings.quietHours.to} onChange={(e) => update({ quietHours: { ...settings.quietHours, to: e.target.value } })} />
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>{t('settings:privacy.title')}</SectionTitle>
        <Toggle checked={false} disabled onChange={() => undefined} label={t('settings:privacy.diagnostics')} />
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => { localStorage.clear(); location.reload(); }}>{t('settings:privacy.wipeCache')}</Button>
          <Button variant="danger" onClick={async () => { for (const p of ['nvidia-build', 'openrouter', 'custom-openai-compatible']) await ipc.vaultDelete(`vibehub.provider-key.${p}`); }}>
            {t('settings:privacy.clearCredentials')}
          </Button>
        </div>
        <p className="text-xs text-muted">{t('settings:privacy.noTelemetry')}</p>
      </Card>

      <Card className="space-y-2">
        <SectionTitle>{t('settings:about.title')}</SectionTitle>
        <p className="text-sm font-medium">{t('settings:about.freeOss')}</p>
        <p className="text-sm text-muted">{t('settings:about.thirdPartyNote')}</p>
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <Badge tone="success">{t('settings:about.license')}</Badge>
          <Badge tone="muted">github.com/ahmadkhanloo/VibeHub</Badge>
        </div>
        <p className="text-xs text-muted">{t('settings:about.funding')}</p>
      </Card>
    </div>
  );
}
