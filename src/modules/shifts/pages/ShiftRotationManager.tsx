// src/modules/shifts/pages/ShiftRotationManager.tsx
// Queries real tables only — no v_today_deployment dependency.
// shift_schedules uses shift_code: 'morning' | 'evening' | 'off'
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────
type Team = {
  id: string;
  name: string;
  description: string | null;
  cycle_phase_offset: number;
  cycle_start_date: string | null;
};

type Driver = {
  id: string;
  full_name: string | null;
  license_number: string;
  phone: string | null;
  team_id: string | null;
  team_role: string | null;
  driver_type: string | null;
  evening_route_id: string | null;
  employment_status: string;
};

type ShiftRow = {
  driver_id: string;
  shift_date: string;
  shift_code: "morning" | "evening" | "off";
  is_override: boolean;
  plan_name: string | null;
};

type EveningRoute = { id: string; name: string; route_type: string };
type TeamSchedule = {
  team_id: string;
  shift_date: string;
  shift_type: string;
  cycle_day: number;
};

// Derived view — built in JS from the above
type TodayDriver = Driver & {
  today_shift: "morning" | "evening" | "off" | null;
  team_name: string | null;
  evening_route_name: string | null;
};

// ── Constants ────────────────────────────────────────────────────────────────
const SHIFT_STYLES: Record<string, { bg: string; color: string; border: string; icon: string; label: string }> = {
  morning: { bg: "var(--amber-bg, rgba(217,119,6,0.12))", color: "var(--amber)", border: "rgba(217,119,6,0.3)", icon: "🌅", label: "Morning" },
  evening: { bg: "var(--blue-bg, rgba(37,99,235,0.12))", color: "var(--accent)", border: "rgba(37,99,235,0.3)", icon: "🌙", label: "Evening" },
  off:     { bg: "var(--surface-2)", color: "var(--text-muted)", border: "var(--border)", icon: "💤", label: "Off" },
};

const TODAY = new Date().toISOString().slice(0, 10);

