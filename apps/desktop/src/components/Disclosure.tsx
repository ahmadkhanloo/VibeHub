import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function Disclosure({ title, children, defaultOpen = false, className = '', onToggle }: {
  title: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; onToggle?: (open: boolean) => void;
}) {
  return <details className={`vh-disclosure ${className}`} open={defaultOpen || undefined} onToggle={event => onToggle?.(event.currentTarget.open)}>
    <summary><div className="vh-disclosure-title">{title}</div><ChevronDown size={16} aria-hidden="true" /></summary>
    <div className="vh-disclosure-body">{children}</div>
  </details>;
}
