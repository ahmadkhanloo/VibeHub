import { useId, useRef, useState, useEffect, useLayoutEffect, cloneElement, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/** One description for pointer, keyboard and touch; no interactive tooltip content.
 *  `placement="side"` opens the bubble beside the anchor instead of below it, which
 *  is what an icon-only rail needs: the bubble must not cover the icon it explains. */
export function Tooltip({ text, placement = 'below', children }: { text: string; placement?: 'below' | 'side'; children?: ReactElement<{ 'aria-describedby'?: string }> }) {
  const id = useId();
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
  const hide = () => { closing.current = setTimeout(() => setPosition(null), 150); };
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
  return <span ref={anchor} className="vh-tooltip-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPosition(null); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setPosition(null); } }}>
    {children ? cloneElement(children, { 'aria-describedby': position ? [children.props['aria-describedby'], id].filter(Boolean).join(' ') : children.props['aria-describedby'] }) : <button type="button" className="vh-info-button" aria-label={text} aria-describedby={position ? id : undefined} aria-expanded={!!position} onClick={show}><Info size={16} aria-hidden="true" /></button>}
    {position && createPortal(<span ref={bubble} id={id} role="tooltip" className="vh-tooltip" data-side={position.side || undefined} style={{ top: position.top, left: position.left }} onMouseEnter={show} onMouseLeave={hide}>{text}</span>, document.body)}
  </span>;
}
