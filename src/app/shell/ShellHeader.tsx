import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";

type MobileHeaderProps = {
  activeLabel: string;
  currentUserId: string;
  profile: any;
  hasProfile: boolean;
  initials: string;
  roleColor: string;
  itemsCount: number;
  go: (i: number) => void;
  setSidebarOpen: (o: boolean) => void;
  onNavigate: (type: string, id?: string | null) => void;
};

export function MobileHeader({
  activeLabel,
  currentUserId,
  profile,
  hasProfile,
  initials,
  roleColor,
  itemsCount,
  go,
  setSidebarOpen,
  onNavigate,
}: MobileHeaderProps) {
  return (
    <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-[color:var(--border)] bg-[color:var(--surface)] shrink-0 z-30">
      <button
        onClick={() => setSidebarOpen(true)}
        className="p-2 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] transition-colors"
        aria-label="Open menu"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <span className="text-sm font-semibold text-[color:var(--text)] truncate px-3 text-center">
        {activeLabel}
      </span>

      <div className="flex items-center gap-1.5 shrink-0">
        <ThemeToggle />
        {currentUserId && (
          <NotificationBell currentUserId={currentUserId} onNavigate={onNavigate} />
        )}
        {profile && (
          <button
            onClick={() => (hasProfile ? go(itemsCount - 1) : undefined)}
            className={`w-8 h-8 rounded-full ${roleColor} flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity ring-1 ring-black/5`}
            title={profile.full_name}
          >
            {initials}
          </button>
        )}
      </div>
    </header>
  );
}

type DesktopHeaderProps = {
  activeLabel: string;
  title: string;
  currentUserId: string;
  profile: any;
  hasProfile: boolean;
  isProfileActive: boolean;
  initials: string;
  roleColor: string;
  roleLabel: string;
  itemsCount: number;
  go: (i: number) => void;
  onNavigate: (type: string, id?: string | null) => void;
};

export function DesktopHeader({
  activeLabel,
  title,
  currentUserId,
  profile,
  hasProfile,
  isProfileActive,
  initials,
  roleColor,
  roleLabel,
  itemsCount,
  go,
  onNavigate,
}: DesktopHeaderProps) {
  return (
    <header
      className="hidden lg:flex items-center justify-between px-8 xl:px-10 py-4 border-b border-[color:var(--border)] bg-[color:var(--surface)] shrink-0"
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
          <NotificationBell currentUserId={currentUserId} onNavigate={onNavigate} />
        )}
        {profile && (
          <button
            onClick={() => (hasProfile ? go(itemsCount - 1) : undefined)}
            title="View profile"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all group ${
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
              <p className="text-xs font-semibold truncate max-w-[160px]" style={{ color: "var(--text)" }}>
                {profile.full_name}
              </p>
              <p className="text-[10px] uppercase tracking-wide truncate" style={{ color: "var(--text-muted)" }}>
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
    </header>
  );
}
