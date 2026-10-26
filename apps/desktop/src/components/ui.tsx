import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Check, Copy, Loader2, X, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

type Variant = "primary" | "secondary" | "ghost" | "danger";
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: "sm" | "md";
    loading?: boolean;
  }
>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading,
    disabled,
    className = "",
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "vh-button",
        "vh-button-" + variant,
        size === "sm" ? "vh-button-sm" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {loading && (
        <Loader2 size={16} aria-hidden="true" className="animate-spin" />
      )}
      {children}
    </button>
  );
});
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "primary" | "muted";
}) {
  return <span className={"vh-badge vh-badge-" + tone}>{children}</span>;
}
export function Card({
  children,
  className = "",
  as = "div",
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: "div" | "section" }) {
  const Tag = as;
  return (
    <Tag {...rest} className={"vh-card " + className}>
      {children}
    </Tag>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="inline-flex items-center gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={"vh-switch " + (checked ? "is-checked" : "")}
      >
        <span />
      </button>
      {label && (
        <label className="text-sm" htmlFor={id}>
          {label}
        </label>
      )}
    </div>
  );
}
export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  ...rest
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      {...rest}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className={"vh-input " + (rest.className ?? "")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", dir = "auto", ...props }, ref) {
  return (
    <input
      {...props}
      ref={ref}
      dir={dir}
      className={"vh-input " + (dir === "ltr" ? "ltr-tech " : "") + className}
    />
  );
});
export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="vh-empty">
      {icon && (
        <div className="text-muted" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-bold">{title}</h2>
      {sub && <p className="max-w-lg text-sm text-muted">{sub}</p>}
      {action}
    </div>
  );
}
export function VerificationBadge({
  status,
}: {
  status: "verified" | "reported" | "unknown" | "unsupported";
}) {
  const { t } = useTranslation();
  return (
    <Badge tone={status === "verified" ? "success" : "muted"}>
      {t("common:" + status)}
    </Badge>
  );
}
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        aria-label={label ?? t("common:copy")}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setFailed(false);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 1500);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? (
          <Check size={15} aria-hidden="true" />
        ) : (
          <Copy size={15} aria-hidden="true" />
        )}
        {label && <span>{copied ? t("common:copied") : label}</span>}
      </Button>
      <span className="sr-only" role="status">
        {copied ? t("common:copied") : failed ? t("common:failed") : ""}
      </span>
    </>
  );
}
export function Spinner() {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-muted">
      <Loader2 aria-hidden="true" size={18} className="animate-spin" />
      {t("common:loading")}
    </div>
  );
}
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{children}</h2>
      {action}
    </div>
  );
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <header className="vh-page-header">
      <div className="min-w-0">
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {description && (
          <div className="mt-2 max-w-3xl text-sm leading-7 text-muted">
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
export function ErrorNotice({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { t } = useTranslation("ux");
  const raw = String(error ?? "");
  const causeKey = /vault|credential/i.test(raw)
    ? "vaultFailure"
    : /proxy/i.test(raw)
      ? "proxyFailure"
      : /permission|access denied|denied/i.test(raw)
        ? "permissionFailure"
        : /network|fetch|dns|timeout|offline/i.test(raw)
          ? "networkFailure"
          : /invoke|tauri/i.test(raw)
            ? "nativeFailure"
            : "operationFailed";
  const detail = raw
    .replace(/(?:Bearer\s+|sk-)[^\s]+/gi, "[redacted]")
    .replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, "$1[redacted]")
    .replace(
      /((?:password|token|api[-_ ]?key|authorization)\s*[:=]\s*)[^\s,;]+/gi,
      "$1[redacted]",
    );
  return (
    <div className="vh-error" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle size={19} aria-hidden="true" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t(causeKey)}</p>
          <p className="mt-1 text-sm">{t("recovery")}</p>
          <details className="mt-2 text-xs">
            <summary>{t("technicalDetails")}</summary>
            <pre dir="ltr" className="mt-2 whitespace-pre-wrap break-all">
              {detail}
            </pre>
          </details>
        </div>
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            {t("retry")}
          </Button>
        )}
      </div>
    </div>
  );
}
export function Modal({
  open,
  title,
  onClose,
  children,
  busy = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const active = document.activeElement as HTMLElement | null;
      dialog.showModal();
      const target =
        dialog.querySelector<HTMLElement>("[data-autofocus], [autofocus]") ??
        dialog.querySelector<HTMLElement>("button");
      target?.focus();
      return () => {
        dialog.close();
        active?.isConnected && active.focus();
      };
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-modal="true"
      onKeyDown={e=>{
        if(e.key!=="Tab")return;
        const nodes=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])')].filter(node=>node.tabIndex>=0&&node.getClientRects().length>0);
        const first=nodes[0],last=nodes[nodes.length-1];
        if(!first||!last){e.preventDefault();return;}
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }}
      className="vh-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) closeRef.current();
      }}
    >
      <header className="flex items-center justify-between gap-4 border-b border-border p-6">
        <h2 id={titleId} className="text-xl font-bold">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          aria-label={useTranslation().t("common:close")}
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} />
        </Button>
      </header>
      <div className="space-y-4 p-6">{children}</div>
    </dialog>
  );
}
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
  panelId,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string }[];
  label: string;
  panelId?: string;
}) {
  const generated = useId();
  const id = panelId ? panelId + "-tab" : generated;
  return (
    <div role="tablist" aria-label={label} className="vh-tabs">
      {items.map((item, i) => (
        <button
          key={item.value}
          id={id + "-" + item.value}
          role="tab"
          type="button"
          aria-controls={panelId}
          aria-selected={value === item.value}
          tabIndex={value === item.value ? 0 : -1}
          onClick={() => onChange(item.value)}
          onKeyDown={(e) => {
            let n = i;
            const rtl = document.documentElement.dir === "rtl";
            if (e.key === "ArrowRight")
              n = (i + (rtl ? -1 : 1) + items.length) % items.length;
            else if (e.key === "ArrowLeft")
              n = (i + (rtl ? 1 : -1) + items.length) % items.length;
            else if (e.key === "Home") n = 0;
            else if (e.key === "End") n = items.length - 1;
            else return;
            e.preventDefault();
            const next = items[n];
            if (next) {
              onChange(next.value);
              document.getElementById(id + "-" + next.value)?.focus();
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
