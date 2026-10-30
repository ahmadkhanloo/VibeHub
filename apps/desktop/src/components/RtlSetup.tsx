import { useRef, useState } from 'react';
import { CheckCircle2, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useSettings } from '@/app/settings';
import { ipc } from '@/services/ipc';
import { Button, ErrorNotice, Modal } from './ui';

export function RtlSetup({ id, name, available, onReady }: { id: string; name: string; available: boolean; onReady: () => void }) {
  const { t } = useTranslation('ux');
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const operation = useRef(false);
  const configured = available && settings.rtlSetupByApp[id] === true;
  const setup = async () => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(null);
    try {
      const result = await ipc.rtlSetup(id);
      if (!result.ok) throw new Error(t('rtlSetupFailed'));
      update(current => ({
        rtlSetupByApp: { ...current.rtlSetupByApp, [id]: true },
        launchModeByApp: { ...current.launchModeByApp, [id]: 'rtl' },
      }));
      onReady(); setOpen(false);
    } catch (cause) { setError(cause); }
    finally { operation.current = false; setBusy(false); }
  };
  return <>
    <Button size="sm" variant="ghost" className="vh-rtl-setup-button" aria-label={t('rtlSetupFor', { name })} title={t('rtlSetupFor', { name })} onClick={() => { setError(null); setOpen(true); }}>
      {configured ? <CheckCircle2 size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}{t(configured ? 'rtlReady' : 'rtlSetupShort')}
    </Button>
    {open && <Modal open={open} title={t('rtlSetupFor', { name })} busy={busy} onClose={() => setOpen(false)}>
      <p className="text-sm leading-7">{t(available ? 'rtlSetupHint' : 'rtlSetupMissing', { name })}</p>
      {id === 'antigravity' && <p className="mt-3 text-sm text-warning">{t('rtlExperimental')}</p>}
      {error != null && <ErrorNotice error={error} />}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button disabled={busy} onClick={() => setOpen(false)}>{t('common:cancel')}</Button>
        {available ? <Button variant="primary" loading={busy} onClick={() => void setup()}>{t('rtlSetupShort')}</Button>
          : <Button variant="primary" onClick={() => void openUrl('https://github.com/ahmadkhanloo/VibeHub/releases').catch(setError)}>{t('rtlSetupDownload')}</Button>}
      </div>
    </Modal>}
  </>;
}
