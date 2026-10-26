import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, Play, Plug } from 'lucide-react';
import { apps, bundledCatalog } from '@/lib/catalog';
import { Badge, Button, Card, EmptyState, SectionTitle, VerificationBadge } from '@/components/ui';
import { ipc, type LaunchOutcome } from '@/services/ipc';
import type { DetectedApp, ProxyTestResult } from '@core';

export function HomePage() {
  const { t, i18n } = useTranslation(['home', 'common', 'apps']);
  const lang = i18n.language === 'fa' ? 'fa' : 'en';
  const navigate = useNavigate();
  const [detected, setDetected] = useState<DetectedApp[]>([]);
  const [proxyState, setProxyState] = useState<'ok' | 'fail' | 'unknown'>('unknown');
  const [launching, setLaunching] = useState<string | null>(null);
  const [launchMsg, setLaunchMsg] = useState<string | null>(null);

  useEffect(() => {
    void ipc.detectApps().then(setDetected).catch(() => setDetected([]));
    void ipc
      .proxyTest({ id: 'global', name: '', mode: 'direct' }, 'tcp')
      .then((r: ProxyTestResult) => setProxyState('ok'))
      .catch(() => setProxyState('unknown'));
  }, []);

  const installed = detected.filter((d) => d.installed);
  const featured = apps.filter((a) => a.freeAccess === 'free_tier' || a.freeAccess === 'free_forever' || a.freeAccess === 'ad_supported').slice(0, 4);

  const quickLaunch = async (appId: string, rtl: boolean) => {
    setLaunching(appId);
    setLaunchMsg(null);
    try {
      const out: LaunchOutcome = await ipc.launchApp({ appId, rtl });
      setLaunchMsg(out.detail || (out.ok ? t('common:running') : t('common:failed')));
    } catch (e) {
      setLaunchMsg(String(e));
    } finally {
      setLaunching(null);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">{t('home:headerTitle')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t('home:headerSub')}</p>
      </section>

      <section>
        <SectionTitle>{t('home:quickLaunch')}</SectionTitle>
        {installed.length === 0 ? (
          <EmptyState icon={<Compass size={22} />} title={t('home:quickLaunchEmpty')} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {installed.map((d) => {
              const app = apps.find((a) => a.id === d.id);
              const rtlOk = app?.capabilities.rtl === 'verified';
              return (
                <Card key={d.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{app?.name ?? d.id}</span>
                    {d.version && <Badge tone="muted">{d.version}</Badge>}
                  </div>
                  <div className="flex gap-2">
                    {rtlOk && (
                      <Button size="sm" variant="primary" loading={launching === d.id} onClick={() => void quickLaunch(d.id, true)}>
                        <Play size={13} /> {t('common:launchRtl')}
                      </Button>
                    )}
                    <Button size="sm" loading={launching === `${d.id}-plain`} onClick={() => void quickLaunch(d.id, false)}>
                      <Play size={13} /> {t('common:launch')}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {launchMsg && <p className="mt-2 text-sm text-muted">{launchMsg}</p>}
      </section>

      <section>
        <SectionTitle action={<Link to="/discover" className="flex items-center gap-1 text-sm text-primary"><ArrowRight size={14} className="rtl:rotate-180" />{t('home:openDiscover')}</Link>}>
          {t('home:featured')}
        </SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((app) => (
            <Link key={app.id} to={`/app/${app.id}`} className="block">
              <Card className="h-full transition-colors hover:border-primary/50">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">{app.name}</span>
                  {app.isOpenSource === true && <Badge tone="success">OSS</Badge>}
                </div>
                <p className="line-clamp-2 min-h-[2.5rem] text-xs text-muted">{app.summary[lang]}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <Badge tone="primary">{t(`apps:card.freeAccess`)}</Badge>
                  <VerificationBadge status={app.capabilities.rtl} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <SectionTitle>{t('home:recommendedSetup')}</SectionTitle>
          <p className="text-sm text-muted">{t('home:recommendedSetupBody')}</p>
        </Card>
        <Card>
          <SectionTitle>{t('home:proxyStatus')}</SectionTitle>
          <div className="flex items-center gap-3">
            <Plug size={18} className={proxyState === 'ok' ? 'text-success' : 'text-muted'} />
            <Badge tone={proxyState === 'ok' ? 'success' : 'muted'}>{proxyState === 'ok' ? t('common:pass') : t('common:unknown')}</Badge>
            <Button size="sm" variant="ghost" onClick={() => navigate('/proxy')}>
              {t('nav:proxy', { ns: 'nav' })}
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted">{bundledCatalog.offers.length === 0 ? t('home:noOffers') : t('home:offersTeaser')}</p>
        </Card>
      </section>
    </div>
  );
}
