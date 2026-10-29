import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { ipc } from '@/services/ipc';
import { useToolContext } from '@/app/tool-context';
import { Button, ErrorNotice } from './ui';

export function AppPath({ appId }: { appId: string }) {
  const { t } = useTranslation('ux');
  const ctx = useToolContext();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (!['qoder', 'zcode', 'deepseek-harness', 'antigravity'].includes(appId)) return null;
  return <div className="space-y-2">
    <Button disabled={busy} onClick={async () => { setBusy(true); setError(null); try { const path = await open({ multiple: false, filters: [{ name: 'Application', extensions: ['exe'] }] }); if (typeof path === 'string') { await ipc.appPath(appId, path); await ctx.refresh(); } } catch (cause) { setError(cause); } finally { setBusy(false); } }}>{t('chooseExecutable')}</Button>
    {error != null && <ErrorNotice error={error} />}
  </div>;
}
