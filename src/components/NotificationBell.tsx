// src/components/NotificationBell.tsx
// Clicking a notification dispatches "tms:navigate" custom event with { label }
// AppShell listens and switches to the matching nav item.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export type Notification = {
  id: string;
  title: string;
  body: string;
  priority: string;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
  recipient_id: string;
};

const ENTITY_NAV_LABEL: Record<string, string> = {
  booking:           "My Bookings",
  fuel_request:      "Fuel Request",
  maintenance:       "Report Maintenance",
  news_assignment:   "Assignments",
  camera_deployment: "My Schedule",
  camera_pickup:     "My Schedule",
  incident:          "Incidents",
};

const TYPE_ICON: Record<string, string> = {
  booking:           "📋",
  fuel_request:      "⛽",
  maintenance:       "🔧",
  news_assignment:   "📰",
  camera_deployment: "📷",
  camera_pickup:     "🚗",
  incident:          "🚨",
};

const TYPE_BG: Record<string, string> = {
  booking:           "rgba(37,99,235,0.08)",
  fuel_request:      "rgba(217,119,6,0.08)",
  maintenance:       "rgba(217,119,6,0.08)",
  news_assignment:   "rgba(124,58,237,0.08)",
  camera_deployment: "rgba(8,145,178,0.08)",
  camera_pickup:     "rgba(8,145,178,0.08)",
  incident:          "rgba(220,38,38,0.08)",
};

const TYPE_BORDER: Record<string, string> = {
  booking:           "var(--accent)",
  fuel_request:      "var(--amber)",
  maintenance:       "var(--amber)",
  news_assignment:   "var(--purple)",
  camera_deployment: "var(--cyan)",
  camera_pickup:     "var(--cyan)",
  incident:          "var(--red)",
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
  const [notifs,  setNotifs]  = useState<Notification[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const unread = notifs.filter(n => !n.is_read).length;

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifs((data as Notification[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel(`notifs-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => load()
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from("notifications").update({ is_read: true })
      .eq("recipient_id", user.id).eq("is_read", false);
    setNotifs(n => n.map(x => ({ ...x, is_read: true })));
  };

  const clearAll = async () => {
    if (!user?.id) return;
    await supabase.from("notifications").delete().eq("recipient_id", user.id);
    setNotifs([]);
  };

  const handleClick = async (n: Notification) => {
    await markRead(n.id);
    setOpen(false);
    const label = n.entity_type ? ENTITY_NAV_LABEL[n.entity_type] : null;
    if (label) {
      window.dispatchEvent(new CustomEvent("tms:navigate", { detail: { label } }));
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        style={{
          position: "relative", padding: 8, borderRadius: 10,
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--text-muted)",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        aria-label="Notifications"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 340, maxWidth: "92vw",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 18,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          zIndex: 9000, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Notifications</span>
              {unread > 0 && (
                <span style={{ padding: "1px 8px", borderRadius: 99, background: "var(--red-dim)", color: "var(--red)", fontSize: 11, fontWeight: 700 }}>
                  {unread}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>
                  Mark all read
                </button>
              )}
              {notifs.length > 0 && (
                <button onClick={clearAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <div className="spinner" style={{ width: 20, height: 20 }} />
              </div>
            ) : notifs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No notifications yet</p>
              </div>
            ) : notifs.map(n => {
              const bg     = TYPE_BG[n.entity_type ?? ""] ?? "var(--surface-2)";
              const border = TYPE_BORDER[n.entity_type ?? ""] ?? "var(--border)";
              const icon   = TYPE_ICON[n.entity_type ?? ""] ?? "🔔";
              const label  = n.entity_type ? ENTITY_NAV_LABEL[n.entity_type] : null;
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: !n.is_read ? "color-mix(in srgb, var(--accent) 4%, var(--surface))" : "transparent",
                    cursor: label ? "pointer" : "default",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { if (label) e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = !n.is_read ? "color-mix(in srgb, var(--accent) 4%, var(--surface))" : "transparent"; }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: bg, border: `1px solid ${border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15,
                  }}>{icon}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
                      <p style={{ fontSize: 13, fontWeight: !n.is_read ? 700 : 500, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "3px 0 0", lineHeight: 1.4 }}>{n.body}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "monospace" }}>{timeAgo(n.created_at)}</span>
                      {label && <span style={{ fontSize: 10, color: "var(--accent)" }}>→ View</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}