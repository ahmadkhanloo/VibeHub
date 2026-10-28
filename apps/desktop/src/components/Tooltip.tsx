import { useId, useRef, useState, useEffect, useLayoutEffect, cloneElement, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/** One description for pointer, keyboard and touch; no interactive tooltip content. */
export function Tooltip({ text, children }: { text: string; children?: ReactElement<{ 'aria-describedby'?: string }> }) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(closing.current), []);
  const visible = position !== null;
  useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect(), tip = bubble.current?.getBoundingClientRect();
      if (!rect || !tip) return;
      const below = rect.bottom + 8;
      setPosition({ top: Math.max(8, Math.min(below + tip.height <= innerHeight - 8 ? below : rect.top - tip.height - 8, innerHeight - tip.height - 8)), left: Math.max(8, Math.min(rect.left, innerWidth - tip.width - 8)) });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [visible, text]);
  const hide = () => { closing.current = setTimeout(() => setPosition(null), 150); };
  const show = () => {
    clearTimeout(closing.current);
    const rect = anchor.current?.getBoundingClientRect();
    const tip = bubble.current?.getBoundingClientRect();
    if (rect) {
      const height = tip?.height ?? 0, width = tip?.width ?? Math.min(280, innerWidth - 16);
      const below = rect.bottom + 8;
      setPosition({ top: Math.max(8, Math.min(below + height <= innerHeight - 8 ? below : rect.top - height - 8, innerHeight - height - 8)), left: Math.max(8, Math.min(rect.left, innerWidth - width - 8)) });
    }
  };
  return <span ref={anchor} className="vh-tooltip-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPosition(null); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setPosition(null); } }}>
    {children ? cloneElement(children, { 'aria-describedby': position ? [children.props['aria-describedby'], id].filter(Boolean).join(' ') : children.props['aria-describedby'] }) : <button type="button" className="vh-info-button" aria-label={text} aria-describedby={position ? id : undefined} aria-expanded={!!position} onClick={show}><Info size={16} aria-hidden="true" /></button>}
    {position && createPortal(<span ref={bubble} id={id} role="tooltip" className="vh-tooltip" style={position} onMouseEnter={show} onMouseLeave={hide}>{text}</span>, document.body)}
  </span>;
}
