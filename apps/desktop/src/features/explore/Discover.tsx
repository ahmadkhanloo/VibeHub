import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { filterApps } from '@catalog';
import { apps as allApps, providers } from '@/lib/catalog';
import { Badge, Card, EmptyState, Input, Select, Toggle, VerificationBadge } from '@/components/ui';
import type { FreeAccess } from '@core';
import { ipc } from '@/services/ipc';

export function DiscoverPage() {
  const { t, i18n } = useTranslation(['apps', 'common']);
  const lang = i18n.language === 'fa' ? 'fa' : 'en';
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [openSourceOnly, setOpenSourceOnly] = useState(false);
  const [freeAccess, setFreeAccess] = useState<'all' | FreeAccess>('all');
  const [guiCli, setGuiCli] = useState<'all' | 'gui' | 'cli'>('all');
  const [rtlVerified, setRtlVerified] = useState(false);
  const [tab, setTab] = useState<'all' | 'ide' | 'cli' | 'providers' | 'installed'>('all');
  const [installedIds, setInstalledIds] = useState<string[]>([]);

  // Detection happens on demand to keep browse instant offline.
  useEffect(() => {
    void ipc.detectApps()
      .then((d) => setInstalledIds(d.filter((x) => x.installed).map((x) => x.id)))
      .catch(() => undefined);
  }, []);

  const results = useMemo(
    () =>
      filterApps({ apps: allApps, providers: [], offers: [] }, {
        query,
        openSourceOnly,
        freeAccess,
        guiCli,
        rtlVerified,
        installedIds,
        installedOnly: tab === 'installed',
      }).filter((a) => (tab === 'ide' ? a.kind !== 'cli_agent' : tab === 'cli' ? a.kind === 'cli_agent' : true)),
    [query, openSourceOnly, freeAccess, guiCli, rtlVerified, tab, installedIds]
  );

  const count = tab === 'providers' ? providers.length : results.length;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">{t('apps:title')}</h1>

      <div className="flex flex-wrap items-center gap-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common:searchPlaceholder')} className="max-w-xs flex-1" />
        <Select value={freeAccess} onChange={setFreeAccess} options={[
          { value: 'all', label: t('apps:allAccess') },
          { value: 'free_forever', label: t('apps:freeForever') },
          { value: 'free_tier', label: t('apps:freeTier') },
          { value: 'trial', label: t('apps:trial') },
          { value: 'ad_supported', label: t('apps:adSupported') },
          { value: 'unknown', label: t('apps:unknownAccess') },
        ]} />
        <Select value={guiCli} onChange={setGuiCli} options={[
          { value: 'all', label: t('apps:allKinds') },
          { value: 'gui', label: t('apps:guiOnly') },
          { value: 'cli', label: t('apps:cliOnly') },
        ]} />
        <Toggle checked={openSourceOnly} onChange={setOpenSourceOnly} label={t('apps:openSourceOnly')} />
        <Toggle checked={rtlVerified} onChange={setRtlVerified} label={t('apps:rtlVerified')} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['all', 'ide', 'cli', 'providers', 'installed'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 pb-2 text-sm ${tab === k ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
          >
            {t(`apps:tabs.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'providers' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {providers.map((p) => (
            <Link key={p.id} to="/models">
              <Card className="h-full transition-colors hover:border-primary/50">
                <div className="font-semibold">{p.name}</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{p.notes[lang]}</p>
                <div className="mt-2 flex gap-1.5">
                  <Badge tone="primary">{t(`apps:${p.freeAccess === 'free_forever' ? 'freeForever' : 'freeTier'}`)}</Badge>
                  {p.requiresApiKey && <Badge tone="muted">API key</Badge>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState title={t('apps:noResults')} />
      ) : (
        <>
          <p className="text-xs text-muted">{t('apps:resultsMany', { count })}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((app) => (
              <Link key={app.id} to={`/app/${app.id}`}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="font-semibold">{app.name}</span>
                    {installedIds.includes(app.id) && <Badge tone="success">{t('common:running')}</Badge>}
                  </div>
                  <p className="line-clamp-2 min-h-[2.5rem] text-xs text-muted">{app.summary[lang]}</p>
                  <div className="mt-3 space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted">{t('apps:card.freeAccess')}:</span>
                      <Badge tone="primary">
                        {t(`apps:${app.freeAccess === 'free_forever' ? 'freeForever' : app.freeAccess === 'free_tier' ? 'freeTier' : app.freeAccess === 'ad_supported' ? 'adSupported' : app.freeAccess === 'trial' ? 'trial' : 'unknown'}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted">{t('apps:card.license')}:</span>
                      {app.isOpenSource === true ? (
                        <Badge tone="success">{app.licenseSpdx ?? t('apps:card.openSource')}</Badge>
                      ) : app.isOpenSource === false ? (
                        <Badge tone="warning">{t('apps:card.proprietary')}</Badge>
                      ) : (
                        <Badge tone="muted">{t('apps:card.licenseUnknown')}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted">RTL:</span>
                      <VerificationBadge status={app.capabilities.rtl} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
