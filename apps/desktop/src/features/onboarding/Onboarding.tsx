import { Tooltip } from '@/components/Tooltip';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, RefreshCw } from 'lucide-react';
import { useSettings } from '@/app/settings';
import { Badge, Button, Card } from '@/components/ui';
import { AppLogo } from '@/components/AppLogo';
import { ipc } from '@/services/ipc';
import type { DetectedApp } from '@core';
import { apps } from '@/lib/catalog';
import vibeHubMark from '@/assets/vibehub-mark.svg';

type ScanState = 'idle' | 'loading' | 'empty' | 'error' | 'partial' | 'ready';
type Scan = { state: ScanState; apps: DetectedApp[] };

export function Onboarding() {
  const { t } = useTranslation(['journeyUx', 'common', 'onboarding']);
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);
  const [scan, setScan] = useState<Scan>({ state: 'idle', apps: [] });
  const [selected, setSelected] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  const checking = useRef(false);
  const navigate = useNavigate();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);

  const finish = (destination = '/') => {
    update({ onboardingDone: true });
    navigate(destination, { replace: true });
  };
  const check = async () => {
    if (checking.current) return;
    checking.current = true;
    setScan({ state: 'loading', apps: [] });
    const [detected, rtl] = await Promise.allSettled([ipc.detectApps(), ipc.rtlComponents()]);
    checking.current = false;
    if (!mounted.current) return;
    const foundApps = detected.status === 'fulfilled' ? detected.value.filter((app) => app.installed) : [];
    const failed = [detected, rtl].filter((outcome) => outcome.status === 'rejected').length;
    const state: ScanState = failed === 2 ? 'error' : failed ? 'partial' : foundApps.length ? 'ready' : 'empty';
    setScan({ state, apps: foundApps });
    setSelected(foundApps[0]?.id ?? '');
  };

  return (
    <main className="min-h-full bg-bg px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center gap-3">
          <img src={vibeHubMark} alt="" aria-hidden="true" className="h-10 w-10 rounded-lg" />
          <span className="text-xl font-bold">{t('common:appName')}</span>
        </div>
        <ol className="flex gap-4" aria-label={t('onboarding.stepsLabel')}>
          {(['language', 'environment', 'choose'] as const).map((name, index) => (
            <li key={name} aria-current={index === step ? 'step' : undefined} className={`flex min-w-0 flex-1 items-center gap-2 border-b-2 pb-3 text-sm ${index === step ? 'border-primary font-bold text-primary' : 'border-border text-muted'}`}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-xs" aria-hidden="true">{index < step ? <Check size={14} /> : index + 1}</span>
              {t(`onboarding.steps.${name}`)}
            </li>
          ))}
        </ol>
        <Card className="space-y-6 p-6" data-testid="onboarding-step">
          <div>
            <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold">{t(`onboarding.titles.${step}`)}</h1>
          </div>
          {step === 0 && <div className="space-y-6">
            <Tooltip text={t('onboarding:welcome.freeOss')} />
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-bold">{t('onboarding:welcome.pickLanguage')}</legend>
              <div className="flex gap-3">
                <Button aria-pressed={settings.language === 'fa'} variant={settings.language === 'fa' ? 'primary' : 'secondary'} onClick={() => update({ language: 'fa' })}>فارسی</Button>
                <Button aria-pressed={settings.language === 'en'} variant={settings.language === 'en' ? 'primary' : 'secondary'} onClick={() => update({ language: 'en' })}>English</Button>
              </div>
            </fieldset>
            <Tooltip text={[t('onboarding.appearanceLater')].join(' ')} />
          </div>}
          {step === 1 && <div className="space-y-4">
            <Tooltip text={[t('onboarding.scanScope')].join(' ')} />
            <Button loading={scan.state === 'loading'} onClick={() => void check()}><RefreshCw size={16} aria-hidden="true" />{t(scan.state === 'idle' ? 'onboarding.check' : 'onboarding.checkAgain')}</Button>
            <div data-scan-state={scan.state} role={scan.state === 'error' ? 'alert' : 'status'} className="rounded-lg border border-border bg-surface-alt p-4">
              <p className="font-medium">{t(`onboarding.scanStates.${scan.state}`)}</p>
              {(scan.state === 'ready' || scan.state === 'partial') && <p className="mt-1 text-sm text-muted">{t('onboarding.scanCount', { count: scan.apps.length })}</p>}
              {(scan.state === 'error' || scan.state === 'partial') && <p className="mt-2 text-sm text-muted">{t('onboarding.scanRecovery')}</p>}
            </div>
            {!!scan.apps.length && <ul className="divide-y divide-border">
              {scan.apps.map((found) => <li key={found.id} className="flex items-center gap-3 py-3">
                <AppLogo appId={found.id} name="" size={32} />
                <span className="flex-1">{apps.find((app) => app.id === found.id)?.name ?? found.id}</span>
                {found.version && <Badge tone="muted"><bdi>{found.version}</bdi></Badge>}
              </li>)}
            </ul>}
          </div>}
          {step === 2 && <div className="space-y-4">
            <p className="text-sm leading-7 text-muted">{t('onboarding.chooseDescription')}</p>
            {scan.apps.length ? <fieldset className="space-y-2">
              <legend className="mb-3 text-sm font-bold">{t('onboarding.installedChoices')}</legend>
              {scan.apps.map((found) => <label key={found.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${selected === found.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" name="first-tool" value={found.id} checked={selected === found.id} onChange={() => setSelected(found.id)} />
                <AppLogo appId={found.id} name="" size={32} />
                <span>{apps.find((app) => app.id === found.id)?.name ?? found.id}</span>
              </label>)}
            </fieldset> : <p className="rounded-lg border border-border bg-surface-alt p-4 text-sm">{t('onboarding.discoverHint')}</p>}
            <Button variant="primary" onClick={() => finish(selected ? `/app/${selected}` : '/discover')}>
              {selected ? t('onboarding.prepare', { name: apps.find((app) => app.id === selected)?.name ?? selected }) : t('onboarding.discover')}
              <ChevronRight size={16} aria-hidden="true" className="rtl:rotate-180" />
            </Button>
          </div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <div>{step > 0 && <Button variant="ghost" disabled={scan.state === 'loading'} onClick={() => setStep((current) => current - 1)}>{t('common:back')}</Button>}</div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => finish()}>{t('onboarding.skip')}</Button>
              {step < 2 && <Button variant="primary" disabled={scan.state === 'loading'} onClick={() => setStep((current) => current + 1)}>{t(step === 1 && scan.state === 'idle' ? 'onboarding.continueWithoutScan' : 'common:next')}</Button>}
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
