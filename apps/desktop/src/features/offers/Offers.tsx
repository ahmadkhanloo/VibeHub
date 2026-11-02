import { Disclosure } from '@/components/Disclosure';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, CheckCheck, RefreshCw } from 'lucide-react';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { Badge, Button, EmptyState, ErrorNotice, PageHeader, Toggle } from '@/components/ui';
import { classifyOffers, useCatalog } from '@/lib/catalog';
import { MarkdownContent } from '@/components/MarkdownContent';
import { ipc } from '@/services/ipc';
import { useSettings } from '@/app/settings';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { OfferView } from '@catalog';

type Tab = 'news' | 'offers';
type OfferState = 'active' | 'upcoming' | 'expired';

function readIds(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

function formatDate(value: string, lang: 'fa' | 'en') {
  const date = new Date(value);
  return Number.isNaN(+date) ? value : date.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US');
}

function freshSource(offer: OfferView) {
  const age = offer.checkedAt ? Date.now() - +new Date(offer.checkedAt) : Number.NaN;
  return offer.status === 'verified' && offer.sourceState === 'fresh' && Number.isFinite(age) && age >= 0 && age <= 48 * 3600000;
}

export function OffersPage() {
  const { t, i18n } = useTranslation(['offers', 'common']);
  const lang = i18n.resolvedLanguage?.startsWith('fa') ? 'fa' : 'en';
  const { settings, update } = useSettings();
  const catalog = useCatalog();
  const offers = useMemo(() => classifyOffers(catalog.offers), [catalog.offers]);
  const [tab, setTab] = useState<Tab>('news');
  const [offerFilter, setOfferFilter] = useState<OfferState>('active');
  const [readOffers, setReadOffers] = useState<string[]>(() => readIds('vibehub.readOffers'));
  const [readNews, setReadNews] = useState<string[]>(() => readIds('vibehub.readNews.v1'));
  const [syncing, setSyncing] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(() => {
    try { return JSON.parse(localStorage.getItem('vibehub.feed.success.v1') ?? '{}')[settings.feedBaseUrl] ?? null; }
    catch { return null; }
  });
  const [offline, setOffline] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vibehub.feed.failure.v1') ?? 'null')?.url === settings.feedBaseUrl; }
    catch { return false; }
  });
  const [error, setError] = useState<unknown>(null);
  const syncLock = useRef(false);

  useEffect(() => {
    const failed = () => setOffline(true);
    const recovered = () => setOffline(false);
    const updateStamp = () => {
      try { setLastSynced(JSON.parse(localStorage.getItem('vibehub.feed.success.v1') ?? '{}')[settings.feedBaseUrl] ?? null); }
      catch { setLastSynced(null); }
    };
    window.addEventListener('vibehub:feed-failed', failed);
    window.addEventListener('vibehub:feed-synced', recovered);
    window.addEventListener('vibehub:feed-synced', updateStamp);
    return () => {
      window.removeEventListener('vibehub:feed-failed', failed);
      window.removeEventListener('vibehub:feed-synced', recovered);
      window.removeEventListener('vibehub:feed-synced', updateStamp);
    };
  }, [settings.feedBaseUrl]);

  const sync = async () => {
    if (syncLock.current) return;
    syncLock.current = true; setSyncing(true); setError(null);
    try { await ipc.feedSync(settings.feedBaseUrl); setOffline(false); setLastSynced(new Date().toISOString()); }
    catch (cause) { setError(cause); setOffline(true); }
    finally { syncLock.current = false; setSyncing(false); }
  };
  const setRead = (key: string, values: string[], setter: (next: string[]) => void) => {
    setter(values);
    try { localStorage.setItem(key, JSON.stringify(values)); }
    catch (cause) { setError(cause); }
  };
  const markAllOffersRead = () => setRead('vibehub.readOffers', [...new Set([...readOffers, ...offers.map(offer => offer.offerId)])], setReadOffers);
  const markAllNewsRead = () => setRead('vibehub.readNews.v1', [...new Set([...readNews, ...catalog.news.map(item => `${item.id}:${item.checkedAt}`)])], setReadNews);
  const toggleNotifications = async (enabled: boolean) => {
    if (!enabled) { update({ nativeNotifications: false }); return; }
    setPermissionBusy(true); setError(null);
    try {
      const granted = await isPermissionGranted() || await requestPermission() === 'granted';
      if (!granted) throw new Error(t('notifications.permissionDenied'));
      update({ nativeNotifications: true });
    } catch (cause) { setError(cause); }
    finally { setPermissionBusy(false); }
  };

  const filteredOffers = offers.filter(offer => offer.state === offerFilter);
  const unreadNews = catalog.news.filter(item => !readNews.includes(`${item.id}:${item.checkedAt}`));
  const unreadOffers = offers.filter(offer => !readOffers.includes(offer.offerId));

  return <div className="vh-news-page space-y-5">
    <PageHeader title={t('title')} description={t('subtitle')} actions={<Button size="sm" variant="ghost" loading={syncing} disabled={syncing} onClick={() => void sync()}><RefreshCw size={16} aria-hidden="true" />{t('notifications.checkNow')}</Button>} />
    {offline && <p role="status" className="text-sm text-warning">{t('feedOffline')}</p>}
    {error != null && <ErrorNotice error={error} onRetry={() => void sync()} />}
    <div className="vh-news-meta">
      <p role="status">{lastSynced ? `${t('notifications.lastSynced')}: ${formatDate(lastSynced, lang)}` : t('lastSyncUnknown')}</p>
      <details className="vh-news-settings"><summary><BellRing size={15} aria-hidden="true" />{t('notifications.title')}</summary><div><Toggle checked={settings.nativeNotifications} disabled={permissionBusy} onChange={enabled => void toggleNotifications(enabled)} label={t('notifications.native')} /><p>{t('notifications.nativeHint')}</p></div></details>
    </div>
    <nav className="vh-news-tabs" aria-label={t('sections')}>
      <button type="button" aria-pressed={tab === 'news'} onClick={() => setTab('news')}>{t('newsTab')}<Badge tone="muted">{unreadNews.length}</Badge></button>
      <button type="button" aria-pressed={tab === 'offers'} onClick={() => setTab('offers')}>{t('offersTab')}<Badge tone="muted">{offers.length}</Badge></button>
    </nav>

    {tab === 'news' ? <section className="space-y-3" aria-label={t('newsTab')}>
      <div className="flex justify-end"><Button size="sm" variant="ghost" disabled={!unreadNews.length} onClick={markAllNewsRead}><CheckCheck size={15} aria-hidden="true" />{t('markAllRead')}</Button></div>
      {catalog.news.length ? <div className="vh-news-list">{catalog.news.map(item => {
        const key = `${item.id}:${item.checkedAt}`;
        const unread = !readNews.includes(key);
        const appName = item.appId ? catalog.apps.find(app => app.id === item.appId)?.name ?? item.appId : t('appNews');
        return <Disclosure key={item.id} title={<span className="vh-news-summary"><span><h2>{item.title[lang]}</h2><span className="vh-news-teaser">{item.summary[lang]}</span><span>{t('publishedAt')}: {formatDate(item.publishedAt, lang)}</span></span><span className="flex items-center gap-2"><span>{appName}</span>{unread && <Badge tone="primary">{t('unread')}</Badge>}</span></span>}>
          <div className="vh-news-reader">
            <MarkdownContent source={item.body[lang]} onError={setError} />
            <div><span>{t('sourceChecked')}: {formatDate(item.checkedAt, lang)}</span><button type="button" className="text-primary hover:underline" onClick={() => void openUrl(item.sourceUrl).catch(setError)}>{t('sourceUrl')}</button>{unread && <Button size="sm" variant="ghost" onClick={() => setRead('vibehub.readNews.v1', [...readNews, key], setReadNews)}>{t('markRead')}</Button>}</div>
          </div>
        </Disclosure>;
      })}</div> : <EmptyState icon={<BellRing size={24} aria-hidden="true" />} title={t('newsEmpty')} sub={t('newsEmptyHint')} />}
    </section> : <section className="space-y-3" aria-label={t('offersTab')}>
      <nav className="vh-news-filters" aria-label={t('offerStatus')}>
        {(['active', 'upcoming', 'expired'] as const).map(state => <button type="button" key={state} aria-pressed={offerFilter === state} onClick={() => setOfferFilter(state)}>{t(state)}<span>{offers.filter(offer => offer.state === state).length}</span></button>)}
      </nav>
      <div className="flex justify-end"><Button size="sm" variant="ghost" disabled={!unreadOffers.length} onClick={markAllOffersRead}><CheckCheck size={15} aria-hidden="true" />{t('markAllRead')}</Button></div>
      {filteredOffers.length ? <div className="vh-news-list">{filteredOffers.map(offer => {
        const unread = !readOffers.includes(offer.offerId);
        const fresh = freshSource(offer);
        return <Disclosure key={offer.offerId} title={<span className="vh-news-summary"><span><h2>{offer.title[lang]}</h2><span>{t(offer.state)}{offer.endAt ? ` · ${t('expires')}: ${formatDate(offer.endAt, lang)}` : ''}</span>{offer.checkedAt && <span className="vh-news-review-date">{t('sourceChecked')}: {formatDate(offer.checkedAt, lang)}</span>}</span><span className="flex flex-wrap items-center gap-2"><Badge tone={fresh ? 'success' : 'warning'}>{fresh ? t('verified') : t('reportedNeedsCheck')}</Badge>{unread && <Badge tone="primary">{t('unread')}</Badge>}</span></span>}>
          <div className="vh-news-reader">
            <p>{offer.summary[lang]}</p>
            {offer.benefit && <p><bdi>{offer.benefit.quantity ?? ''} {offer.benefit.model ?? ''}</bdi> {t('benefitUnits.' + offer.benefit.unit)}</p>}
            {offer.eligibility && <p dir="auto">{offer.eligibility}</p>}
            {offer.regionNotes && <p>{offer.regionNotes[lang]}</p>}
            {offer.claim?.required && <p>{t('manualClaim')} {offer.claim.dailyAt && <bdi>{offer.claim.dailyAt} ({offer.claim.timeZone})</bdi>}</p>}
            <p className={fresh ? 'text-success' : 'text-warning'}>{fresh ? t('sourceFresh') : t('sourceStale')}{offer.checkedAt && ` · ${formatDate(offer.checkedAt, lang)}`}</p>
            <div className="flex flex-wrap items-center gap-3"><Button size="sm" onClick={() => void openUrl(offer.claim?.url ?? offer.sourceUrl).catch(setError)}>{offer.claim ? t('claimPage') : t('sourceUrl')}<span className="ltr-tech text-xs">{new URL(offer.sourceUrl).host}</span></Button>{unread && <Button size="sm" variant="ghost" onClick={() => setRead('vibehub.readOffers', [...readOffers, offer.offerId], setReadOffers)}>{t('markRead')}</Button>}</div>
          </div>
        </Disclosure>;
      })}</div> : <EmptyState icon={<BellRing size={24} aria-hidden="true" />} title={t('offersEmpty')} sub={t('offersEmptyHint')} />}
    </section>}
  </div>;
}