function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function fmtDay(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}
function calDays(start: Date, n = 14): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ShiftChip({ code }: { code: string }) {
  const s = SHIFT_STYLES[code] ?? SHIFT_STYLES.off;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

function Modal({
  title, sub, onClose, children,
}: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--surface)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-start justify-between gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>{title}</h3>
            {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 18 18" stroke="currentColor">
              <path d="M4 4l10 10M14 4L4 14" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

const labelCls = "block text-xs font-semibold uppercase tracking-wider mb-1.5" as const;
const selectCls = "tms-select" as const;
const inputCls  = "tms-input"  as const;

// ── Main Component ────────────────────────────────────────────────────────────
export default function ShiftRotationManager() {
  type Tab = "calendar" | "morning" | "evening" | "teams";
  const [tab, setTab] = useState<Tab>("calendar");
  const [teams, setTeams]         = useState<Team[]>([]);
  const [drivers, setDrivers]     = useState<Driver[]>([]);
  const [todayShifts, setTodayShifts] = useState<ShiftRow[]>([]);
  const [routes, setRoutes]       = useState<EveningRoute[]>([]);
  const [teamSchedule, setTeamSchedule] = useState<TeamSchedule[]>([]);
  // calendar: driver_id → shift_date → shift_code
  const [calGrid, setCalGrid]     = useState<Record<string, Record<string, string>>>({});
  const [calStart, setCalStart]   = useState(new Date());
  const [loading, setLoading]     = useState(true);

  // Modal states
  const [moveModal, setMoveModal]     = useState<TodayDriver | null>(null);
  const [calloutModal, setCalloutModal] = useState<TodayDriver | null>(null);
  const [routeModal, setRouteModal]   = useState<TodayDriver | null>(null);

  // Form fields
  const [moveTeamId, setMoveTeamId] = useState("");
  const [moveRole, setMoveRole]     = useState("member");
  const [calloutDate, setCalloutDate] = useState(TODAY);
  const [calloutReason, setCalloutReason] = useState("");
  const [newRouteId, setNewRouteId] = useState("");
  const [swapWith, setSwapWith]     = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const [ok, setOk]         = useState("");

  const flash = (msg: string) => { setOk(msg); setTimeout(() => setOk(""), 3000); };
  const resetErr = () => setErr("");

  // ── Data Loading ─────────────────────────────────────────────────────────
  const loadCalendar = useCallback(async (start: Date) => {
    const startStr = fmt(start);
    const endDate  = new Date(start);
    endDate.setDate(endDate.getDate() + 13);
    const endStr = fmt(endDate);

    const { data } = await supabase
      .from("shift_schedules")
      .select("driver_id,shift_date,shift_code,is_override,plan_name")
      .gte("shift_date", startStr)
      .lte("shift_date", endStr)
      .order("shift_date");

    const grid: Record<string, Record<string, string>> = {};
    ((data ?? []) as ShiftRow[]).forEach(row => {
      if (!grid[row.driver_id]) grid[row.driver_id] = {};
      grid[row.driver_id][row.shift_date] = row.shift_code;
    });
    setCalGrid(grid);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: t },
        { data: d },
        { data: ts },
        { data: r },
        { data: teamSched },
      ] = await Promise.all([
        supabase.from("driver_teams").select("*").order("name"),
        supabase.from("drivers")
          .select("id,full_name,license_number,phone,team_id,team_role,driver_type,evening_route_id,employment_status")
          .eq("employment_status", "active")
          .order("full_name"),
        supabase.from("shift_schedules")
          .select("driver_id,shift_date,shift_code,is_override,plan_name")
          .eq("shift_date", TODAY),
        supabase.from("evening_routes").select("*").order("route_type,name"),
        supabase.from("team_shift_schedule")
          .select("team_id,shift_date,shift_type,cycle_day")
          .gte("shift_date", TODAY)
          .lte("shift_date", (() => { const e = new Date(); e.setDate(e.getDate() + 13); return e.toISOString().slice(0,10); })())
          .order("shift_date"),
      ]);

      setTeams((t ?? []) as Team[]);
      setDrivers((d ?? []) as Driver[]);
      setTodayShifts((ts ?? []) as ShiftRow[]);
      setRoutes((r ?? []) as EveningRoute[]);
      setTeamSchedule((teamSched ?? []) as TeamSchedule[]);
      await loadCalendar(calStart);
    } finally {
      setLoading(false);
    }
  }, [calStart, loadCalendar]);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!loading) loadCalendar(calStart);
  }, [calStart]);

  // ── Derived today-driver list ─────────────────────────────────────────────
  const teamMap  = Object.fromEntries(teams.map(t => [t.id, t.name]));
  const routeMap = Object.fromEntries(routes.map(r => [r.id, r.name]));
  const shiftMap = Object.fromEntries(todayShifts.map(s => [s.driver_id, s.shift_code]));

  const todayDrivers: TodayDriver[] = drivers.map(d => ({
    ...d,
    today_shift: shiftMap[d.id] ?? null,
    team_name:         d.team_id ? (teamMap[d.team_id] ?? null) : null,
    evening_route_name: d.evening_route_id ? (routeMap[d.evening_route_id] ?? null) : null,
  }));

  const morningDrivers = todayDrivers.filter(d => d.today_shift === "morning");
  const eveningDrivers = todayDrivers.filter(d => d.today_shift === "evening");
  const offDrivers     = todayDrivers.filter(d => d.today_shift === "off" || d.today_shift === null);

  // ── Actions ───────────────────────────────────────────────────────────────
  const moveDriver = async () => {
    if (!moveModal || !moveTeamId) return;
    setSaving(true); resetErr();
    const { error } = await supabase.rpc("move_driver_to_team", {
      p_driver_id: moveModal.id,
      p_new_team_id: moveTeamId,
      p_team_role: moveRole,
    });
    if (error) setErr(error.message);
    else { setMoveModal(null); flash(`${moveModal.full_name ?? "Driver"} moved.`); await loadAll(); }
    setSaving(false);
  };

  const callout = async () => {
    if (!calloutModal || !calloutReason.trim()) { setErr("Reason is required."); return; }
    setSaving(true); resetErr();
    const { error } = await supabase.rpc("callout_driver", {
      p_driver_id: calloutModal.id,
      p_date: calloutDate,
      p_reason: calloutReason,
    });
    if (error) setErr(error.message);
    else {
      setCalloutModal(null); setCalloutReason("");
      flash(`${calloutModal.full_name ?? "Driver"} called out.`);
      await loadAll();
    }
    setSaving(false);
  };

  const assignRoute = async () => {
    if (!routeModal || !newRouteId) return;
    setSaving(true); resetErr();
    const { error } = await supabase.rpc("assign_evening_route", {
      p_driver_id: routeModal.id,
      p_route_id: newRouteId,
    });
    if (error) setErr(error.message);
    else { setRouteModal(null); setNewRouteId(""); flash("Route assigned."); await loadAll(); }
    setSaving(false);
  };

  const swapRoutes = async () => {
    if (!routeModal || !swapWith) return;
    setSaving(true); resetErr();
    const { error } = await supabase.rpc("swap_evening_routes", {
      p_driver_a: routeModal.id,
      p_driver_b: swapWith,
    });
    if (error) setErr(error.message);
    else { setRouteModal(null); setSwapWith(""); flash("Routes swapped."); await loadAll(); }
    setSaving(false);
  };

  // ── Calendar grid ─────────────────────────────────────────────────────────
  const days = calDays(calStart);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Shift Rotation Manager</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Today: {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Toast */}
      {ok && (
        <div className="alert alert-success fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 z-50 shadow-xl">
          ✓ {ok}
        </div>
      )}

      {/* Today summary cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Morning", count: morningDrivers.length, icon: "🌅", color: "var(--amber)" },
            { label: "Evening", count: eveningDrivers.length, icon: "🌙", color: "var(--accent)" },
            { label: "Off/Unscheduled", count: offDrivers.length,     icon: "💤", color: "var(--text-muted)" },
          ].map(s => (
            <div key={s.label} className="card text-center py-3 px-2">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap" style={{ background: "var(--surface-2)", padding: 4, borderRadius: 14, width: "fit-content" }}>
        {([
          { key: "calendar", label: "📅 Calendar" },
          { key: "morning",  label: "🌅 Morning" },
          { key: "evening",  label: "🌙 Evening" },
          { key: "teams",    label: "👥 Teams" },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === t.key
              ? { background: "var(--text)", color: "var(--bg)" }
              : { color: "var(--text-muted)" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--text)" }} />
        </div>
      ) : (
        <>
          {/* ── Calendar Tab ── */}
          {tab === "calendar" && (
            <div className="space-y-3">
              {/* Week nav */}
              <div className="flex items-center gap-3">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { const d = new Date(calStart); d.setDate(d.getDate() - 7); setCalStart(d); }}
                >
                  ← Prev
                </button>
                <span className="text-sm font-medium flex-1 text-center" style={{ color: "var(--text)" }}>
                  {fmtDay(days[0])} — {fmtDay(days[days.length - 1])}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { const d = new Date(calStart); d.setDate(d.getDate() + 7); setCalStart(d); }}
                >
                  Next →
                </button>
              </div>

              {/* Desktop calendar grid */}
              <div className="card overflow-hidden hidden sm:block">
                <div className="overflow-x-auto">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, minWidth: 180 }}>
                          Driver
                        </th>
                        {days.map(d => (
                          <th key={fmt(d)} style={{
                            padding: "6px 4px", textAlign: "center", color: fmt(d) === TODAY ? "var(--accent)" : "var(--text-muted)",
                            fontWeight: fmt(d) === TODAY ? 700 : 500, minWidth: 52,
                          }}>
                            <div>{d.toLocaleDateString("en-GB", { weekday: "narrow" })}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: fmt(d) === TODAY ? "var(--accent)" : "var(--text)" }}>
                              {d.getDate()}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map(driver => (
                        <tr key={driver.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 16px", color: "var(--text)", fontWeight: 500 }}>
                            <div className="truncate" style={{ maxWidth: 170 }}>
                              {driver.full_name ?? driver.license_number}
                            </div>
                            {driver.team_id && (
                              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{teamMap[driver.team_id] ?? ""}</div>
                            )}
                          </td>
                          {days.map(d => {
                            const ds = fmt(d);
                            const code = calGrid[driver.id]?.[ds] ?? null;
                            const s = code ? SHIFT_STYLES[code] : null;
                            return (
                              <td key={ds} style={{ padding: "4px 2px", textAlign: "center" }}>
                                {s ? (
                                  <span style={{
                                    display: "inline-block", padding: "2px 6px", borderRadius: 8,
                                    fontSize: 10, fontWeight: 700, background: s.bg, color: s.color,
                                  }}>
                                    {s.icon}
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--border)", fontSize: 11 }}>—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {drivers.length === 0 && (
                        <tr>
                          <td colSpan={days.length + 1} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                            No active drivers found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile calendar cards */}
              <div className="sm:hidden space-y-2">
                {drivers.map(driver => (
                  <div key={driver.id} className="card overflow-hidden">
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                        {driver.full_name ?? driver.license_number}
                      </p>
                      {driver.team_id && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{teamMap[driver.team_id]}</p>
                      )}
                    </div>
                    <div className="px-4 py-3 flex gap-1.5 overflow-x-auto">
                      {days.map(d => {
                        const ds = fmt(d);
                        const code = calGrid[driver.id]?.[ds] ?? null;
                        const s = code ? SHIFT_STYLES[code] : null;
                        const isToday = ds === TODAY;
                        return (
                          <div key={ds} className="flex flex-col items-center gap-1 shrink-0">
                            <span style={{ fontSize: 9, color: isToday ? "var(--accent)" : "var(--text-muted)", fontWeight: isToday ? 700 : 400 }}>
                              {d.toLocaleDateString("en-GB", { weekday: "narrow" })}
                            </span>
                            <span style={{
                              width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center",
                              justifyContent: "center", fontSize: 13,
                              background: s?.bg ?? "var(--surface-2)",
                              outline: isToday ? "2px solid var(--accent)" : "none",
                              outlineOffset: 2,
                            }}>
                              {s?.icon ?? "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Morning Tab ── */}
          {tab === "morning" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Morning shift today — {morningDrivers.length} driver{morningDrivers.length !== 1 ? "s" : ""}
              </p>
              {morningDrivers.length === 0 ? (
                <div className="card">
                  <div className="empty-state"><div className="empty-state-icon">🌅</div><div>No morning drivers scheduled today</div></div>
                </div>
              ) : morningDrivers.map(d => (
                <DriverCard
                  key={d.id} driver={d}
                  onCallout={() => { setCalloutModal(d); setCalloutDate(TODAY); setCalloutReason(""); resetErr(); }}
                  onMove={() => { setMoveModal(d); setMoveTeamId(""); setMoveRole("member"); resetErr(); }}
                />
              ))}
            </div>
          )}

          {/* ── Evening Tab ── */}
          {tab === "evening" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Evening shift today — {eveningDrivers.length} driver{eveningDrivers.length !== 1 ? "s" : ""}
              </p>
              {eveningDrivers.length === 0 ? (
                <div className="card">
                  <div className="empty-state"><div className="empty-state-icon">🌙</div><div>No evening drivers scheduled today</div></div>
                </div>
              ) : eveningDrivers.map(d => (
                <DriverCard
                  key={d.id} driver={d}
                  showRoute
                  routes={routes}
                  onCallout={() => { setCalloutModal(d); setCalloutDate(TODAY); setCalloutReason(""); resetErr(); }}
                  onMove={() => { setMoveModal(d); setMoveTeamId(""); setMoveRole("member"); resetErr(); }}
                  onRoute={() => { setRouteModal(d); setNewRouteId(""); setSwapWith(""); resetErr(); }}
                />
              ))}
            </div>
          )}

          {/* ── Teams Tab ── */}
          {tab === "teams" && (
            <div className="space-y-3">
              {teams.length === 0 ? (
                <div className="card">
                  <div className="empty-state"><div className="empty-state-icon">👥</div><div>No teams configured</div></div>
                </div>
              ) : teams.map(team => {
                const teamDrivers = todayDrivers.filter(d => d.team_id === team.id);
                return (
                  <div key={team.id} className="card overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>{team.name}</h3>
                        {team.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{team.description}</p>}
                      </div>
                      <span className="text-xs font-mono px-2 py-1 rounded-lg"
                        style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                        {teamDrivers.length} drivers
                      </span>
                    </div>
                    {teamDrivers.length === 0 ? (
                      <div className="px-5 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>No drivers in this team today</div>
                    ) : (
                      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                        {teamDrivers.map(d => (
                          <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                                {d.full_name ?? d.license_number}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {d.team_role ?? "member"}{d.phone ? ` · ${d.phone}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {d.today_shift && <ShiftChip code={d.today_shift} />}
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => { setMoveModal(d); setMoveTeamId(""); setMoveRole("member"); resetErr(); }}
                              >
                                Move
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Move Driver Modal ── */}
      {moveModal && (
        <Modal
          title="Move Driver to Team"
          sub={moveModal.full_name ?? moveModal.license_number}
          onClose={() => setMoveModal(null)}
        >
          {err && <div className="alert alert-error"><span>{err}</span></div>}

          <div>
            <label className={labelCls} style={{ color: "var(--text-muted)" }}>Current Team</label>
            <div className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text)" }}>
              {moveModal.team_name ?? "Unassigned"}
            </div>
          </div>

          <div>
            <label className={labelCls} style={{ color: "var(--text-muted)" }}>New Team *</label>
            <select
              className={selectCls}
              value={moveTeamId}
              onChange={e => setMoveTeamId(e.target.value)}
            >
              <option value="">Select team…</option>
              {teams
                .filter(t => t.id !== moveModal.team_id)
                .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls} style={{ color: "var(--text-muted)" }}>Role in New Team</label>
            <select className={selectCls} value={moveRole} onChange={e => setMoveRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="assistant">Assistant</option>
              <option value="leader">Team Leader</option>
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button className="btn btn-ghost flex-1" onClick={() => setMoveModal(null)}>Cancel</button>
            <button
              className="btn btn-primary flex-1"
              disabled={!moveTeamId || saving}
              onClick={moveDriver}
            >
              {saving ? "Moving…" : "Move Driver"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Callout Modal ── */}
      {calloutModal && (
        <Modal
          title="Call Out Driver"
          sub={calloutModal.full_name ?? calloutModal.license_number}
          onClose={() => setCalloutModal(null)}
        >
          {err && <div className="alert alert-error"><span>{err}</span></div>}

          <div>
            <label className={labelCls} style={{ color: "var(--text-muted)" }}>Date *</label>
            <input
              type="date"
              className={inputCls}
              value={calloutDate}
              onChange={e => setCalloutDate(e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls} style={{ color: "var(--text-muted)" }}>Reason *</label>
            <textarea
              className="tms-textarea"
              rows={3}
              placeholder="e.g. Sick leave, emergency, personal…"
              value={calloutReason}
              onChange={e => setCalloutReason(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button className="btn btn-ghost flex-1" onClick={() => setCalloutModal(null)}>Cancel</button>
            <button
              className="btn btn-danger flex-1"
              disabled={!calloutReason.trim() || saving}
              onClick={callout}
            >
              {saving ? "Saving…" : "Confirm Callout"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Route Modal ── */}
      {routeModal && (
        <Modal
          title="Assign Evening Route"
          sub={routeModal.full_name ?? routeModal.license_number}
          onClose={() => setRouteModal(null)}
        >
          {err && <div className="alert alert-error"><span>{err}</span></div>}

          <div>
            <label className={labelCls} style={{ color: "var(--text-muted)" }}>Current Route</label>
            <div className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text)" }}>
              {routeModal.evening_route_name ?? "None assigned"}
            </div>
          </div>

          <div>
            <label className={labelCls} style={{ color: "var(--text-muted)" }}>Assign New Route</label>
            <select className={selectCls} value={newRouteId} onChange={e => setNewRouteId(e.target.value)}>
              <option value="">Select route…</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.route_type})</option>
              ))}
            </select>
          </div>

          {/* Swap section */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <label className={labelCls} style={{ color: "var(--text-muted)" }}>Or Swap Route With Driver</label>
            <select className={selectCls} value={swapWith} onChange={e => setSwapWith(e.target.value)}>
              <option value="">Select driver to swap with…</option>
              {eveningDrivers
                .filter(d => d.id !== routeModal.id && d.evening_route_id)
                .map(d => <option key={d.id} value={d.id}>{d.full_name ?? d.license_number} ({d.evening_route_name})</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button className="btn btn-ghost flex-1" onClick={() => setRouteModal(null)}>Cancel</button>
            <button
              className="btn btn-amber flex-1"
              disabled={(!newRouteId && !swapWith) || saving}
              onClick={swapWith ? swapRoutes : assignRoute}
            >
              {saving ? "Saving…" : swapWith ? "Swap Routes" : "Assign Route"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Driver Card sub-component ─────────────────────────────────────────────────
function DriverCard({
  driver,
  showRoute = false,
  routes = [],
  onCallout,
  onMove,
  onRoute,
}: {
  driver: TodayDriver;
  showRoute?: boolean;
  routes?: EveningRoute[];
  onCallout: () => void;
  onMove: () => void;
  onRoute?: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
            {driver.full_name ?? driver.license_number}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {driver.team_name && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                👥 {driver.team_name} · {driver.team_role ?? "member"}
              </span>
            )}
            {driver.phone && (
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>📞 {driver.phone}</span>
            )}
          </div>
          {showRoute && driver.evening_route_name && (
            <p className="text-xs mt-1" style={{ color: "var(--accent)" }}>🗺 {driver.evening_route_name}</p>
          )}
        </div>
        {driver.today_shift && <ShiftChip code={driver.today_shift} />}
      </div>
      <div className="px-4 py-2.5 flex gap-2" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <button className="btn btn-ghost btn-sm" onClick={onMove}>Move Team</button>
        <button className="btn btn-amber btn-sm" onClick={onCallout}>Call Out</button>
        {showRoute && onRoute && (
          <button className="btn btn-ghost btn-sm" onClick={onRoute}>Route</button>
        )}
      </div>
    </div>
  );
}