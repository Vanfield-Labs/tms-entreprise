// src/components/TmsUI.tsx
// ─── Shared UI atoms for TMS ──────────────────────────────────────────────────
// All components use CSS variables (--text, --surface, --border, etc.)
// and are mobile-first. Import from here instead of writing inline classes.

import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CardListSkeleton from "@/components/skeletons/CardListSkeleton";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-8 h-8" : "w-5 h-5";
  return (
    <div className={`${s} border-2 border-[color:var(--border-bright)] border-t-[color:var(--text)] rounded-full animate-spin`} />
  );
}

type PageSpinnerVariant = "spinner" | "cards" | "table" | "dashboard";

export function PageSpinner({
  variant = "spinner",
  count = 4,
  rows = 6,
  cols = 5,
}: {
  variant?: PageSpinnerVariant;
  count?: number;
  rows?: number;
  cols?: number;
}) {
  if (variant === "cards") {
    return (
      <div className="space-y-4">
        <div className="page-header animate-pulse">
          <div>
            <div className="h-6 w-40 rounded bg-[color:var(--surface-2)]" />
            <div className="mt-2 h-3 w-56 rounded bg-[color:var(--surface-2)]" />
          </div>
        </div>
        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-5 w-5 rounded-full bg-[color:var(--surface-2)]" />
          <div className="h-3 w-28 rounded bg-[color:var(--surface-2)]" />
        </div>
        <CardListSkeleton count={count} />
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="space-y-4">
        <div className="page-header animate-pulse">
          <div>
            <div className="h-6 w-40 rounded bg-[color:var(--surface-2)]" />
            <div className="mt-2 h-3 w-56 rounded bg-[color:var(--surface-2)]" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 animate-pulse">
          <div className="h-10 w-full sm:w-64 rounded-xl bg-[color:var(--surface-2)]" />
          <div className="h-10 w-full sm:w-40 rounded-xl bg-[color:var(--surface-2)]" />
        </div>
        <TableSkeleton rows={rows} cols={cols} />
      </div>
    );
  }

  if (variant === "dashboard") {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[color:var(--surface-2)] flex items-center justify-center mb-3 text-[color:var(--text-muted)]">
        {icon ?? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
          </svg>
        )}
      </div>
      <p className="text-sm font-medium text-[color:var(--text)]">{title}</p>
      {subtitle && <p className="text-xs text-[color:var(--text-muted)] mt-1 max-w-xs">{subtitle}</p>}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`badge badge-${status.toLowerCase().replace(/\s+/g, "_")}`}>
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-header">
      <div className="min-w-0">
        <div className="card-title">{title}</div>
        {subtitle && <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: "green" | "amber" | "red" | "accent" | "purple" | "cyan";
}) {
  const accentColor = accent
    ? { green: "var(--green)", amber: "var(--amber)", red: "var(--red)", accent: "var(--accent)", purple: "var(--purple)", cyan: "var(--cyan)" }[accent]
    : "var(--text)";
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: accentColor }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ─── Alert ────────────────────────────────────────────────────────────────────
export function Alert({
  type = "info",
  children,
  onDismiss,
}: {
  type?: "info" | "error" | "success" | "amber";
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div className={`alert alert-${type} justify-between`}>
      <span>{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-2 shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 14 14" stroke="currentColor">
            <path d="M3 3l8 8M11 3l-8 8" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Form atoms ───────────────────────────────────────────────────────────────
export function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="form-label">
      {children}{required && <span className="text-[color:var(--red)] ml-0.5">*</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`tms-input ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`tms-select ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`tms-textarea ${props.className ?? ""}`} />;
}

// ─── Field (label + input wrapper) ───────────────────────────────────────────
export function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-[color:var(--text-muted)]">{hint}</p>}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "ghost" | "danger" | "success" | "amber";
type BtnSize    = "sm" | "md" | "lg";

export function Btn({
  variant = "ghost",
  size = "md",
  loading,
  disabled,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
}) {
  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`btn btn-${variant} ${sizeClass} ${className}`}
    >
      {loading ? <Spinner size="sm" /> : children}
    </button>
  );
}

