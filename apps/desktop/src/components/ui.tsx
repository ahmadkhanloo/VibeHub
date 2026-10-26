// Small design-system primitives on semantic tokens only (plan §3.3/§3.4).
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }
>(function Button({ variant = 'secondary', size = 'md', loading, className = '', children, disabled, ...rest }, ref) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none select-none';
  const sizes = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm' }[size];
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    secondary: 'bg-surface-alt text-text border border-border hover:bg-border/40',
    ghost: 'text-text hover:bg-surface-alt',
    danger: 'bg-danger text-white hover:opacity-90',
  }[variant];
  return (
    <button ref={ref} className={`${base} ${sizes} ${variants} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
});

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' | 'muted' }) {
  const tones = {
    neutral: 'bg-surface-alt text-text border-border',
    success: 'bg-success/15 text-success border-success/30',
    warning: 'bg-warning/15 text-warning border-warning/30',
    danger: 'bg-danger/15 text-danger border-danger/30',
    primary: 'bg-primary/15 text-primary border-primary/30',
    muted: 'bg-transparent text-muted border-border',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 ${tones}`}>{children}</span>;
}

export function Card({ children, className = '', as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  const Tag = as;
  return <Tag className={`rounded-[14px] border border-border bg-surface p-4 ${className}`}>{children}</Tag>;
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 rounded-full border border-border transition-colors ${checked ? 'bg-primary' : 'bg-surface-alt'}`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white shadow transition-transform mx-1 ${checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}
          style={checked ? { transform: document.documentElement.dir === 'rtl' ? 'translateX(-20px)' : 'translateX(20px)' } : undefined}
        />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-9 rounded-[10px] border border-border bg-surface px-3 text-sm text-text"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-9 rounded-[10px] border border-border bg-surface px-3 text-sm text-text ltr-tech ${props.className ?? ''}`} />;
}

export function EmptyState({ icon, title, sub }: { icon?: ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-border p-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div className="font-medium">{title}</div>
      {sub && <div className="max-w-md text-sm text-muted">{sub}</div>}
    </div>
  );
}

export function VerificationBadge({ status }: { status: 'verified' | 'reported' | 'unknown' | 'unsupported' }) {
  const { t } = useTranslation();
  const tone = { verified: 'success', reported: 'primary', unknown: 'muted', unsupported: 'neutral' } as const;
  return <Badge tone={tone[status]}>{t(`common.${status}`)}</Badge>;
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      title={t('common.copy')}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {label && <span>{copied ? t('common.copied') : label}</span>}
    </Button>
  );
}

export function Spinner() {
  return <Loader2 className="mx-auto animate-spin text-muted" />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}
