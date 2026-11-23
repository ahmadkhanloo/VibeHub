import { useId, useRef, useState, useEffect, useLayoutEffect, cloneElement, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** One description for pointer, keyboard and touch; no interactive tooltip content.
 *  `placement="side"` opens the bubble beside the anchor instead of below it, which
 *  is what an icon-only rail needs: the bubble must not cover the icon it explains. */
export function Tooltip({ text, placement = 'below', children }: { text: string; placement?: 'below' | 'side'; children?: ReactElement<{ 'aria-describedby'?: string }> }) {
  const { t } = useTranslation('ux');
  const id = useId();
  const pointer = useRef('');
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; side?: boolean } | null>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(closing.current), []);
  const visible = position !== null;
  const place = () => {
    const rect = anchor.current?.getBoundingClientRect(), tip = bubble.current?.getBoundingClientRect();
    if (!rect || !tip) return;
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    if (placement === 'side') {
      // Beside the anchor, vertically centred: outer side of the rail, inner side of the screen.
      const left = rtl ? rect.left - tip.width - 8 : rect.right + 8;
      const top = rect.top + rect.height / 2 - tip.height / 2;
      setPosition({ top: Math.max(8, Math.min(top, innerHeight - tip.height - 8)), left: Math.max(8, Math.min(left, innerWidth - tip.width - 8)), side: true });
      return;
    }
    const below = rect.bottom + 8;
    setPosition({ top: Math.max(8, Math.min(below + tip.height <= innerHeight - 8 ? below : rect.top - tip.height - 8, innerHeight - tip.height - 8)), left: Math.max(8, Math.min(rect.left, innerWidth - tip.width - 8)) });
  };
  useLayoutEffect(() => {
    if (!visible) return;
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, text, placement]);
  const close = () => {
    clearTimeout(closing.current);
    setPosition(null);
  };
  useEffect(() => {
    if (!visible) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !bubble.current?.contains(target)) close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', escape);
    };
  }, [visible]);
  const hide = () => { clearTimeout(closing.current); closing.current = setTimeout(() => setPosition(null), 150); };
  const show = () => {
    clearTimeout(closing.current);
    const rect = anchor.current?.getBoundingClientRect();
    const tip = bubble.current?.getBoundingClientRect();
    if (rect) {
      const height = tip?.height ?? 0, width = tip?.width ?? Math.min(280, innerWidth - 16);
      if (placement === 'side') {
        const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
        const left = rtl ? rect.left - width - 8 : rect.right + 8;
        const top = rect.top + rect.height / 2 - height / 2;
        setPosition({ top: Math.max(8, Math.min(top, innerHeight - height - 8)), left: Math.max(8, Math.min(left, innerWidth - width - 8)), side: true });
        return;
      }
      const below = rect.bottom + 8;
      setPosition({ top: Math.max(8, Math.min(below + height <= innerHeight - 8 ? below : rect.top - height - 8, innerHeight - height - 8)), left: Math.max(8, Math.min(rect.left, innerWidth - width - 8)) });
    }
  };
  return <span ref={anchor} className="vh-tooltip-anchor" onPointerEnter={event => { if (event.pointerType === "mouse") show(); }} onPointerLeave={event => { if (event.pointerType === "mouse") hide(); }} onFocus={() => { if (pointer.current !== "touch") show(); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPosition(null); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    {children ? cloneElement(children, { 'aria-describedby': position ? [children.props['aria-describedby'], id].filter(Boolean).join(' ') : children.props['aria-describedby'] }) : <button type="button" className="vh-info-button" aria-label={t("help")} aria-describedby={position ? id : undefined} onPointerDown={event => { pointer.current = event.pointerType; }} onClick={() => { if (pointer.current === "touch" && visible) close(); else show(); pointer.current = ""; }}><Info size={16} aria-hidden="true" /></button>}
    {position && createPortal(<span ref={bubble} id={id} role="tooltip" className="vh-tooltip" data-side={position.side || undefined} style={{ top: position.top, left: position.left }} onMouseEnter={show} onMouseLeave={hide}>{text}</span>, anchor.current?.closest('dialog[open]') ?? document.body)}
  </span>;
}
