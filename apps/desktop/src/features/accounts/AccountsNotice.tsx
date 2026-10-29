import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ipc } from '@/services/ipc';

export function AccountsNotice() {
  const { t, i18n } = useTranslation('accounts');
  const { pathname } = useLocation();
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let disposed = false, running = false;
    const check = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try { const snapshot = await ipc.codexAccounts('list', { language: i18n.language.startsWith('fa') ? 'fa' : 'en' }); if (!disposed) setPending(!!snapshot.pendingId); }
      catch { /* The account page provides actionable diagnostics. */ }
      finally { running = false; }
    };
    void check(); const timer = setInterval(() => void check(), 30000);
    return () => { disposed = true; clearInterval(timer); };
  }, [pathname, i18n.language]);
  return pending && pathname !== '/accounts' && pathname !== '/app/chatgpt' ? <p role="status" className="mb-4 rounded-lg border border-border bg-surface p-4 text-sm">
    {t('notices.restartRequired')} <Link className="vh-link ms-2" to="/app/chatgpt?tab=accounts">{t('title')}</Link>
  </p> : null;
}
