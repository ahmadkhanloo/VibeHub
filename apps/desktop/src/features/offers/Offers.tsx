import { Tooltip } from '@/components/Tooltip';
import { Disclosure } from '@/components/Disclosure';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, CheckCheck, RefreshCw } from 'lucide-react';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { Badge, Button, EmptyState, ErrorNotice, PageHeader, Toggle } from '@/components/ui';
import { classifyOffers, useCatalog } from '@/lib/catalog';
import { ipc } from '@/services/ipc';
import { useSettings } from '@/app/settings';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { OfferView } from '@catalog';

function savedIds(key: string): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
  catch { return []; }
}
export function OffersPage() {
  const { t, i18n } = useTranslation(['offers', 'common', 'journeyUx']);
  const lang = i18n.language.startsWith('fa') ? 'fa' : 'en';
  const { settings, update } = useSettings();
  const catalog = useCatalog();
  const [offers, setOffers] = useState<OfferView[]>(() => classifyOffers(catalog.offers));
  const [readIds, setReadIds] = useState<string[]>(() => savedIds('vibehub.readOffers'));
  const [syncing, setSyncing] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const lastSync = () => { try { const stamp = JSON.parse(localStorage.getItem('vibehub.feed.success.v1') ?? '{}')[settings.feedBaseUrl]; return stamp ? new Date(stamp).toISOString() : null; } catch { return null; } };
  const [lastSynced, setLastSynced] = useState<string | null>(lastSync);
  const [offline, setOffline] = useState(() => { try { return JSON.parse(localStorage.getItem('vibehub.feed.failure.v1') ?? 'null')?.url === settings.feedBaseUrl; } catch { return false; } });
  useEffect(() => {
    const failed = () => setOffline(true), recovered = () => setOffline(false);
    window.addEventListener('vibehub:feed-failed', failed); window.addEventListener('vibehub:feed-synced', recovered);
    return () => { window.removeEventListener('vibehub:feed-failed', failed); window.removeEventListener('vibehub:feed-synced', recovered); };
  }, [settings.feedBaseUrl]);
  useEffect(() => { const update = () => setLastSynced(lastSync()); window.addEventListener('vibehub:feed-synced', update); return () => window.removeEventListener('vibehub:feed-synced', update); }, [settings.feedBaseUrl]);
  const [error, setError] = useState<unknown>(null);
  const [retryAction, setRetryAction] = useState<'sync' | 'permission' | null>(null);
  const syncLock = useRef(false);

  useEffect(() => {
    setOffers(classifyOffers(catalog.offers));
  }, [catalog]);
  const markRead = (ids: string[]) => {
    const next = [...new Set([...readIds, ...ids])];
    setReadIds(next);
    try { localStorage.setItem('vibehub.readOffers', JSON.stringify(next)); } catch (e) { setRetryAction(null); setError(e); }
  };
  const sync = async () => {
    if (syncLock.current) return;
    syncLock.current = true; setSyncing(true); setError(null);
    try {
      const result = await ipc.feedSync(settings.feedBaseUrl);
      if (result.catalog) setOffers(classifyOffers(result.catalog.offers));
      setLastSynced(new Date().toISOString());
    } catch (e) { setRetryAction('sync'); setError(e); }
    finally { syncLock.current = false; setSyncing(false); }
  };
  const setNotifications = async (enabled: boolean) => {
    if (!enabled) { update({ nativeNotifications: false }); return; }
    setPermissionBusy(true); setError(null);
    try {
      const granted = await isPermissionGranted() || await requestPermission() === 'granted';
      if (!granted) throw new Error(t('journeyUx:offers.notificationError'));
      update({ nativeNotifications: true });
    } catch (e) { setRetryAction('permission'); setError(e); }
    finally { setPermissionBusy(false); }
  };


  return <div className="space-y-6">
    <PageHeader title={t('offers:title')} actions={<Button loading={syncing} onClick={() => void sync()}><RefreshCw size={16} aria-hidden="true" />{t('offers:notifications.checkNow')}</Button>} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><Toggle checked={settings.nativeNotifications} disabled={permissionBusy} onChange={(enabled) => void setNotifications(enabled)} label={t('offers:notifications.native')} /><Button size="sm" variant="ghost" disabled={!offers.some((offer) => !readIds.includes(offer.offerId))} onClick={() => markRead(offers.map((offer) => offer.offerId))}><CheckCheck size={16} aria-hidden="true" />{t('offers:markAllRead')}</Button></div>
      <Tooltip text={t('offers:notifications.nativeHint')} />
      <p role="status" className="text-xs text-muted">{lastSynced ? `${t('offers:notifications.lastSynced')}: ${new Date(lastSynced).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}` : t('journeyUx:offers.offline')}</p>
    </div>
    {offline && <p role="status" className="text-sm text-warning">{t('offers:feedOffline')}</p>}
    {error != null && <ErrorNotice error={error} onRetry={retryAction === 'sync' ? () => void sync() : retryAction === 'permission' ? () => void setNotifications(true) : undefined} />}
    {offers.length === 0 ? <EmptyState icon={<BellRing size={24} aria-hidden="true" />} title={t('offers:empty')} /> : <div className="space-y-4">
      {offers.map((offer, index) => <Disclosure key={offer.offerId} defaultOpen={index === 0} title={<span className="space-y-1"><h2 className="font-semibold">{offer.title[lang]}</h2><span className="block text-xs text-muted">{offer.checkedAt ? `${t('offers:sourceChecked')}: ${new Date(offer.checkedAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}` : t('offers:reportedNeedsCheck')}{offer.sourceState === 'stale' || offer.sourceState === 'unavailable' ? ` · ${t('offers:sourceStale')}` : ''}</span></span>}>
        <div className="flex flex-wrap items-center gap-2">
          {!readIds.includes(offer.offerId) && <Badge tone="primary">{t('journeyUx:offers.unread')}</Badge>}
          <Badge tone={offer.status === 'verified' && offer.sourceState !== 'stale' ? 'success' : 'warning'}>{offer.status === 'verified' && offer.sourceState !== 'stale' ? t('offers:verified') : t('offers:reportedNeedsCheck')}</Badge>
          <Badge tone="muted">{t(`offers:${offer.state}`)}</Badge>
        </div>
        <p className="text-sm leading-7 text-muted">{offer.summary[lang]}</p>
        {offer.benefit && <p className="text-sm"><bdi>{offer.benefit.quantity ?? ''} {offer.benefit.model ?? ''}</bdi> {t('offers:benefitUnits.' + offer.benefit.unit)}</p>}
        {offer.eligibility && <p className="text-sm text-muted" dir="auto">{offer.eligibility}</p>}
        {offer.claim?.required && <p className="text-sm text-muted">{t('offers:manualClaim')} {offer.claim.dailyAt && <bdi>{offer.claim.dailyAt} ({offer.claim.timeZone})</bdi>}</p>}
        {offer.checkedAt && <p className="text-xs text-muted">{t('offers:sourceChecked')}: <bdi>{new Date(offer.checkedAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</bdi></p>}
        {(offer.sourceState === 'stale' || offer.sourceState === 'unavailable' || (offer.checkedAt && Date.now() - +new Date(offer.checkedAt) > 48 * 3600000)) && <p role="status" className="text-sm text-warning">{t('offers:sourceStale')}</p>}
        {offer.claim && <Button size="sm" onClick={() => void openUrl(offer.claim!.url).catch(setError)}>{t('offers:claimPage')}</Button>}
        {offer.endAt && <p className="text-xs text-muted"><bdi>{new Date(offer.endAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</bdi></p>}
        {offer.regionNotes && <p className="text-sm text-muted">{offer.regionNotes[lang]}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => void openUrl(offer.sourceUrl).catch((e) => { setRetryAction(null); setError(e); })}>{t('offers:sourceUrl')}<span className="ltr-tech text-xs">{new URL(offer.sourceUrl).host}</span></Button>
          {!readIds.includes(offer.offerId) && <Button size="sm" variant="ghost" onClick={() => markRead([offer.offerId])}>{t('offers:markRead')}</Button>}
        </div>
      </Disclosure>)}
    </div>}
  </div>;
}
