import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

const ENTITY_ICON: Record<string, string> = {
  booking: "📅",
  fuel: "⛽",
  maintenance: "🛠",
  incident: "⚠️",
  trip: "🚗",
  approval: "✅",
  default: "🔔",
};

type NotifRow = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
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

export function NotificationBell({
  currentUserId,
  onNavigate,
}: {
  currentUserId: string;
  onNavigate: (entityType: string, entityId?: string | null) => void;
}) {
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const load = async () => {
    if (!currentUserId) {
      setNotifs([]);
      return;
    }

    const { data } = await supabase
      .from("notifications")
      .select("id,title,body,is_read,created_at,entity_type,entity_id")
      .eq("recipient_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(30);

    const rows = (data as NotifRow[]) || [];

    if (rows.length > prevCountRef.current) {
      try {
        new Audio("/notification.mp3").play().catch(() => {});
      } catch {}
    }

    prevCountRef.current = rows.length;
    setNotifs(rows);
  };

  useEffect(() => {
    void load();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setNotifs([]);
      return;
    }

    const ch = supabase
      .channel(`notif:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentUserId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = notifs.filter((n) => !n.is_read).length;

  const grouped = useMemo(() => {
    const today: NotifRow[] = [];
    const earlier: NotifRow[] = [];
    const todayStr = new Date().toDateString();

    notifs.forEach((n) => {
      if (new Date(n.created_at).toDateString() === todayStr) today.push(n);
      else earlier.push(n);
    });

    return { today, earlier };
  }, [notifs]);

  const openNotification = async (n: NotifRow) => {
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));

    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", n.id);

    if (n.entity_type) {
      onNavigate(n.entity_type, n.entity_id);
    }

    setOpen(false);
  };

  const markAllRead = async () => {
    if (!currentUserId) return;

    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", currentUserId)
      .eq("is_read", false);

    setNotifs((n) => n.map((x) => ({ ...x, is_read: true })));
  };

  const clearAll = async () => {
    if (!currentUserId) return;
    await supabase.from("notifications").delete().eq("recipient_id", currentUserId);
    setNotifs([]);
  };

  const renderItem = (n: NotifRow, i: number) => (
    <button
      key={n.id}
      onClick={() => openNotification(n)}
      className="w-full text-left px-4 py-3 transition-colors hover:bg-[color:var(--surface-2)]"
      style={{
        background: !n.is_read ? "color-mix(in srgb, var(--accent-dim) 35%, transparent)" : "transparent",
        borderBottom: i >= 0 ? "1px solid var(--border)" : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0 mt-0.5">
          {ENTITY_ICON[n.entity_type ?? "default"] ?? ENTITY_ICON.default}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
              {n.title}
            </p>
            {!n.is_read && (
              <div
                className="w-2 h-2 rounded-full shrink-0 mt-1"
                style={{ background: "var(--accent)" }}
              />
            )}
          </div>
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
            {n.body}
          </p>
          <p className="text-[10px] mt-1 font-mono" style={{ color: "var(--text-dim)" }}>
            {timeAgo(n.created_at)}
          </p>
        </div>
      </div>
    </button>
  );

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
        className="relative p-2 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)] transition-colors"
        aria-label="Notifications"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {unread > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: "var(--red)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl border overflow-hidden z-50 animate-[slideUp_0.2s_ease]"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                Notifications
              </span>
              {unread > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ background: "var(--red)" }}
                >
                  {unread}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                  Mark all read
                </button>
              )}
              {notifs.length > 0 && (
                <button onClick={clearAll} className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {notifs.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No notifications yet
                </p>
              </div>
            ) : (
              <div>
                {grouped.today.length > 0 && (
                  <>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                      Today
                    </p>
                    {grouped.today.map((n, i) => renderItem(n, i))}
                  </>
                )}

                {grouped.earlier.length > 0 && (
                  <>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                      Earlier
                    </p>
                    {grouped.earlier.map((n, i) => renderItem(n, i))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
