// src/app/AppShell.tsx
import { ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PushNotificationSetup } from "@/components/PushNotificationSetup";
import { useAuth } from "@/hooks/useAuth";
import { markNextSignOutAsLogout } from "@/services/securityLog.service";
import { ConfirmDialog } from "@/components/TmsUI";

// Shell Components
import { Sidebar } from "./shell/Sidebar";
import { MobileHeader, DesktopHeader } from "./shell/ShellHeader";
import {
  ElementNavItem,
  NavItem,
  isElementItem,
  isRouteItem,
  ROLE_LABELS,
  ROLE_COLORS,
} from "./shell/types";

const NAV_STORAGE_KEY = "tms-active-nav-label";
const LAST_ROUTE_STORAGE_KEY = "tms-last-path";
const legacyNavStorageKey = NAV_STORAGE_KEY;

function readStoredNavLabel(key: string) {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

function writeStoredNavLabel(key: string, value: string) {
  sessionStorage.setItem(key, value);
  localStorage.setItem(key, value);
}

function clearStoredNavLabel(key: string) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

type Props = {
  title: string;
  navItems?: NavItem[];
  children?: ReactNode;
};

export default function AppShell({ title, navItems = [], children }: Props) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeIndex, setActiveIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [navBadges, setNavBadges] = useState<Record<string, number>>({});
  const [unitName, setUnitName] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [appInstalled, setAppInstalled] = useState(false);

  useEffect(() => {
    const online = () => setIsOffline(false);
    const offline = () => setIsOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setAppInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  const navStorageKey = `tms-nav-${profile?.system_role ?? "guest"}`;
  const items = navItems;
  const routeDrivenNav = items.some(isRouteItem);

  useLayoutEffect(() => {
    if (routeDrivenNav) return;
    if (!items.length) return;
    clearStoredNavLabel(legacyNavStorageKey);
    const savedLabel = readStoredNavLabel(navStorageKey);
    if (!savedLabel) return;
    const idx = items.findIndex((item) => item.label === savedLabel);
    if (idx >= 0 && idx !== activeIndex) setActiveIndex(idx);
  }, [items, activeIndex, navStorageKey, routeDrivenNav]);

  useEffect(() => {
    if (!routeDrivenNav || !items.length) return;
    const idx = items.findIndex((item) => {
      if (!isRouteItem(item)) return false;
      return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    });
    if (idx >= 0 && idx !== activeIndex) setActiveIndex(idx);
  }, [activeIndex, items, location.pathname, routeDrivenNav]);

  const hasProfile = items.length > 0 && items[items.length - 1].label.toLowerCase().includes("profile");
  const baseItems = hasProfile ? items.slice(0, -1) : items;
  const isProfileActive = hasProfile && activeIndex === items.length - 1;

  const navigateByEntity = (entityType: string, entityId?: string | null) => {
    const candidateMap: Record<string, string[]> = {
      booking: ["Finance Bookings", "Booking Approvals", "Trips", "All Bookings", "My Bookings", "Reports"],
      fuel: ["Fuel Mileage Log", "Fuel Approvals", "Fuel Requests", "Record Fuel", "Fuel History", "Reports"],
      fuel_request: ["Fuel Mileage Log", "Fuel Approvals", "Fuel Requests", "Record Fuel", "Fuel History", "Reports"],
      maintenance: ["Finance Maintenance", "Maintenance Approvals", "Maintenance", "Maintenance History", "Reports"],
      maintenance_request: ["Finance Maintenance", "Maintenance Approvals", "Maintenance", "Maintenance History", "Reports"],
      incident: ["Incidents", "Incident Report", "Reports"],
      incident_report: ["Incidents", "Incident Report", "Reports"],
      trip: ["Trips", "My Trips", "Reports"],
      driver_leave_request: ["Leave", "Drivers", "Reports"],
      user: ["Users", "User Requests", "Reports"],
      user_request: ["Users", "User Requests", "Reports"],
      password_change_request: ["Users", "User Requests", "Reports"],
      approval: ["Reports"],
    };

    const candidates = candidateMap[entityType] ?? ["Reports"];
    const idx = items.findIndex((it) => candidates.includes(it.label));

    if (idx >= 0) {
      go(idx);
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("tms:entity-focus", {
            detail: { entityType, entityId: entityId ?? null },
          })
        );
      }, 120);
    }
  };

  const go = (i: number, pushHistory = true) => {
    setActiveIndex(i);
    setSidebarOpen(false);
    const item = items[i];
    const label = item?.label ?? "";
    if (label) writeStoredNavLabel(navStorageKey, label);
    if (!item) return;
    if (isRouteItem(item)) {
      navigate(item.path);
      return;
    }
    if (!isElementItem(item)) item.onClick();
    if (pushHistory) {
      window.history.pushState({ navIndex: i, navLabel: label }, "", window.location.pathname);
    }
  };

  useEffect(() => {
    if (routeDrivenNav) return;
    const onPop = (e: PopStateEvent) => {
      const idx = e.state?.navIndex;
      const label = e.state?.navLabel;
      if (typeof idx === "number" && idx >= 0 && idx < items.length) {
        go(idx, false);
        return;
      }
      if (label) {
        const found = items.findIndex((item) => item.label === label);
        if (found >= 0) go(found, false);
      }
    };
    window.addEventListener("popstate", onPop);
    const currentLabel = items[activeIndex]?.label ?? "";
    window.history.replaceState({ navIndex: activeIndex, navLabel: currentLabel }, "", window.location.pathname);
    return () => window.removeEventListener("popstate", onPop);
  }, [items, activeIndex, routeDrivenNav]);

  useEffect(() => {
    const onNavigate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const label = detail?.label;
      const idx = label ? items.findIndex((item) => item.label === label) : -1;
      if (idx !== -1) {
        go(idx);
        return;
      }
      if (detail?.entityType) {
        navigateByEntity(detail.entityType, detail.entityId);
      }
    };
    window.addEventListener("tms:navigate", onNavigate);
    return () => window.removeEventListener("tms:navigate", onNavigate);
  }, [items]);

  const handleSignOut = async () => {
    setShowSignOutConfirm(false);
    try {
      markNextSignOutAsLogout();
      clearStoredNavLabel(legacyNavStorageKey);
      clearStoredNavLabel(navStorageKey);
      sessionStorage.removeItem(LAST_ROUTE_STORAGE_KEY);
      const keysToWipe = ["supabase.auth.token", "sb-access-token", "sb-refresh-token"];
      for (const key of keysToWipe) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
      await supabase.auth.signOut({ scope: "global" });
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      window.location.replace("/login");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadUnitName = async () => {
      if (!profile?.unit_id) {
        setUnitName(null);
        return;
      }
      const { data: u } = await supabase.from("units").select("name").eq("id", profile.unit_id).single();
      if (!cancelled) setUnitName((u as any)?.name ?? null);
    };
    void loadUnitName();
    return () => { cancelled = true; };
  }, [profile?.unit_id]);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.system_role) {
      setNavBadges({});
      return () => { cancelled = true; };
    }
    const role = profile.system_role;
    const badges: Record<string, number> = {};
    const qCount = async (label: string, table: string, filter: Record<string, string>) => {
      let q = supabase.from(table).select("id", { count: "exact", head: true });
      for (const [col, val] of Object.entries(filter)) q = q.eq(col, val);
      const { count } = await q;
      if (count && count > 0) badges[label] = count;
    };
    const run = async () => {
      const promises: Promise<void>[] = [];
      if (role === "corporate_approver" || role === "admin") {
        promises.push(qCount("Booking Approvals", "bookings", { status: "submitted" }));
        promises.push(qCount("Fuel Approvals", "fuel_requests", { status: "submitted" }));
        promises.push(qCount("Maintenance Approvals", "maintenance_requests", { status: "reported" }));
      }
      if (role === "finance_manager") {
        promises.push(qCount("Finance Bookings", "bookings", { status: "finance_pending" }));
        promises.push(qCount("Finance Maintenance", "maintenance_requests", { status: "finance_pending" }));
      }
      if (role === "transport_supervisor" || role === "admin") {
        promises.push((async () => {
          const [{ count: a }, { count: c }] = await Promise.all([
            supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "approved"),
            supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
          ]);
          const total = Number(a ?? 0) + Number(c ?? 0);
          if (total > 0) badges["Trips"] = total;
        })());
        promises.push(qCount("Record Fuel", "fuel_requests", { status: "approved" }));
      }
      if (role === "admin") promises.push(qCount("Users", "user_requests", { status: "pending" }));
      await Promise.all(promises);
      if (!cancelled) setNavBadges({ ...badges });
    };
    void run();
    return () => { cancelled = true; };
  }, [profile?.system_role]);

  const activeLabel = items[activeIndex]?.label ?? "";
  const roleLabel = ROLE_LABELS[profile?.system_role ?? ""] ?? profile?.system_role ?? "";
  const roleColor = ROLE_COLORS[profile?.system_role ?? ""] ?? "bg-[color:var(--text-muted)]";
  const initials = profile?.full_name?.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  const logoSubtitle = unitName || roleLabel || "TRANSPORT MANAGEMENT";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[color:var(--bg)]">
      <ConfirmDialog
        open={showSignOutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of TMS Portal?"
        confirmLabel="Sign Out"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />

      {isOffline && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium shrink-0 bg-[color:var(--amber-dim)] border-b border-[color:var(--amber)] text-[color:var(--amber)]">
          You are offline — some features may be unavailable
        </div>
      )}

      <MobileHeader
        activeLabel={activeLabel}
        currentUserId={user?.id ?? ""}
        profile={profile}
        hasProfile={hasProfile}
        initials={initials}
        roleColor={roleColor}
        itemsCount={items.length}
        go={go}
        setSidebarOpen={setSidebarOpen}
        onNavigate={navigateByEntity}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          desktopCollapsed={desktopCollapsed}
          setDesktopCollapsed={setDesktopCollapsed}
          activeIndex={activeIndex}
          baseItems={baseItems}
          navBadges={navBadges}
          isProfileActive={isProfileActive}
          go={go}
          logoSubtitle={logoSubtitle}
          installPrompt={installPrompt}
          appInstalled={appInstalled}
          handleInstall={handleInstall}
          setShowSignOutConfirm={setShowSignOutConfirm}
        />

        <main className="flex-1 min-w-0 flex flex-col bg-[color:var(--bg)]">
          <DesktopHeader
            activeLabel={activeLabel}
            title={title}
            currentUserId={user?.id ?? ""}
            profile={profile}
            hasProfile={hasProfile}
            isProfileActive={isProfileActive}
            initials={initials}
            roleColor={roleColor}
            roleLabel={roleLabel}
            itemsCount={items.length}
            go={go}
            onNavigate={navigateByEntity}
          />

          <PushNotificationSetup />

          <div id="page-scroll" className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-7xl mx-auto w-full">
              <ErrorBoundary>
                {routeDrivenNav
                  ? children
                  : items[activeIndex] && isElementItem(items[activeIndex])
                  ? (items[activeIndex] as ElementNavItem).element
                  : children}
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
