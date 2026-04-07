import { NavIcon as Icon } from "./NavIcon";
import { NavItem } from "./types";
import React from "react";

type SidebarProps = {
  sidebarOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
  desktopCollapsed: boolean;
  setDesktopCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  activeIndex: number;
  baseItems: NavItem[];
  navBadges: Record<string, number>;
  isProfileActive: boolean;
  go: (i: number) => void;
  logoSubtitle: string;
  installPrompt: any;
  appInstalled: boolean;
  handleInstall: () => void;
  setShowSignOutConfirm: (o: boolean) => void;
};

export function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  desktopCollapsed,
  setDesktopCollapsed,
  activeIndex,
  baseItems,
  navBadges,
  isProfileActive,
  go,
  logoSubtitle,
  installPrompt,
  appInstalled,
  handleInstall,
  setShowSignOutConfirm,
}: SidebarProps) {
  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-[color:var(--surface)] border-r border-[color:var(--border)]
          transition-all duration-200 ease-in-out
          lg:static lg:z-auto lg:translate-x-0
          ${sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full w-72"}
          ${desktopCollapsed ? "lg:w-16" : "lg:w-64 xl:w-72"}
        `}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-[color:var(--border)] shrink-0 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[color:var(--text)] flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="var(--bg)" />
                <rect x="9" y="1" width="6" height="6" rx="1" fill="var(--bg)" opacity=".5" />
                <rect x="1" y="9" width="6" height="6" rx="1" fill="var(--bg)" opacity=".5" />
                <rect x="9" y="9" width="6" height="6" rx="1" fill="var(--bg)" />
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
              onClick={() => setDesktopCollapsed((c) => !c)}
              className="hidden lg:flex p-1 rounded-md text-[color:var(--text-dim)] hover:text-[color:var(--text-muted)]"
              title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 18 18">
                <path d="M4 4 14 14M14 4 4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <nav className={`flex-1 overflow-y-auto py-4 ${desktopCollapsed ? "px-2 space-y-2" : "px-3 space-y-1"}`}>
          {baseItems.map((item, i) => {
            const isActive = i === activeIndex && !isProfileActive;
            const badge = navBadges[item.label] ?? 0;
            const dividerLabels = new Set(["users", "vehicles", "record fuel", "fuel history", "reports", "profile"]);
            const showDivider = i > 0 && dividerLabels.has(item.label.toLowerCase());

            return (
              <div key={i}>
                {showDivider && !desktopCollapsed && (
                  <div className="my-2 border-t border-[color:var(--border)] opacity-60" />
                )}

                <button
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
                    <Icon label={item.label} collapsed={desktopCollapsed} />
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
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: "var(--red)" }} />
                  )}

                  {desktopCollapsed && (
                    <span
                      className="fixed px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap z-[120] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hidden lg:block"
                      style={{
                        background: "var(--text)",
                        color: "var(--bg)",
                        left: "76px",
                      }}
                    >
                      {item.label}
                      {badge > 0 ? ` (${badge})` : ""}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        <div className={`border-t border-[color:var(--border)] shrink-0 space-y-1 ${desktopCollapsed ? "px-2 py-3" : "px-4 py-4"}`}>
          {installPrompt && !appInstalled && (
            <button
              onClick={handleInstall}
              className={`
                w-full flex items-center rounded-xl text-sm font-medium min-h-[44px] transition-colors
                ${desktopCollapsed ? "justify-center px-0 py-3" : "gap-2.5 px-3 py-2.5"}
              `}
              style={{
                background: "var(--accent-dim)",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
              }}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {!desktopCollapsed && <span>Install App</span>}
            </button>
          )}

          <button
            onClick={() => setShowSignOutConfirm(true)}
            className={`
              w-full flex items-center rounded-xl text-sm min-h-[44px] transition-colors
              text-[color:var(--text-muted)] hover:bg-[color:var(--red)]/10 hover:text-[color:var(--red)]
              ${desktopCollapsed ? "justify-center px-0 py-3" : "gap-2.5 px-3 py-2.5"}
            `}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 16 16">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!desktopCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
