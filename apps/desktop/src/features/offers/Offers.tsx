import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, CheckCheck, RefreshCw } from 'lucide-react';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { Badge, Button, Card, EmptyState, ErrorNotice, PageHeader, Toggle } from '@/components/ui';
import { classifyOffers, useCatalog } from '@/lib/catalog';
import { ipc } from '@/services/ipc';
import { useSettings } from '@/app/settings';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { OfferView } from '@catalog';

function savedIds(key: string): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
  catch { return []; }
}
function inQuietHours(quiet: { enabled: boolean; from: string; to: string }): boolean {
  if (!quiet.enabled) return false;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const parse = (value: string) => { if (!/^\d{2}:\d{2}$/.test(value)) return null; const [hours = 0, mins = 0] = value.split(':').map(Number); return hours < 24 && mins < 60 ? hours * 60 + mins : null; };
  const start = parse(quiet.from), end = parse(quiet.to);
  if (start === null || end === null) return false;
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
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
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [retryAction, setRetryAction] = useState<'sync' | 'permission' | null>(null);
  const notifying = useRef(false);
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

  useEffect(() => {
    if (!settings.nativeNotifications || inQuietHours(settings.quietHours) || notifying.current) return;
    const notified = new Set(savedIds('vibehub.notifiedOffers.v1'));
    const pending = offers.filter((offer) => offer.status === 'verified' && offer.state === 'active' && !readIds.includes(offer.offerId) && !notified.has(`${offer.offerId}:${offer.verifiedAt}`));
    if (!pending.length) return;
    notifying.current = true;
    void (async () => {
      try {
        // An existing preference never causes a fresh permission prompt on entry.
        if (!await isPermissionGranted()) return;
        for (const offer of pending) {
          await sendNotification({ title: offer.title[lang], body: offer.summary[lang] });
          notified.add(`${offer.offerId}:${offer.verifiedAt}`);
          localStorage.setItem('vibehub.notifiedOffers.v1', JSON.stringify([...notified]));
        }
      } catch (e) { setRetryAction(null); setError(e); }
      finally { notifying.current = false; }
    })();
  }, [offers, readIds, settings.nativeNotifications, settings.quietHours, lang]);

  return <div className="space-y-6">
    <PageHeader title={t('offers:title')} description={t('offers:subtitle')} actions={<Button loading={syncing} onClick={() => void sync()}><RefreshCw size={16} aria-hidden="true" />{t('offers:notifications.checkNow')}</Button>} />
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><Toggle checked={settings.nativeNotifications} disabled={permissionBusy} onChange={(enabled) => void setNotifications(enabled)} label={t('offers:notifications.native')} /><Button size="sm" variant="ghost" disabled={!offers.some((offer) => !readIds.includes(offer.offerId))} onClick={() => markRead(offers.map((offer) => offer.offerId))}><CheckCheck size={16} aria-hidden="true" />{t('offers:markAllRead')}</Button></div>
      <p className="text-sm text-muted">{t('offers:notifications.nativeHint')}</p>
      <p role="status" className="text-xs text-muted">{lastSynced ? `${t('offers:notifications.lastSynced')}: ${new Date(lastSynced).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}` : t('journeyUx:offers.offline')}</p>
    </Card>
    {error != null && <ErrorNotice error={error} onRetry={retryAction === 'sync' ? () => void sync() : retryAction === 'permission' ? () => void setNotifications(true) : undefined} />}
    {offers.length === 0 ? <EmptyState icon={<BellRing size={24} aria-hidden="true" />} title={t('offers:empty')} /> : <div className="space-y-4">
      {offers.map((offer) => <Card key={offer.offerId} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">{offer.title[lang]}</h2>
          {!readIds.includes(offer.offerId) && <Badge tone="primary">{t('journeyUx:offers.unread')}</Badge>}
          <Badge tone={offer.status === 'verified' ? 'success' : 'warning'}>{offer.status === 'verified' ? t('offers:verified') : t('offers:reportedNeedsCheck')}</Badge>
          <Badge tone="muted">{t(`offers:${offer.state}`)}</Badge>
        </div>
        <p className="text-sm leading-7 text-muted">{offer.summary[lang]}</p>
        {offer.endAt && <p className="text-xs text-muted"><bdi>{new Date(offer.endAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</bdi></p>}
        {offer.regionNotes && <p className="text-sm text-muted">{offer.regionNotes[lang]}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => void openUrl(offer.sourceUrl).catch((e) => { setRetryAction(null); setError(e); })}>{t('offers:sourceUrl')}<span className="ltr-tech text-xs">{new URL(offer.sourceUrl).host}</span></Button>
          {!readIds.includes(offer.offerId) && <Button size="sm" variant="ghost" onClick={() => markRead([offer.offerId])}>{t('offers:markRead')}</Button>}
        </div>
      </Card>)}
    </div>}
  </div>;
}
