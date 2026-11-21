import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@tauri-apps/api/core';
import { Minus, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** The custom window chrome exists only inside the Tauri window, never in the browser preview. */
export function useNativeWindow(): boolean {
  return import.meta.env.MODE !== 'browser' && isTauri();
}

/**
 * Minimize / maximize / close. The app shell places these at the physical
 * top-right of the command bar, so the bar itself carries the drag region.
 */
export function WindowControls() {
  const { t } = useTranslation('common');
  const native = useNativeWindow();
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
  return (
    <div className="vh-window-controls" onDoubleClick={event => event.stopPropagation()}>
      <button type="button" aria-label={t('windowMinimize')} onClick={() => void window.minimize()}><Minus size={15} aria-hidden="true" /></button>
      <button type="button" aria-label={t(maximized ? 'windowRestore' : 'windowMaximize')} onClick={() => void window.toggleMaximize()}><Square size={13} aria-hidden="true" /></button>
      <button type="button" className="vh-window-close" aria-label={t('windowClose')} onClick={() => void window.close()}><X size={16} aria-hidden="true" /></button>
    </div>
  );
}

/** Drag strip for screens rendered outside the shell (onboarding), so the frameless window stays movable. */
export function WindowDragStrip() {
  const native = useNativeWindow();
  if (!native) return null;
  const window = getCurrentWindow();
  return (
    <div className="vh-drag-strip" data-tauri-drag-region onDoubleClick={() => void window.toggleMaximize()}>
      <span className="vh-drag-strip-spacer" data-tauri-drag-region aria-hidden="true" />
      <WindowControls />
    </div>
  );
}