// ─── Search input ─────────────────────────────────────────────────────────────
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color:var(--text-muted)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <input
        className="tms-input pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Count pill ───────────────────────────────────────────────────────────────
export function CountPill({ n, color = "accent" }: { n: number; color?: string }) {
  const bg = { accent: "var(--accent)", green: "var(--green)", amber: "var(--amber)", red: "var(--red)" }[color] ?? "var(--accent)";
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
      style={{ background: bg }}
    >
      {n}
    </span>
  );
}

// ─── Section divider row ──────────────────────────────────────────────────────
export function SectionRow({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
      {icon}
      <span>{children}</span>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Sheet */}
      <div
        className={`
          relative z-10 w-full ${maxWidth}
          bg-[color:var(--surface)] border border-[color:var(--border)]
          rounded-t-2xl sm:rounded-2xl
          shadow-2xl
          max-h-[90vh] overflow-y-auto
          animate-[slideUp_0.2s_ease]
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)] sticky top-0 bg-[color:var(--surface)] z-10">
          <h2 className="text-base font-semibold text-[color:var(--text)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 14 14" stroke="currentColor">
              <path d="M3 3l8 8M11 3l-8 8" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  counts,
}: {
  tabs: { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="flex gap-1 p-1 bg-[color:var(--surface-2)] rounded-xl overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all min-h-[34px]
            ${active === t.value
              ? "bg-[color:var(--surface)] text-[color:var(--text)] shadow-sm"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"}
          `}
        >
          {t.label}
          {counts?.[t.value] !== undefined && counts[t.value]! > 0 && (
            <CountPill n={counts[t.value]!} />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  onConfirm,
  onCancel,
  acting = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: BtnVariant;
  onConfirm: () => void;
  onCancel: () => void;
  acting?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-sm">
      <p className="text-sm text-[color:var(--text-muted)] mb-5">{message}</p>
      <div className="flex gap-3 justify-end">
        <Btn variant="ghost" onClick={onCancel} disabled={acting}>Cancel</Btn>
        <Btn variant={variant} onClick={onConfirm} loading={acting}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
export type CtxItem = { label: string; icon: string; cls?: string; onClick: () => void };
type MenuState = { top: number; left: number; anchorTop: number; anchorBottom: number } | null;

export function CtxMenu({ items }: { items: CtxItem[] }) {
  const [menu, setMenu] = useState<MenuState>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const menuHeight = menuRef.current.offsetHeight;
    const nextTop =
      menu.anchorBottom + 6 + menuHeight <= window.innerHeight - 8
        ? menu.anchorBottom + 6
        : Math.max(8, menu.anchorTop - menuHeight - 6);
    if (nextTop !== menu.top) {
      setMenu((prev) => (prev ? { ...prev, top: nextTop } : prev));
    }
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    const closeOnResize = () => setMenu(null);
    document.addEventListener("mousedown", close, true);
    window.addEventListener("scroll", () => setMenu(null), { capture: true, once: true });
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("mousedown", close, true);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [menu]);

  const toggle = () => {
    if (menu) {
      setMenu(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const W = 196;
    setMenu({
      top: rect.bottom + 6,
      left: Math.min(Math.max(8, rect.right - W), window.innerWidth - W - 8),
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        className="ctx-menu-trigger"
        aria-label="More actions"
      >
        •••
      </button>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="ctx-menu"
            style={{
              position: "fixed",
              top: menu.top,
              left: menu.left,
              width: 196,
              transform: "translateZ(0)",
            }}
          >
            {items.map((item, i) => (
              <button
                key={i}
                role="menuitem"
                className={`ctx-menu-item ${item.cls ?? ""}`}
                onClick={() => {
                  setMenu(null);
                  item.onClick();
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── Expiry pill ──────────────────────────────────────────────────────────────
export function ExpiryPill({ daysLeft }: { daysLeft: number | null }) {
  if (daysLeft === null) return null;
  if (daysLeft < 0)  return <span className="badge badge-rejected">Expired</span>;
  if (daysLeft <= 30) return <span className="badge badge-submitted">{daysLeft}d left</span>;
  return <span className="badge badge-active">{daysLeft}d left</span>;
}
