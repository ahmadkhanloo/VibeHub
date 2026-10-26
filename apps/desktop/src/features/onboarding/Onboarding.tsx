import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Rocket } from 'lucide-react';
import { useSettings, type Accent, type ThemeFamily, type ThemeModeSetting } from '@/app/settings';
import { Badge, Button, Card, Select } from '@/components/ui';
import { ipc } from '@/services/ipc';
import type { DetectedApp } from '@core';

const STEPS = 4;

export function Onboarding() {
  const { t } = useTranslation('onboarding');
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);
  const [scan, setScan] = useState<{ running: boolean; found: DetectedApp[] }>({ running: false, found: [] });
  const navigate = useNavigate();

  const finish = () => {
    update({ onboardingDone: true });
    navigate('/', { replace: true });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-bg p-6">
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">V</div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <Card className="w-full max-w-xl">
        <div className="mb-4 flex gap-1.5">
          {Array.from({ length: STEPS }, (_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t('welcome.title')}</h2>
            <p className="text-sm text-muted">{t('welcome.freeOss')}</p>
            <div>
              <div className="mb-1 text-sm font-medium">{t('welcome.pickLanguage')}</div>
              <div className="flex gap-2">
                <Button variant={settings.language === 'fa' ? 'primary' : 'secondary'} onClick={() => update({ language: 'fa' })}>
                  فارسی
                </Button>
                <Button variant={settings.language === 'en' ? 'primary' : 'secondary'} onClick={() => update({ language: 'en' })}>
                  English
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t('appearance.title')}</h2>
            <p className="text-sm text-muted">{t('appearance.sub')}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-muted">Mode</span>
                <Select<ThemeModeSetting>
                  value={settings.themeMode}
                  onChange={(v) => update({ themeMode: v })}
                  options={[
                    { value: 'system', label: 'System' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted">Theme</span>
                <Select<ThemeFamily>
                  value={settings.themeFamily}
                  onChange={(v) => update({ themeFamily: v })}
                  options={[
                    { value: 'graphite', label: 'Graphite' },
                    { value: 'nord', label: 'Nord' },
                    { value: 'catppuccin', label: 'Catppuccin' },
                    { value: 'solarized', label: 'Solarized' },
                  ]}
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Accent</span>
              <Select<Accent>
                value={settings.accent}
                onChange={(v) => update({ accent: v })}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'indigo', label: 'Indigo' },
                  { value: 'emerald', label: 'Emerald' },
                  { value: 'violet', label: 'Violet' },
                  { value: 'amber', label: 'Amber' },
                ]}
              />
            </label>
            <p className="rounded-[10px] border border-border bg-surface-alt p-3 text-sm">{t('appearance.vazirSample')}</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t('environment.title')}</h2>
            <p className="text-sm text-muted">{t('environment.sub')}</p>
            <Button
              loading={scan.running}
              onClick={async () => {
                setScan({ running: true, found: [] });
                try {
                  const found = await ipc.detectApps();
                  setScan({ running: false, found });
                } catch {
                  setScan({ running: false, found: [] });
                }
              }}
            >
              {scan.running ? t('environment.scanning') : t('environment.scan')}
            </Button>
            {!!scan.found.length && (
              <div className="space-y-1">
                <div className="text-sm font-medium">{t('environment.found')}</div>
                {scan.found.filter((d) => d.installed).map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={15} className="text-success" />
                    {d.id}
                    {d.version && <Badge tone="muted">{d.version}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t('ready.title')}</h2>
            <p className="text-sm text-muted">{t('ready.sub')}</p>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={() => (step === 0 ? finish() : setStep((s) => s - 1))}>
            {step === 0 ? t('common:skip', { ns: 'common' }) : t('common:back', { ns: 'common' })}
          </Button>
          {step < STEPS - 1 ? (
            <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
              {t('common:next', { ns: 'common' })}
            </Button>
          ) : (
            <Button variant="primary" onClick={finish}>
              <Rocket size={15} /> {t('ready.finish')}
            </Button>
          )}
        </div>
      </Card>

      <button type="button" onClick={finish} className="text-sm text-muted underline-offset-4 hover:underline">
        {t('common:skip', { ns: 'common' })}
      </button>
    </div>
  );
}
