// src/components/NotificationBell.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLiveNotifications,
  timeAgo,
  type AppNotification,
} from "@/hooks/useLiveNotifications";
import { navigateByNotificationEntity } from "@/lib/notificationRoutes";

const ENTITY_ICON: Record<string, string> = {
  booking: "📋",
  fuel_request: "⛽",
  maintenance_request: "🔧",
  incident_report: "⚠️",
  trip: "🚐",
  news_assignment: "🗂️",
  user_request: "👤",
  password_change_request: "🔐",
  default: "🔔",
};

function NotificationToast({
  row,
  onOpen,
  onDismiss,
}: {
  row: AppNotification | null;
  onOpen: (row: AppNotification) => void;
  onDismiss: () => void;
}) {
  if (!row) return null;

  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="fixed top-4 right-4 z-[80] w-[min(92vw,360px)] rounded-2xl border shadow-2xl text-left p-4 transition-all"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-base"
          style={{ background: "var(--surface-2)" }}
        >
          {ENTITY_ICON[row.entity_type ?? "default"] ?? ENTITY_ICON.default}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-[color:var(--text)] line-clamp-1">
              {row.title}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>

          <p className="mt-1 text-xs text-[color:var(--text-muted)] line-clamp-2">
            {row.body}
          </p>

          <p className="mt-2 text-[11px] text-[color:var(--text-dim)]">
            {timeAgo(row.created_at)}
          </p>
        </div>
      </div>
    </button>
  );
}

type NotificationBellProps = {
  currentUserId?: string | null;
};

export function NotificationBell({ currentUserId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const pushActive =
    typeof window !== "undefined" &&
    localStorage.getItem("tms-push-subscribed") === "true";

  const {
    rows,
    unread,
    loading,
    toast,
    setToast,
    markRead,
    markAllRead,
    clearAll,
    load,
  } = useLiveNotifications({
    userId: currentUserId,
    enablePopup: true,
    enableSound: true,
  });

  const grouped = useMemo(() => {
    const today: AppNotification[] = [];
    const earlier: AppNotification[] = [];
    const todayStr = new Date().toDateString();

    rows.forEach((row) => {
      if (new Date(row.created_at).toDateString() === todayStr) today.push(row);
      else earlier.push(row);
    });

    return { today, earlier };
  }, [rows]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openNotification = async (row: AppNotification) => {
    if (!row.is_read) {
      await markRead(row.id);
    }
    navigateByNotificationEntity(row.entity_type, row.entity_id);
    setOpen(false);
    setToast(null);
  };

  const renderItem = (row: AppNotification, index: number) => (
    <button
      key={row.id}
      type="button"
      onClick={() => void openNotification(row)}
      className="w-full text-left px-4 py-3 transition-colors hover:bg-[color:var(--surface-2)]"
      style={{
        background: !row.is_read
          ? "color-mix(in srgb, var(--accent-dim) 35%, transparent)"
          : "transparent",
        borderBottom: index >= 0 ? "1px solid var(--border)" : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="text-base mt-0.5">
          {ENTITY_ICON[row.entity_type ?? "default"] ?? ENTITY_ICON.default}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-[color:var(--text)] line-clamp-1">
              {row.title}
            </p>
            {!row.is_read && (
              <span
                className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                style={{ background: "var(--accent)" }}
              />
            )}
          </div>

          <p className="mt-1 text-xs text-[color:var(--text-muted)] line-clamp-2">
            {row.body}
          </p>

          <p className="mt-1 text-[11px] text-[color:var(--text-dim)]">
            {timeAgo(row.created_at)}
          </p>
        </div>
      </div>
    </button>
  );

  return (
    <>
      <NotificationToast
        row={toast}
        onOpen={(row) => void openNotification(row)}
        onDismiss={() => setToast(null)}
      />

      <div className="relative" ref={panelRef}>
        <button
          onClick={() => {
            setOpen((v) => !v);
            if (!open) void load();
          }}
          className="relative p-2 rounded-xl transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--surface-2)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
          aria-label="Notifications"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {unread > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
              style={{ background: "var(--red)" }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}

          {pushActive && unread === 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2"
              style={{
                background: "var(--green)",
                borderColor: "var(--surface)",
              }}
              title="Push notifications active"
            />
          )}
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl overflow-hidden z-50"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-[color:var(--text)]">
                  Notifications
                </h3>

                {unread > 0 && (
                  <span
                    className="px-1.5 py-0.5 text-xs font-bold rounded-full"
                    style={{
                      background: "var(--red-dim)",
                      color: "var(--red)",
                    }}
                  >
                    {unread}
                  </span>
                )}

                {pushActive && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full flex items-center gap-1"
                    style={{
                      background: "var(--green-dim)",
                      color: "var(--green)",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ background: "var(--green)" }}
                    />
                    Push on
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={() => void markAllRead()}
                    className="text-xs font-medium"
                    style={{ color: "var(--accent)" }}
                  >
                    Mark all read
                  </button>
                )}
                {rows.length > 0 && (
                  <button
                    onClick={() => void clearAll()}
                    className="text-xs"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-96">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-[color:var(--text-muted)]">
                    Loading...
                  </div>
                </div>
              ) : rows.length === 0 ? (
                <div className="py-10 px-4 text-center">
                  <div className="text-2xl mb-2">🔔</div>
                  <p className="text-sm text-[color:var(--text-muted)]">
                    No notifications yet
                  </p>
                </div>
              ) : (
                <>
                  {grouped.today.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--text-dim)]">
                        Today
                      </div>
                      {grouped.today.map((row, i) => renderItem(row, i))}
                    </>
                  )}

                  {grouped.earlier.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--text-dim)]">
                        Earlier
                      </div>
                      {grouped.earlier.map((row, i) => renderItem(row, i))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
