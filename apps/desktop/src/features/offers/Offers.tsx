import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, CheckCheck, RefreshCw } from 'lucide-react';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { Badge, Button, Card, EmptyState, SectionTitle, Toggle } from '@/components/ui';
import { classifyOffers, bundledCatalog } from '@/lib/catalog';
import { ipc, type FeedSyncResult } from '@/services/ipc';
import { useSettings } from '@/app/settings';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { OfferView } from '@catalog';

export function OffersPage() {
  const { t, i18n } = useTranslation(['offers', 'common']);
  const lang = i18n.language === 'fa' ? 'fa' : 'en';
  const { settings, update } = useSettings();
  const [offers, setOffers] = useState<OfferView[]>(() => classifyOffers(bundledCatalog.offers));
  const [readIds, setReadIds] = useState<string[]>(() => JSON.parse(localStorage.getItem('vibehub.readOffers') ?? '[]'));
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const markRead = (id: string) => {
    const next = [...new Set([...readIds, id])];
    setReadIds(next);
    localStorage.setItem('vibehub.readOffers', JSON.stringify(next));
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const r: FeedSyncResult = await ipc.feedSync(settings.feedBaseUrl);
      if (r.catalog) setOffers(classifyOffers(r.catalog.offers));
      setLastSynced(r.generatedAt ?? new Date().toISOString());
    } catch {
      /* offline: keep bundled */
    } finally {
      setSyncing(false);
    }
  };

  const notify = async (title: string, body: string) => {
    if (!settings.nativeNotifications) return;
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
    if (granted) sendNotification({ title, body });
  };

  useEffect(() => {
    const activeVerified = offers.filter((o) => o.status === 'verified' && o.state === 'active' && !readIds.includes(o.offerId));
    if (activeVerified[0]) void notify(activeVerified[0].title[lang], activeVerified[0].summary[lang]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t('offers:title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('offers:subtitle')}</p>
        </div>
        <Button loading={syncing} onClick={() => void sync()}><RefreshCw size={13} /> {t('offers:notifications.checkNow')}</Button>
      </div>

      <Card className="flex flex-wrap items-center gap-4">
        <Toggle checked={settings.nativeNotifications} onChange={(v) => update({ nativeNotifications: v })} label={t('offers:notifications.native')} />
        <span className="text-xs text-muted">{t('offers:notifications.nativeHint')}</span>
        {lastSynced && <Badge tone="muted">{t('offers:notifications.lastSynced')}: {lastSynced.slice(0, 16).replace('T', ' ')}</Badge>}
        <Button size="sm" variant="ghost" onClick={() => { const all = offers.map((o) => o.offerId); setReadIds(all); localStorage.setItem('vibehub.readOffers', JSON.stringify(all)); }}>
          <CheckCheck size={13} /> {t('offers:markAllRead')}
        </Button>
      </Card>

      {offers.length === 0 ? (
        <EmptyState icon={<BellRing size={22} />} title={t('offers:empty')} />
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const unread = !readIds.includes(offer.offerId);
            return (
              <Card key={offer.offerId} className={offer.state === 'expired' ? 'opacity-60' : ''}>
                <div className="flex flex-wrap items-center gap-2">
                  {unread && <span className="h-2 w-2 rounded-full bg-primary" />}
                  <span className="font-semibold">{offer.title[lang]}</span>
                  <Badge tone={offer.status === 'verified' ? 'success' : 'warning'}>
                    {offer.status === 'verified' ? t('offers:verified') : t('offers:reportedNeedsCheck')}
                  </Badge>
                  <Badge tone="muted">{t(`common:${offer.state}`)}</Badge>
                  {offer.endAt && <span className="text-[11px] text-muted">→ {offer.endAt}</span>}
                  {unread && <button type="button" className="text-xs text-primary hover:underline" onClick={() => markRead(offer.offerId)}>{t('offers:markRead')}</button>}
                </div>
                <p className="mt-1 text-sm text-muted">{offer.summary[lang]}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <button className="text-primary hover:underline" onClick={() => void openUrl(offer.sourceUrl)}>
                    <span className="ltr-tech">{new URL(offer.sourceUrl).host}</span>
                  </button>
                  {offer.regionNotes && <span className="text-muted">{offer.regionNotes[lang]}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
