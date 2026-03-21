// src/components/NotificationBell.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// Match actual DB columns exactly
type Notification = {
  id: string;
  title: string;
  body: string | null;
  entity_type: string | null;   // DB column name
  is_read: boolean;             // DB column name
  created_at: string;
  priority: string | null;
};

const TYPE_ICON: Record<string, string> = {
  booking:     "📋",
  fuel_request:"⛽",
  fuel:        "⛽",
  maintenance: "🔧",
  maintenance_request: "🔧",
  user:        "👤",
  vehicle:     "🚗",
  driver:      "👤",
  system:      "🔔",
};

const TYPE_BG: Record<string, string> = {
  booking:     "rgba(37,99,235,0.1)",
  fuel_request:"rgba(217,119,6,0.1)",
  fuel:        "rgba(217,119,6,0.1)",
  maintenance: "rgba(234,88,12,0.1)",
  maintenance_request: "rgba(234,88,12,0.1)",
  vehicle:     "rgba(22,163,74,0.1)",
  driver:      "rgba(124,58,237,0.1)",
  system:      "rgba(107,114,128,0.1)",
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
  const [notifs, setNotifs]   = useState<Notification[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef              = useRef<HTMLDivElement>(null);

  const unread = notifs.filter(n => !n.is_read).length;

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,body,entity_type,is_read,created_at,priority")
      .eq("recipient_id", user.id)          // ← correct column
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) console.error("NotificationBell load:", error.message);
    setNotifs((data as Notification[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  // Realtime — new INSERT for this user
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifs-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${user.id}`,   // ← correct column
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from("notifications")
      .update({ is_read: true })            // ← correct column
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    setNotifs(n => n.map(x => ({ ...x, is_read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const clearAll = async () => {
    if (!user?.id) return;
    await supabase.from("notifications").delete().eq("recipient_id", user.id);
    setNotifs([]);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        className="relative p-2 rounded-xl transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            minWidth: 16, height: 16, padding: "0 3px",
            background: "var(--red)", color: "#fff",
            fontSize: 10, fontWeight: 700, borderRadius: 999,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 360, maxWidth: "calc(100vw - 16px)",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden", zIndex: 50,
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>Notifications</h3>
              {unread > 0 && (
                <span style={{ padding: "2px 7px", background: "var(--red-dim)", color: "var(--red)", fontSize: 11, fontWeight: 700, borderRadius: 999 }}>{unread}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                  Mark all read
                </button>
              )}
              {notifs.length > 0 && (
                <button onClick={clearAll} style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", maxHeight: 440 }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--text)" }} />
              </div>
            ) : notifs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 16px" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No notifications yet</p>
                <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>Actions like bookings and approvals will appear here</p>
              </div>
            ) : (
              <div>
                {notifs.map((n, i) => {
                  const eType = n.entity_type ?? "system";
                  const icon  = TYPE_ICON[eType]  ?? "🔔";
                  const bg    = TYPE_BG[eType]     ?? "rgba(107,114,128,0.1)";
                  return (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "12px 16px", cursor: "pointer",
                        borderBottom: i < notifs.length - 1 ? "1px solid var(--border)" : "none",
                        background: n.is_read ? "transparent" : "var(--accent-dim)",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = n.is_read ? "var(--surface-2)" : "var(--accent-dim)")}
                      onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? "transparent" : "var(--accent-dim)")}
                    >
                      {/* Icon */}
                      <div style={{
                        flexShrink: 0, width: 36, height: 36, borderRadius: 10,
                        background: bg, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 16,
                      }}>
                        {icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <p style={{
                            fontSize: 13, fontWeight: n.is_read ? 500 : 700,
                            color: "var(--text)", margin: 0, lineHeight: 1.3,
                          }}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, marginTop: 3 }} />
                          )}
                        </div>
                        {n.body && (
                          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "3px 0 0", lineHeight: 1.4,
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {n.body}
                          </p>
                        )}
                        <p style={{ fontSize: 10, color: "var(--text-dim)", margin: "4px 0 0", fontFamily: "'IBM Plex Mono', monospace" }}>
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}