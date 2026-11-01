import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@tauri-apps/api/core';
import { Minus, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function WindowTitlebar() {
  const { t } = useTranslation('common');
  const native = import.meta.env.MODE !== 'browser' && isTauri();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!native) return;
    const window = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void window.isMaximized().then(setMaximized);
    void window.onResized(() => void window.isMaximized().then(setMaximized)).then(fn => { unlisten = fn; });
    return () => unlisten?.();
  }, [native]);

  if (!native) return null;
  const window = getCurrentWindow();
  return <div className="vh-window-titlebar" data-tauri-drag-region onDoubleClick={() => void window.toggleMaximize()}>
    <span className="vh-window-title" data-tauri-drag-region>{t('appName')}</span>
    <div className="vh-window-controls" onDoubleClick={event => event.stopPropagation()}>
      <button type="button" aria-label={t('windowMinimize')} onClick={() => void window.minimize()}><Minus size={15} aria-hidden="true" /></button>
      <button type="button" aria-label={t(maximized ? 'windowRestore' : 'windowMaximize')} onClick={() => void window.toggleMaximize()}><Square size={13} aria-hidden="true" /></button>
      <button type="button" className="vh-window-close" aria-label={t('windowClose')} onClick={() => void window.close()}><X size={16} aria-hidden="true" /></button>
    </div>
  </div>;
}
