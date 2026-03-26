// src/components/NotificationBell.tsx
// Real-time in-app notification bell shown in AppShell header.
// Shows a green dot on the bell when push notifications are active.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";

type NotificationType = "booking" | "fuel" | "maintenance" | "user" | "system";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  user_id?: string;
  link_entity?: string;
  link_id?: string;
};

const TYPE_ICON: Record<NotificationType | "default", string> = {
  booking: "📋",
  fuel: "⛽",
  maintenance: "🔧",
  user: "👤",
  system: "🔔",
  default: "🔔",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();

  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushActive, setPushActive] = useState(
    localStorage.getItem("tms-push-subscribed") === "true"
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const unread = useMemo(
    () => notifs.reduce((count, n) => count + (n.read ? 0 : 1), 0),
    [notifs]
  );

  const load = useCallback(async () => {
    if (!user?.id) {
      setNotifs([]);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!mountedRef.current) return;

    if (error) {
      console.error("[NotificationBell] load failed:", error);
      setLoading(false);
      return;
    }

    setNotifs((data as Notification[]) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const syncPushState = () => {
      setPushActive(localStorage.getItem("tms-push-subscribed") === "true");
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === "tms-push-subscribed") syncPushState();
    };

    const onFocus = () => syncPushState();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const debouncedReload = useMemo(
    () => debounce(() => void load(), 250),
    [load]
  );

  useRealtimeTable({
    table: "notifications",
    filter: user?.id ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user?.id,
    event: "*",
    onChange: debouncedReload,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handler);
    }

    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) await load();
  };

  const markAllRead = async () => {
    if (!user?.id || unread === 0) return;

    const previous = notifs;
    setNotifs((curr) => curr.map((n) => ({ ...n, read: true })));

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (error) {
      console.error("[NotificationBell] markAllRead failed:", error);
      setNotifs(previous);
      return;
    }

    void load();
  };

  const markRead = async (id: string) => {
    const target = notifs.find((n) => n.id === id);
    if (!target || target.read) return;

    setNotifs((curr) =>
      curr.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) {
      console.error("[NotificationBell] markRead failed:", error);
      setNotifs((curr) =>
        curr.map((n) => (n.id === id ? { ...n, read: false } : n))
      );
      return;
    }
  };

  const clearAll = async () => {
    if (!user?.id || notifs.length === 0) return;

    const previous = notifs;
    setNotifs([]);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("[NotificationBell] clearAll failed:", error);
      setNotifs(previous);
      return;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-xl transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
              <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                Notifications
              </h3>

              {unread > 0 && (
                <span
                  className="px-1.5 py-0.5 text-xs font-bold rounded-full"
                  style={{ background: "var(--red-dim)", color: "var(--red)" }}
                >
                  {unread}
                </span>
              )}

              {pushActive && (
                <span
                  className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full flex items-center gap-1"
                  style={{ background: "var(--green-dim)", color: "var(--green)" }}
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
                  onClick={markAllRead}
                  className="text-xs font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  Mark all read
                </button>
              )}

              {notifs.length > 0 && (
                <button
                  onClick={clearAll}
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
                <div
                  className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: "var(--border)",
                    borderTopColor: "var(--accent)",
                  }}
                />
              </div>
            ) : notifs.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No notifications yet
                </p>
              </div>
            ) : (
              <div>
                {notifs.map((n, i) => (
                  <div
                    key={n.id}
                    onClick={() => void markRead(n.id)}
                    className="px-4 py-3 cursor-pointer transition-colors"
                    style={{
                      background: !n.read ? "var(--accent-dim)" : "transparent",
                      borderBottom:
                        i < notifs.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = !n.read
                        ? "var(--accent-dim)"
                        : "transparent";
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-base"
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {TYPE_ICON[n.type] ?? TYPE_ICON.default}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="text-xs font-semibold truncate"
                            style={{ color: "var(--text)" }}
                          >
                            {n.title}
                          </p>

                          {!n.read && (
                            <div
                              className="shrink-0 w-2 h-2 rounded-full mt-1"
                              style={{ background: "var(--accent)" }}
                            />
                          )}
                        </div>

                        <p
                          className="text-xs mt-0.5 line-clamp-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {n.body}
                        </p>

                        <p
                          className="text-[10px] mt-1 font-mono"
                          style={{ color: "var(--text-dim)" }}
                        >
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}