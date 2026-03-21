// src/components/ErrorToast.tsx
// Global customised error/success/warning toast popup.
// Usage:
//   import { useToast, ToastContainer } from "@/components/ErrorToast";
//   const toast = useToast();
//   toast.error("Something went wrong");
//   toast.success("Saved!");
//   toast.warn("Check your input");
// Mount <ToastContainer /> once in AppShell or App root.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ToastType = "error" | "success" | "warn" | "info";

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
};

type ToastContextValue = {
  error:   (title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string, duration?: number) => void;
  warn:    (title: string, message?: string, duration?: number) => void;
  info:    (title: string, message?: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue>({
  error:   () => {},
  success: () => {},
  warn:    () => {},
  info:    () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ── Style map ─────────────────────────────────────────────────────────────────
const STYLE: Record<ToastType, {
  bg: string; border: string; iconBg: string; textColor: string; icon: string;
}> = {
  error: {
    bg: "rgba(220,38,38,0.08)", border: "var(--red)", iconBg: "var(--red-dim)",
    textColor: "var(--red)", icon: "✕",
  },
  success: {
    bg: "rgba(22,163,74,0.08)", border: "var(--green)", iconBg: "var(--green-dim)",
    textColor: "var(--green)", icon: "✓",
  },
  warn: {
    bg: "rgba(217,119,6,0.08)", border: "var(--amber)", iconBg: "var(--amber-dim)",
    textColor: "var(--amber)", icon: "⚠",
  },
  info: {
    bg: "rgba(37,99,235,0.08)", border: "var(--accent)", iconBg: "var(--accent-dim)",
    textColor: "var(--accent)", icon: "ℹ",
  },
};

// ── Single toast item ─────────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const s = STYLE[toast.type];
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "14px 16px",
      background: "var(--surface)",
      border: `1px solid var(--border)`,
      borderLeft: `4px solid ${s.border}`,
      borderRadius: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
      minWidth: 280, maxWidth: 380,
      transform: visible ? "translateX(0)" : "translateX(120%)",
      opacity: visible ? 1 : 0,
      transition: "transform 0.25s cubic-bezier(.22,1,.36,1), opacity 0.2s ease",
      pointerEvents: "auto",
    }}>
      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: s.iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, fontWeight: 700, color: s.textColor,
      }}>
        {s.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
          {toast.title}
        </p>
        {toast.message && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "3px 0 0", lineHeight: 1.4 }}>
            {toast.message}
          </p>
        )}
        {/* Progress bar */}
        <div style={{ marginTop: 8, height: 2, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2, background: s.border,
            animation: `toast-shrink ${toast.duration}ms linear forwards`,
          }} />
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-dim)", fontSize: 14, padding: 2, flexShrink: 0,
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >✕</button>
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────
let _addToast: ((toast: Toast) => void) | null = null;

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((toast: Toast) => {
    setToasts(prev => [...prev.slice(-4), toast]); // max 5 at once
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Expose to imperative API
  useEffect(() => {
    _addToast = add;
    return () => { _addToast = null; };
  }, [add]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <style>{`
        @keyframes toast-shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
      <div style={{
        position: "fixed", bottom: 24, right: 20, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 10,
        pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </>,
    document.body,
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, title: string, message?: string, duration = 5000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { id, type, title, message: message, duration }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ctx: ToastContextValue = {
    error:   (t, m, d) => add("error",   t, m, d),
    success: (t, m, d) => add("success", t, m, d),
    warn:    (t, m, d) => add("warn",    t, m, d),
    info:    (t, m, d) => add("info",    t, m, d),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {typeof document !== "undefined" && createPortal(
        <>
          <style>{`
            @keyframes toast-shrink {
              from { width: 100%; }
              to   { width: 0%; }
            }
          `}</style>
          <div style={{
            position: "fixed", bottom: 24, right: 20, zIndex: 9999,
            display: "flex", flexDirection: "column", gap: 10,
            pointerEvents: "none",
          }}>
            {toasts.map(t => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>
        </>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// ── Imperative API (use when outside React tree is not feasible) ──────────────
export const toast = {
  error:   (title: string, message?: string, duration = 5000) => {
    _addToast?.({ id: Math.random().toString(36).slice(2), type: "error", title, message, duration });
  },
  success: (title: string, message?: string, duration = 4000) => {
    _addToast?.({ id: Math.random().toString(36).slice(2), type: "success", title, message, duration });
  },
  warn:    (title: string, message?: string, duration = 5000) => {
    _addToast?.({ id: Math.random().toString(36).slice(2), type: "warn", title, message, duration });
  },
  info:    (title: string, message?: string, duration = 4000) => {
    _addToast?.({ id: Math.random().toString(36).slice(2), type: "info", title, message, duration });
  },
};