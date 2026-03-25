// src/app/AppShell.tsx
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/context/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PushNotificationSetup } from "@/components/PushNotificationSetup";
import { useAuth } from "@/hooks/useAuth";

const ENTITY_ICON: Record<string, string> = {
  booking: "📅",
  fuel: "⛽",
  maintenance: "🛠",
  incident: "⚠️",
  trip: "🚗",
  approval: "✅",
  default: "🔔",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ClickNavItem   = { label: string; icon?: ReactNode; badge?: number; onClick: () => void };
type ElementNavItem = { label: string; icon?: ReactNode; badge?: number; element: ReactNode };
type NavItem        = ClickNavItem | ElementNavItem;

type Props = {
  title: string;
  nav?: ClickNavItem[];
  navItems?: ElementNavItem[];
  children?: ReactNode;
};

function isElementItem(item: NavItem): item is ElementNavItem {
  return "element" in item;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator", corporate_approver: "Corporate Approver",
  transport_supervisor: "Transport Supervisor", driver: "Driver",
  unit_head: "Unit Head", staff: "Staff",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-[color:var(--purple)]", corporate_approver: "bg-[color:var(--accent)]",
  transport_supervisor: "bg-[color:var(--green)]", driver: "bg-[color:var(--cyan)]",
  unit_head: "bg-[color:var(--amber)]", staff: "bg-[color:var(--text-muted)]",
};

// ─── Nav icons keyed by label fragment ───────────────────────────────────────
function NavIcon({ label, collapsed }: { label: string; collapsed: boolean }) {
  const l = label.toLowerCase();
  const size = collapsed ? 18 : 15;
  const cls = `shrink-0`;

  const icon = (() => {
    if (l.includes("dispatch"))      return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>;
    if (l.includes("booking") || l.includes("new booking")) return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>;
    if (l.includes("trip"))          return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>;
    if (l.includes("shift") || l.includes("schedule")) return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>;
    if (l.includes("mainten"))       return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>;
    if (l.includes("incident"))      return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>;
    if (l.includes("fuel"))          return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3h10l2 4v12a1 1 0 01-1 1H6a1 1 0 01-1-1V7L5 3z"/><path strokeLinecap="round" d="M9 11h6"/></svg>;
    if (l.includes("vehicle") || l.includes("fleet")) return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M13 6H5l-2 8h15l-1-5H9l-1 3"/></svg>;
    if (l.includes("driver"))        return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path strokeLinecap="round" d="M6 20v-1a6 6 0 0112 0v1"/></svg>;
    if (l.includes("report") || l.includes("audit")) return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>;
    if (l.includes("user"))          return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>;
    if (l.includes("mileage"))       return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path strokeLinecap="round" d="M12 8v4l3 3"/></svg>;
    if (l.includes("division"))      return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>;
    if (l.includes("approv"))        return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
    if (l.includes("profile"))       return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>;
    if (l.includes("close"))         return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>;
    if (l.includes("record fuel"))   return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
    // default
    return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 8v4l2 2"/></svg>;
  })();

  return <span className={cls}>{icon}</span>;
}

// ─── Notification Bell ────────────────────────────────────────────────────────
type NotifRow = {
  id: string; title: string; body: string; is_read: boolean;
  created_at: string; entity_type: string | null; entity_id: string | null;
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

function NotificationBell({ currentUserId, onNavigate }: { currentUserId: string; onNavigate: (entityType: string) => void }) {
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  setNotifs((data as NotifRow[]) || []);
};

  useEffect(() => { load(); }, [currentUserId]);

  useEffect(() => {
  if (!currentUserId) {
    setNotifs([]);
    return;
  }

  load();

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
      () => load()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(ch);
  };
}, [currentUserId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = notifs.filter(n => !n.is_read).length;

  const markRead = async (id: string, entityType: string | null) => {
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    if (entityType) onNavigate(entityType);
    setOpen(false);
  };

  const markAllRead = async () => {
  if (!currentUserId) return;

  await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", currentUserId)
    .eq("is_read", false);

  setNotifs(n => n.map(x => ({ ...x, is_read: true })));
};

  const clearAll = async () => {
  if (!currentUserId) return;

  await supabase
    .from("notifications")
    .delete()
    .eq("recipient_id", currentUserId);

  setNotifs([]);
};

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        className="relative p-2 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)] transition-colors"
        aria-label="Notifications"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: "var(--red)" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl border overflow-hidden z-50"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>Notifications</span>
              {unread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: "var(--red)" }}>{unread}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && <button onClick={markAllRead} className="text-xs font-medium" style={{ color: "var(--accent)" }}>Mark all read</button>}
              {notifs.length > 0 && <button onClick={clearAll} className="text-xs" style={{ color: "var(--text-muted)" }}>Clear all</button>}
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {notifs.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {notifs.map(n => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id, n.entity_type)}
                    className="w-full text-left px-4 py-3 transition-colors hover:bg-[color:var(--surface-2)]"
                    style={{ background: n.is_read ? "transparent" : "color-mix(in srgb, var(--accent-dim) 30%, transparent)" }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 mt-0.5">{ENTITY_ICON[n.entity_type ?? "default"] ?? ENTITY_ICON.default}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{n.title}</p>
                          {!n.is_read && <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: "var(--accent)" }} />}
                        </div>
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>{n.body}</p>
                        <p className="text-[10px] mt-1 font-mono" style={{ color: "var(--text-dim)" }}>{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", variant = "danger",
  onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string; confirmLabel?: string;
  variant?: "danger" | "primary"; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>{title}</h3>
        <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn btn-ghost">Cancel</button>
          <button onClick={onConfirm}
            className={`btn ${variant === "danger" ? "btn-danger" : "btn-primary"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────
export default function AppShell({ title, nav, navItems, children }: Props) {
const { theme, toggleTheme } = useTheme();
const { user, profile } = useAuth();
const [sidebarOpen, setSidebarOpen] = useState(false);
const [desktopCollapsed, setDesktopCollapsed] = useState(false);
const [activeIndex, setActiveIndex] = useState(0);
const [unitName, setUnitName] = useState<string | null>(null);

const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
const [navBadges, setNavBadges] = useState<Record<string, number>>({});

  // ── NEW: PWA install prompt ───────────────────────────────────────────────
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [appInstalled,  setAppInstalled]  = useState(false);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstallPrompt(null); setAppInstalled(true); });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") { setInstallPrompt(null); setAppInstalled(true); }
  };

  // ── NEW: Offline detection ────────────────────────────────────────────────
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline  = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const items = useMemo<NavItem[]>(() => {
    if (navItems?.length) return navItems;
    if (nav?.length) return nav;
    return [];
  }, [nav, navItems]);

  const hasProfile = items.length > 0 && items[items.length - 1].label.toLowerCase().includes("profile");
  const baseItems = hasProfile ? items.slice(0, -1) : items;
  const isProfileActive = hasProfile && activeIndex === items.length - 1;

  const go = (i: number, pushHistory = true) => {
    setActiveIndex(i);
    setSidebarOpen(false);
    const item = items[i];
    if (item && !isElementItem(item)) item.onClick();
    if (pushHistory) {
      window.history.pushState({ navIndex: i }, "", window.location.pathname);
    }
  };

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const idx = e.state?.navIndex;
      if (typeof idx === "number" && idx >= 0 && idx < items.length) {
        go(idx, false);
      }
    };
    window.addEventListener("popstate", onPop);
    window.history.replaceState({ navIndex: activeIndex }, "", window.location.pathname);
    return () => window.removeEventListener("popstate", onPop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useEffect(() => {
    const onNavigate = (e: Event) => {
      const label = (e as CustomEvent<{ label: string }>).detail?.label;
      if (!label) return;
      const idx = items.findIndex(item => item.label === label);
      if (idx !== -1) go(idx);
    };
    window.addEventListener("tms:navigate", onNavigate);
    return () => window.removeEventListener("tms:navigate", onNavigate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const activeItem = items[activeIndex];
  const activeLabel = activeItem?.label ?? "";

  const handleSignOut = async () => {
    setShowSignOutConfirm(false);
    await supabase.auth.signOut();
    window.location.href = "/login";
  };


useEffect(() => {
  let cancelled = false;

  const loadUnitName = async () => {
    if (!profile?.unit_id) {
      setUnitName(null);
      return;
    }

    const { data: u } = await supabase
      .from("units")
      .select("name")
      .eq("id", profile.unit_id)
      .single();

    if (!cancelled) {
      setUnitName((u as { name?: string } | null)?.name ?? null);
    }
  };

  loadUnitName();

  return () => {
    cancelled = true;
  };
}, [profile?.unit_id]);

useEffect(() => {
  let cancelled = false;

  if (!profile?.system_role) {
    setNavBadges({});
    return () => {
      cancelled = true;
    };
  }

  const role = profile.system_role;
  const badges: Record<string, number> = {};
  const promises: Promise<void>[] = [];

  const qCount = async (label: string, table: string, filter: Record<string, string>) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    for (const [col, val] of Object.entries(filter)) {
      q = q.eq(col, val);
    }
    const { count } = await q;
    if (count && count > 0) {
      badges[label] = count;
    }
  };

  if (role === "corporate_approver" || role === "admin") {
    promises.push(qCount("Booking Approvals", "bookings", { status: "submitted" }));
    promises.push(qCount("Fuel Approvals", "fuel_requests", { status: "submitted" }));
    promises.push(qCount("Maintenance Approvals", "maintenance_requests", { status: "reported" }));
  }

  if (role === "transport_supervisor" || role === "admin") {
    promises.push(qCount("Dispatch", "bookings", { status: "approved" }));
    promises.push(qCount("Record Fuel", "fuel_requests", { status: "approved" }));
    promises.push(qCount("Close Trips", "bookings", { status: "completed" }));
  }

  if (role === "admin") {
    promises.push(qCount("Users", "user_requests", { status: "pending" }));
  }

  Promise.all(promises).then(() => {
    if (!cancelled) {
      setNavBadges({ ...badges });
    }
  });

  return () => {
    cancelled = true;
  };
}, [profile?.system_role]);

  const navigateByEntity = (entityType: string) => {
    const entityToLabel: Record<string, string> = {
      booking:           "My Bookings",
      fuel_request:      "Fuel Request",
      maintenance:       "Report Maintenance",
      incident:          "Incidents",
      news_assignment:   "Assignments",
      camera_deployment: "My Schedule",
      camera_pickup:     "My Schedule",
      user:              "Users",
    };
    const target = entityToLabel[entityType];
    if (!target) return;
    const idx = items.findIndex(it => it.label === target);
    if (idx >= 0) go(idx);
  };

  const roleLabel = ROLE_LABELS[profile?.system_role ?? ""] ?? profile?.system_role ?? "";
  const roleColor = ROLE_COLORS[profile?.system_role ?? ""] ?? "bg-[color:var(--text-muted)]";
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const logoSubtitle = unitName || roleLabel || "TRANSPORT MANAGEMENT";
  const currentUserId = user?.id ?? "";

  const ThemeToggle = () => (
    <button onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="p-2 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)] transition-colors">
      {theme === "dark" ? (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5"/>
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      ) : (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
      )}
    </button>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[color:var(--bg)]">

      {/* ── Confirm sign out ── */}
      <ConfirmDialog
        open={showSignOutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of TMS Portal?"
        confirmLabel="Sign Out"
        variant="danger"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />

      {/* ── NEW: Offline banner ───────────────────────────────────────────── */}
      {isOffline && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium shrink-0"
          style={{ background: "var(--amber-dim)", borderBottom: "1px solid var(--amber)", color: "var(--amber)" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18"/>
          </svg>
          You are offline — some features may be unavailable
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MOBILE TOP BAR
      ══════════════════════════════════════════════════════ */}
      <header className="lg:hidden flex items-center justify-between h-14 px-4
        border-b border-[color:var(--border)] bg-[color:var(--surface)] shrink-0 z-30">
        <button onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] transition-colors"
          aria-label="Open menu">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-[color:var(--text)] truncate px-3 text-center">{activeLabel}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <ThemeToggle />
          {currentUserId && <NotificationBell currentUserId={currentUserId} onNavigate={navigateByEntity} />}
         {profile && (
  <button
    onClick={() => (hasProfile ? go(items.length - 1) : undefined)}
    className={`w-8 h-8 rounded-full ${roleColor} flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity ring-1 ring-black/5`}
    title={profile.full_name}
  >
    {initials}
  </button>
)}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Backdrop (mobile) */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* ══════════════════════════════════════════════════════
            SIDEBAR
        ══════════════════════════════════════════════════════ */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-[color:var(--surface)] border-r border-[color:var(--border)]
          transition-all duration-200 ease-in-out
          lg:static lg:z-auto lg:translate-x-0
          ${sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full w-72"}
          ${desktopCollapsed ? "lg:w-16" : "lg:w-64 xl:w-72"}
        `}>
          {/* Logo row */}
          <div className="flex items-center justify-between px-4 py-5 border-b border-[color:var(--border)] shrink-0 select-none">
  <div className="flex items-center gap-3 min-w-0">
    <div className="w-8 h-8 rounded-lg bg-[color:var(--text)] flex items-center justify-center shrink-0">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1" fill="var(--bg)"/>
        <rect x="9" y="1" width="6" height="6" rx="1" fill="var(--bg)" opacity=".5"/>
        <rect x="1" y="9" width="6" height="6" rx="1" fill="var(--bg)" opacity=".5"/>
        <rect x="9" y="9" width="6" height="6" rx="1" fill="var(--bg)"/>
      </svg>
    </div>

    {!desktopCollapsed && (
      <div className="min-w-0 hidden lg:block">
        <p className="text-sm font-bold text-[color:var(--text)] leading-tight">TMS Portal</p>
        <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-widest truncate">
          {logoSubtitle}
        </p>
      </div>
    )}

    <div className="min-w-0 lg:hidden">
      <p className="text-sm font-bold text-[color:var(--text)] leading-tight">TMS Portal</p>
      <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-widest truncate">
        {logoSubtitle}
      </p>
    </div>
  </div>

  <div className="flex items-center gap-1 shrink-0">
    <button
      onClick={() => setDesktopCollapsed(c => !c)}
      className="hidden lg:flex p-1 rounded-md text-[color:var(--text-dim)] hover:text-[color:var(--text-muted)]"
      title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {desktopCollapsed ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
        )}
      </svg>
    </button>

    <button
      onClick={() => setSidebarOpen(false)}
      className="lg:hidden p-1.5 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)]"
      aria-label="Close menu"
    >
      <svg width="16" height="16" fill="none" viewBox="0 0 18 18">
        <path d="M4 4 14 14M14 4 4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  </div>
</div>

          {/* Nav items */}
          <nav className={`flex-1 overflow-y-auto py-4 ${desktopCollapsed ? "px-2 space-y-2" : "px-3 space-y-1"}`}>
            {baseItems.map((item, i) => {
              const isActive = i === activeIndex && !isProfileActive;
              const badge = navBadges[item.label] ?? 0;

              const dividerLabels = new Set([
                "users",
                "vehicles",
                "record fuel",
                "fuel history",
                "reports",
                "profile",
              ]);

              const showDivider =
               i > 0 && dividerLabels.has(item.label.toLowerCase());
             return (
  <>
    {showDivider && !desktopCollapsed && (
      <div className="my-2 border-t border-[color:var(--border)] opacity-60" />
    )}

    <button
      key={i}
      onClick={() => go(i)}
      title={desktopCollapsed ? item.label : undefined}
      className={`
        w-full flex items-center rounded-xl text-sm font-medium text-left
        transition-all min-h-[44px] relative group
        ${desktopCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5"}
        ${
          isActive
            ? "bg-[color:var(--text)] text-[color:var(--bg)] shadow-sm"
            : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]"
        }
      `}
    >
      <span style={{ color: isActive ? "var(--bg)" : "currentColor" }}>
        <NavIcon label={item.label} collapsed={desktopCollapsed} />
      </span>

      {!desktopCollapsed && <span className="flex-1 truncate">{item.label}</span>}

      {badge > 0 && !desktopCollapsed && (
        <span
          className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: "var(--red)" }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}

      {badge > 0 && desktopCollapsed && (
        <span
          className="absolute top-1 right-1 w-2 h-2 rounded-full"
          style={{ background: "var(--red)" }}
        />
      )}

      {desktopCollapsed && (
       <span
  className="fixed px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap z-[120] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hidden lg:block"
  style={{
    background: "var(--text)",
    color: "var(--bg)",
    left: desktopCollapsed ? "76px" : undefined,
  }}
>
          {item.label}
          {badge > 0 ? ` (${badge})` : ""}
        </span>
      )}
    </button>
  </>
);
            })}
          </nav>

          {/* Footer: install button (when available) + sign out */}
          <div className={`border-t border-[color:var(--border)] shrink-0 space-y-1 ${desktopCollapsed ? "px-2 py-3" : "px-4 py-4"}`}>

            {/* ── NEW: PWA Install button — only when browser deems app installable ── */}
            {installPrompt && !appInstalled && (
              <button
                onClick={handleInstall}
                title={desktopCollapsed ? "Install App" : undefined}
                className={`
                  w-full flex items-center rounded-xl text-sm font-medium min-h-[44px] transition-colors 
                  ${desktopCollapsed ? "justify-center px-0 py-3" : "gap-2.5 px-3 py-2.5"}
                `}
                style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)" }}
              >
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                {!desktopCollapsed && <span>Install App</span>}
              </button>
            )}

            <button
              onClick={() => setShowSignOutConfirm(true)}
              title={desktopCollapsed ? "Sign out" : undefined}
              className={`
                w-full flex items-center rounded-xl text-sm min-h-[44px] transition-colors
                text-[color:var(--text-muted)] hover:bg-[color:var(--red)]/10 hover:text-[color:var(--red)]
                ${desktopCollapsed ? "justify-center px-0 py-3" : "gap-2.5 px-3 py-2.5"}
              `}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 16 16">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {!desktopCollapsed && <span>Sign out</span>}
            </button>
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════
            MAIN CONTENT
        ══════════════════════════════════════════════════════ */}
              <main
          className="flex-1 min-w-0 bg-[color:var(--bg)]"
          style={{ display: "flex", flexDirection: "column" }}
        >
          {/* Desktop sticky header */}
          <div
            className="hidden lg:flex items-center justify-between px-8 xl:px-10 py-4
            border-b border-[color:var(--border)] bg-[color:var(--surface)] shrink-0"
            style={{ zIndex: 20 }}
          >
            <div className="flex flex-col">
              <h1 className="text-base font-semibold text-[color:var(--text)] tracking-tight">
                {activeLabel}
              </h1>
              <span className="text-[10px] uppercase tracking-widest text-[color:var(--text-dim)]">
                {title}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              {currentUserId && (
                <NotificationBell currentUserId={currentUserId} onNavigate={navigateByEntity} />
              )}
              {profile && (
                <button
                  onClick={() => (hasProfile ? go(items.length - 1) : undefined)}
                  title="View profile"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all group
                    ${
                      isProfileActive
                        ? "bg-[color:var(--surface-2)] border-[color:var(--border-bright)]"
                        : "border-[color:var(--border)] hover:bg-[color:var(--surface-2)] hover:border-[color:var(--border-bright)]"
                    }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full ${roleColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
                  >
                    {initials}
                  </div>
                <div className="text-left min-w-0">
  <p
    className="text-xs font-semibold truncate max-w-[160px]"
    style={{ color: "var(--text)" }}
  >
    {profile.full_name}
  </p>
  <p
    className="text-[10px] uppercase tracking-wide truncate"
    style={{ color: "var(--text-muted)" }}
  >
    {profile.position_title ?? roleLabel}
  </p>
</div>
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    viewBox="0 0 12 12"
                    className="shrink-0 ml-0.5"
                    style={{ color: "var(--text-dim)" }}
                  >
                    <path
                      d="M4.5 3l3 3-3 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <PushNotificationSetup />

          {/* Scrollable content */}
          <div
            id="page-scroll"
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}
          >
            <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-7xl mx-auto w-full">
              <ErrorBoundary>
                {activeItem && isElementItem(activeItem) ? activeItem.element : children}
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}