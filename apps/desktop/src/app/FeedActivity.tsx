import { useEffect } from 'react';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { useSettings } from './settings';
import { useCatalog, classifyOffers } from '@/lib/catalog';
import { ipc } from '@/services/ipc';
import { notificationEvents } from '@core';

export function FeedActivity() {
  const { settings } = useSettings();
  const { offers } = useCatalog();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      let last = 0;
      try { last = JSON.parse(localStorage.getItem('vibehub.feed.success.v1') ?? '{}')[settings.feedBaseUrl] ?? 0; } catch { /* Retry invalid cache. */ }
      if (!Number.isFinite(last) || Date.now() - last >= 15 * 60000) void ipc.feedSync(settings.feedBaseUrl).catch(() => { /* The IPC service retains cached content and records the failure. */ });
    };
    refresh(); window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 15 * 60000);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [settings.feedBaseUrl]);
  useEffect(() => {
    let busy = false, disposed = false;
    const notify = async () => {
      if (!settings.nativeNotifications || busy) return;
      busy = true;
      try {
        let sent: string[] = []; try { sent = JSON.parse(localStorage.getItem('vibehub.notifiedOffers.v2') ?? '[]'); if (!Array.isArray(sent)) sent = []; } catch { /* Corrupt notification cache. */ }
        const events = notificationEvents(classifyOffers(offers), new Date(), settings.quietHours);
        const announced = new Set<string>();
        for (const event of events) {
          if (disposed || sent.includes(event.key)) continue;
          const lang = settings.language;
          if (!announced.has(event.offer.offerId)) await sendNotification({ title: event.offer.title[lang], body: event.kind === 'expiry' ? (lang === 'fa' ? 'مهلت این آفر رو به پایان است.' : 'This offer expires soon.') : event.kind === 'claim' ? (lang === 'fa' ? 'پنجرهٔ دریافت روزانه باز است؛ وضعیت دریافت را در اپ اصلی بررسی کنید.' : 'The daily claim window is open. Check the original app for claim status.') : event.offer.summary[lang] });
          announced.add(event.offer.offerId);
          sent.push(event.key); localStorage.setItem('vibehub.notifiedOffers.v2', JSON.stringify(sent.slice(-500)));
        }
      } catch { /* System permission is requested only from explicit notification settings. */ }
      finally { busy = false; }
    };
    void notify(); const timer = setInterval(() => void notify(), 60000);
    return () => { disposed = true; clearInterval(timer); };
  }, [offers, settings.nativeNotifications, settings.language, settings.quietHours]);
  return null;
}
