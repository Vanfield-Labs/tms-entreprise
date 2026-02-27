// src/app/AppShell.tsx
import { ReactNode, useMemo, useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy-load profile to avoid circular dep
const ProfilePage = lazy(() => import("../pages/profile/ProfilePage"));

type ClickNavItem = { label: string; onClick: () => void };
type ElementNavItem = { label: string; element: ReactNode };
type NavItem = ClickNavItem | ElementNavItem;

type Props = {
  title: string;
  nav?: ClickNavItem[];
  navItems?: ElementNavItem[];
  children?: ReactNode;
};

function isElementItem(item: NavItem): item is ElementNavItem {
  return "element" in item;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-rose-500",
  corporate_approver: "bg-violet-500",
  transport_supervisor: "bg-amber-500",
  driver: "bg-emerald-500",
  unit_head: "bg-sky-500",
  staff: "bg-slate-400",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  corporate_approver: "Corporate Approver",
  transport_supervisor: "Transport Supervisor",
  driver: "Driver",
  unit_head: "Unit Head",
  staff: "Staff",
};

const PROFILE_ITEM: ElementNavItem = {
  label: "My Profile",
  element: (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>}>
      <ProfilePage />
    </Suspense>
  ),
};

export default function AppShell({ title, nav, navItems, children }: Props) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const baseItems = useMemo<NavItem[]>(() => {
    if (navItems?.length) return navItems;
    if (nav?.length) return nav;
    return [];
  }, [nav, navItems]);

  // Append Profile as the last item always
  const items = useMemo<NavItem[]>(() => [...baseItems, PROFILE_ITEM], [baseItems]);

  const isProfileActive = activeIndex === items.length - 1;
  const activeItem = items[activeIndex];
  const activeLabel = activeItem?.label ?? title;

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const go = (i: number) => {
    setActiveIndex(i);
    setSidebarOpen(false);
    const item = items[i];
    if (item && !isElementItem(item)) item.onClick();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const roleColor = ROLE_COLORS[profile?.system_role ?? ""] ?? "bg-slate-400";
  const roleLabel = ROLE_LABELS[profile?.system_role ?? ""] ?? (profile?.system_role ?? "");
  const initials = profile?.full_name
    ? profile.full_name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f5]" style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>

      {/* ── Mobile top bar ── */}
      <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200 sticky top-0 z-30 shrink-0">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Open menu">
          <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
            <path d="M3 5H17M3 10H17M3 15H17" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">{activeLabel}</span>
        <button onClick={() => go(items.length - 1)} title="My Profile"
          className={`w-8 h-8 rounded-full ${roleColor} flex items-center justify-center text-white text-xs font-bold shrink-0 hover:opacity-80 transition-opacity`}>
          {initials}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Sidebar ── */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50 shrink-0
          w-72 lg:w-64 xl:w-72
          flex flex-col bg-white border-r border-gray-200
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}>
          {/* Logo */}
          <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="6" height="6" rx="1" fill="white"/>
                  <rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity=".5"/>
                  <rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity=".5"/>
                  <rect x="9" y="9" width="6" height="6" rx="1" fill="white"/>
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 leading-tight">TMS Portal</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest truncate">{title}</div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 shrink-0">
              <svg width="16" height="16" fill="none" viewBox="0 0 18 18"><path d="M4 4L14 14M14 4L4 14" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* Nav — exclude profile from main list */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {baseItems.map((item, i) => (
              <button key={i} onClick={() => go(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all group
                  ${i === activeIndex && !isProfileActive ? "bg-black text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors
                  ${i === activeIndex && !isProfileActive ? "bg-white" : "bg-gray-300 group-hover:bg-gray-400"}`} />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-4 shrink-0 space-y-1">
            {profile && (
              <button onClick={() => go(items.length - 1)}
                className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors ${isProfileActive ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                <div className={`w-9 h-9 rounded-full ${roleColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {initials}
                </div>
                <div className="min-w-0 text-left flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</div>
                  <div className="text-[11px] text-gray-400 truncate">{roleLabel}</div>
                </div>
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            )}
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
            <div className="hidden lg:flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{activeLabel}</h1>
                <p className="text-xs text-gray-400 mt-0.5">{roleLabel}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className={`w-2 h-2 rounded-full ${roleColor}`} />
                {profile?.full_name}
              </div>
            </div>
            <ErrorBoundary>
              {activeItem && isElementItem(activeItem) ? activeItem.element : children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}