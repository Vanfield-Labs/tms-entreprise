// src/app/AppShell.tsx
import { ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/context/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ─── Types ────────────────────────────────────────────────────────────────────
type ClickNavItem   = { label: string; onClick: () => void };
type ElementNavItem = { label: string; element: ReactNode };
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
  admin:                "Administrator",
  corporate_approver:   "Corporate Approver",
  transport_supervisor: "Transport Supervisor",
  driver:               "Driver",
  unit_head:            "Unit Head",
  staff:                "Staff",
};

const ROLE_COLORS: Record<string, string> = {
  admin:                "bg-[color:var(--purple)]",
  corporate_approver:   "bg-[color:var(--accent)]",
  transport_supervisor: "bg-[color:var(--green)]",
  driver:               "bg-[color:var(--cyan)]",
  unit_head:            "bg-[color:var(--amber)]",
  staff:                "bg-[color:var(--text-muted)]",
};

type ProfileData = {
  full_name: string;
  system_role: string;
  unit_id: string | null;
  position_title: string | null;
};

// ─── AppShell ─────────────────────────────────────────────────────────────────
export default function AppShell({ title, nav, navItems, children }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [profile,  setProfile]  = useState<ProfileData | null>(null);
  const [unitName, setUnitName] = useState<string | null>(null);

  const items = useMemo<NavItem[]>(() => {
    if (navItems?.length) return navItems;
    if (nav?.length)      return nav;
    return [];
  }, [nav, navItems]);

  const hasProfile      = items.length > 0 && items[items.length - 1].label.toLowerCase().includes("profile");
  const baseItems       = hasProfile ? items.slice(0, -1) : items;
  const isProfileActive = hasProfile && activeIndex === items.length - 1;

  const go = (i: number) => {
    setActiveIndex(i);
    setSidebarOpen(false);
    const item = items[i];
    if (item && !isElementItem(item)) item.onClick();
  };

  const activeItem  = items[activeIndex];
  const activeLabel = activeItem?.label ?? "";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, system_role, unit_id, position_title")
        .eq("user_id", user.id)
        .single();
      if (!p) return;
      setProfile(p as ProfileData);
      if ((p as ProfileData).unit_id) {
        const { data: u } = await supabase
          .from("units").select("name")
          .eq("id", (p as ProfileData).unit_id!).single();
        if (u) setUnitName((u as any).name as string);
      }
    })();
  }, []);

  const roleLabel       = ROLE_LABELS[profile?.system_role ?? ""] ?? profile?.system_role ?? "";
  const roleColor       = ROLE_COLORS[profile?.system_role ?? ""] ?? "bg-[color:var(--text-muted)]";
  const initials        = profile?.full_name
    ? profile.full_name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  // Sidebar logo subtitle: unit name if set, else role
  const logoSubtitle    = unitName ?? roleLabel;

  // ── ThemeToggle — used in mobile bar AND desktop header, NOT in sidebar ──
  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="p-2 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)] transition-colors"
    >
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

      {/* ══════════════════════════════════════════════════════════
          MOBILE TOP BAR
          Theme toggle + avatar sit here only.
          Sidebar has zero ThemeToggles.
      ══════════════════════════════════════════════════════════ */}
      <header className="lg:hidden flex items-center justify-between h-14 px-4
        border-b border-[color:var(--border)] bg-[color:var(--surface)] shrink-0 z-30">
        <button onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] transition-colors"
          aria-label="Open menu">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        <span className="text-sm font-semibold text-[color:var(--text)] truncate px-3">{activeLabel}</span>

        <div className="flex items-center gap-1 shrink-0">
          <ThemeToggle />
          {profile && (
            <button
              onClick={() => hasProfile ? go(items.length - 1) : undefined}
              className={`w-8 h-8 rounded-full ${roleColor} flex items-center justify-center
                text-white text-xs font-bold hover:opacity-80 transition-opacity`}
              title={`${profile.full_name} — tap to view profile`}
            >
              {initials}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* ══════════════════════════════════════════════════════════
            SIDEBAR
            • NO ThemeToggle anywhere here
            • Logo subtitle = unit name (falls back to role)
            • Footer = Profile link (if present) + Sign out ONLY
              No profile info card at all
        ══════════════════════════════════════════════════════════ */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          w-72 lg:w-64 xl:w-72
          bg-[color:var(--surface)] border-r border-[color:var(--border)]
          transition-transform duration-200 ease-in-out
          lg:static lg:z-auto lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}>

          {/* Logo row — close button only, NO theme toggle */}
          <div className="flex items-center justify-between px-5 py-5
            border-b border-[color:var(--border)] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[color:var(--text)] flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="6" height="6" rx="1" fill="var(--bg)"/>
                  <rect x="9" y="1" width="6" height="6" rx="1" fill="var(--bg)" opacity=".5"/>
                  <rect x="1" y="9" width="6" height="6" rx="1" fill="var(--bg)" opacity=".5"/>
                  <rect x="9" y="9" width="6" height="6" rx="1" fill="var(--bg)"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[color:var(--text)] leading-tight">TMS Portal</p>
                {/* Unit name shown here — not role, not title */}
                <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-widest truncate">
                  {logoSubtitle}
                </p>
              </div>
            </div>
            {/* Mobile close — no theme toggle */}
            <button onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-[color:var(--text-muted)]
                hover:bg-[color:var(--surface-2)] transition-colors shrink-0"
              aria-label="Close sidebar">
              <svg width="16" height="16" fill="none" viewBox="0 0 18 18">
                <path d="M4 4 14 14M14 4 4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {baseItems.map((item, i) => {
              const isActive = i === activeIndex && !isProfileActive;
              return (
                <button key={i} onClick={() => go(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    text-left transition-all min-h-[44px] group
                    ${isActive
                      ? "bg-[color:var(--text)] text-[color:var(--bg)] shadow-sm"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]"
                    }`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors
                    ${isActive
                      ? "bg-[color:var(--bg)]"
                      : "bg-[color:var(--border-bright)] group-hover:bg-[color:var(--text-muted)]"}`}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Footer — Profile link + Sign out. No info card. */}
          <div className="border-t border-[color:var(--border)] px-4 py-4 shrink-0 space-y-0.5">
           {/*} {hasProfile && profile && (
              <button onClick={() => go(items.length - 1)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                  text-sm font-medium text-left transition-all min-h-[44px] group
                  ${isProfileActive
                    ? "bg-[color:var(--text)] text-[color:var(--bg)] shadow-sm"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]"
                  }`}>
                <div className={`w-6 h-6 rounded-full ${roleColor} flex items-center justify-center
                  text-white text-[10px] font-bold shrink-0`}>
                  {initials}
                </div>
                <span>Profile</span>
              </button>
            )} */}

            <button onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm
                text-[color:var(--text-muted)] hover:bg-[color:var(--red)]/10
                hover:text-[color:var(--red)] transition-colors min-h-[44px]">
              <svg width="15" height="15" fill="none" viewBox="0 0 16 16">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sign out
            </button>
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════════
            MAIN CONTENT
        ══════════════════════════════════════════════════════════ */}
        {/*
          ── IMPORTANT: <main> has NO overflow property.
          overflow on a containing block traps position:fixed children (WebKit/Blink).
          The scroll lives on the inner #page-scroll div instead.
        */}
        <main className="flex-1 min-w-0 bg-[color:var(--bg)]" style={{ display: "flex", flexDirection: "column" }}>

          {/* Desktop sticky header */}
          <div className="hidden lg:flex items-center justify-between px-8 py-4
            border-b border-[color:var(--border)] bg-[color:var(--surface)] shrink-0"
            style={{ zIndex: 20 }}>
            <div>
              <h1 className="text-base font-bold text-[color:var(--text)] tracking-tight leading-tight">
                {activeLabel}
              </h1>
              <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5 uppercase tracking-wider font-mono">
                {/*{title} · {roleLabel}*/}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {profile && (
                <button
                  onClick={() => hasProfile ? go(items.length - 1) : undefined}
                  title="View profile"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl
                    border border-[color:var(--border)]
                    hover:bg-[color:var(--surface-2)] hover:border-[color:var(--border-bright)]
                    transition-all group
                    ${isProfileActive
                      ? "bg-[color:var(--surface-2)] border-[color:var(--border-bright)]"
                      : "bg-transparent"}`}>
                  <div className={`w-7 h-7 rounded-full ${roleColor} flex items-center justify-center
                    text-white text-[10px] font-bold shrink-0`}>
                    {initials}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-semibold text-[color:var(--text)] truncate max-w-[140px]">
                      {profile.full_name}
                    </p>
                    <p className="text-[10px] text-[color:var(--text-muted)] truncate">
                      {profile.position_title ?? roleLabel}
                    </p>
                  </div>
                  <svg width="12" height="12" fill="none" viewBox="0 0 12 12"
                    className="text-[color:var(--text-dim)] group-hover:text-[color:var(--text-muted)] transition-colors shrink-0 ml-0.5">
                    <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* ── Scrollable page content — overflow lives HERE, not on <main> ── */}
          <div id="page-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
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