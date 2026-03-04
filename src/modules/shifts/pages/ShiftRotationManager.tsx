// src/modules/shifts/pages/ShiftRotationManager.tsx
import { useEffect, useState } from "react";
import type React from "react";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────
type Team = { id: string; name: string; cycle_phase_offset: number };
type TodayDriver = {
  driver_id: string; driver_name: string | null; phone: string | null;
  team_id: string | null; team_name: string | null; team_role: string | null;
  shift_type: string | null; effective_shift: string | null;
  deployment_unit: string | null; evening_route: string | null;
  route_type: string | null; driver_type: string | null;
  override_type: string | null;
};
type Unit  = { id: string; name: string; max_drivers: number | null; priority: number };
type Route = { id: string; name: string; route_type: string };
type MorningDep = {
  driver_id: string; driver_name: string; deployment_unit_id: string;
  unit_name: string; cycle_start_date: string; is_override: boolean;
};
type ScheduleRow = {
  shift_date: string; shift_type: string; team_id: string; team_name: string;
};

const SHIFT_COLOR: Record<string, { bg: string; color: string; icon: string }> = {
  morning: { bg: "var(--amber-bg)",  color: "var(--amber)",      icon: "🌅" },
  evening: { bg: "var(--blue-bg)",   color: "var(--blue)",       icon: "🌙" },
  off:     { bg: "var(--surface-3)", color: "var(--text-muted)", icon: "💤" },
};

const UNIT_BADGE: Record<string, string> = {
  "Joy News":     "badge-dispatched",
  "Adom News":    "badge-amber",
  "Joy Business": "badge-recorded",
  "Production":   "badge-draft",
};

function ShiftChip({ type }: { type: string }) {
  const c = SHIFT_COLOR[type] ?? SHIFT_COLOR.off;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color,
    }}>
      {c.icon} {type}
    </span>
  );
}

function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function fmtDay(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}
function days(start: Date, n: number): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return d;
  });
}

// ─────────────────────────────────────────────────────────────
export default function ShiftRotationManager() {
  const [tab, setTab] = useState<"calendar" | "morning" | "evening" | "teams">("calendar");
  const [teams, setTeams]       = useState<Team[]>([]);
  const [drivers, setDrivers]   = useState<TodayDriver[]>([]);
  const [units, setUnits]       = useState<Unit[]>([]);
  const [routes, setRoutes]     = useState<Route[]>([]);
  const [morningDeps, setMorningDeps] = useState<MorningDep[]>([]);
  const [schedule, setSchedule] = useState<Record<string, Record<string, string>>>({});
  const [calStart, setCalStart] = useState(new Date());
  const [loading, setLoading]   = useState(true);

  // Modals
  const [moveModal, setMoveModal]     = useState<TodayDriver | null>(null);
  const [calloutModal, setCalloutModal] = useState<TodayDriver | null>(null);
  const [routeModal, setRouteModal]   = useState<TodayDriver | null>(null);
  const [deployModal, setDeployModal] = useState<MorningDep | null>(null);

  // Form fields
  const [moveTeamId, setMoveTeamId]   = useState("");
  const [moveRole, setMoveRole]       = useState("member");
  const [calloutDate, setCalloutDate] = useState(fmt(new Date()));
  const [calloutReason, setCalloutReason] = useState("");
  const [newRouteId, setNewRouteId]   = useState("");
  const [swapWith, setSwapWith]       = useState("");
  const [newUnitId, setNewUnitId]     = useState("");

  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const [ok, setOk]           = useState("");

  const flash = (msg: string) => { setOk(msg); setTimeout(() => setOk(""), 3000); };
  const resetErr = () => setErr("");

  // ── Loaders ──────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    const [{ data: t }, { data: d }, { data: u }, { data: r }] = await Promise.all([
      supabase.from("driver_teams").select("*").order("name"),
      supabase.from("v_today_deployment").select("*").order("team_name, driver_name"),
      supabase.from("deployment_units").select("*").order("priority"),
      supabase.from("evening_routes").select("*").order("route_type, name"),
    ]);
    setTeams((t as Team[]) ?? []);
    setDrivers((d as TodayDriver[]) ?? []);
    setUnits((u as Unit[]) ?? []);
    setRoutes((r as Route[]) ?? []);
    setLoading(false);
  };

  const loadCal = async () => {
    const s = fmt(calStart);
    const e = fmt(new Date(calStart.getTime() + 13 * 86400000));
    const { data } = await supabase
      .from("team_shift_schedule")
      .select("team_id, shift_date, shift_type")
      .gte("shift_date", s).lte("shift_date", e);
    const map: Record<string, Record<string, string>> = {};
    ((data as ScheduleRow[]) ?? []).forEach(r => {
      if (!map[r.shift_date]) map[r.shift_date] = {};
      map[r.shift_date][r.team_id] = r.shift_type;
    });
    setSchedule(map);
  };

  const loadDeps = async () => {
    const { data } = await supabase
      .from("morning_deployments")
      .select("driver_id, cycle_start_date, is_override, deployment_units(id,name), drivers(full_name)")
      .order("cycle_start_date", { ascending: false })
      .limit(200);
    setMorningDeps(
      ((data as any[]) ?? []).map(r => ({
        driver_id:          r.driver_id,
        driver_name:        r.drivers?.full_name ?? "Unknown",
        deployment_unit_id: r.deployment_units?.id ?? "",
        unit_name:          r.deployment_units?.name ?? "—",
        cycle_start_date:   r.cycle_start_date,
        is_override:        r.is_override,
      }))
    );
  };

  useEffect(() => { loadAll(); loadCal(); loadDeps(); }, []);
  useEffect(() => { loadCal(); }, [calStart]);

  // ── Actions ───────────────────────────────────────────────
  const genDeployments = async (teamId: string) => {
    const today = fmt(new Date());
    const { data } = await supabase.from("team_shift_schedule")
      .select("shift_date").eq("team_id", teamId).eq("shift_type", "morning")
      .eq("cycle_day", 0).lte("shift_date", today)
      .order("shift_date", { ascending: false }).limit(1).single();
    if (!data) { setErr("No morning cycle found for this team yet."); return; }
    const { error } = await supabase.rpc("generate_morning_deployments", {
      p_team_id: teamId, p_cycle_start: (data as any).shift_date,
    });
    if (error) { setErr(error.message); return; }
    flash("Deployments generated."); await loadDeps(); await loadAll();
  };

  const moveDriver = async () => {
    if (!moveModal || !moveTeamId) return;
    setSaving(true); resetErr();
    const { error } = await supabase.rpc("move_driver_to_team", {
      p_driver_id: moveModal.driver_id, p_new_team_id: moveTeamId, p_team_role: moveRole,
    });
    if (error) setErr(error.message);
    else { setMoveModal(null); flash(`${moveModal.driver_name} moved.`); await loadAll(); }
    setSaving(false);
  };

  const callout = async () => {
    if (!calloutModal || !calloutReason.trim()) { setErr("Reason is required."); return; }
    setSaving(true); resetErr();
    const { error } = await supabase.rpc("callout_driver", {
      p_driver_id: calloutModal.driver_id, p_date: calloutDate, p_reason: calloutReason,
    });
    if (error) setErr(error.message);
    else { setCalloutModal(null); setCalloutReason(""); flash(`${calloutModal.driver_name} called out.`); await loadAll(); }
    setSaving(false);
  };

  const assignRoute = async () => {
    if (!routeModal || !newRouteId) return;
    setSaving(true); resetErr();
    const { error } = await supabase.rpc("assign_evening_route", {
      p_driver_id: routeModal.driver_id, p_route_id: newRouteId,
    });
    if (error) setErr(error.message);
    else { setRouteModal(null); setNewRouteId(""); flash("Route assigned."); await loadAll(); }
    setSaving(false);
  };

  const swapRoutes = async () => {
    if (!routeModal || !swapWith) return;
    setSaving(true); resetErr();
    const { error } = await supabase.rpc("swap_evening_routes", {
      p_driver_a: routeModal.driver_id, p_driver_b: swapWith,
    });
    if (error) setErr(error.message);
    else { setRouteModal(null); setSwapWith(""); flash("Routes swapped."); await loadAll(); }
    setSaving(false);
  };

  const overrideDeploy = async () => {
    if (!deployModal || !newUnitId) return;
    setSaving(true); resetErr();
    const { error } = await supabase.rpc("override_morning_deployment", {
      p_driver_id: deployModal.driver_id,
      p_cycle_start_date: deployModal.cycle_start_date,
      p_new_unit_id: newUnitId,
    });
    if (error) setErr(error.message);
    else { setDeployModal(null); setNewUnitId(""); flash("Deployment updated."); await loadDeps(); await loadAll(); }
    setSaving(false);
  };

  // ── Derived ───────────────────────────────────────────────
  const byShift = (shift: string) =>
    drivers.filter(d => (d.effective_shift ?? d.shift_type) === shift);
  const morningDrivers = byShift("morning");
  const eveningDrivers = byShift("evening");
  const offDrivers     = byShift("off");
  const calDays        = days(calStart, 14);

  const inputCls = "tms-input";
  const selectCls = "tms-select";

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift Rotation</h1>
          <p className="page-sub">
            12-day cycle per team &nbsp;·&nbsp;
            Morning (4d, 6am–6pm) → Off (2d) → Evening (4d, 6pm–6am) → Off (2d)
          </p>
        </div>
      </div>

      {ok  && <div className="alert alert-success"><span className="alert-icon">✓</span><span className="alert-content">{ok}</span><button className="alert-close" onClick={() => setOk("")}>✕</button></div>}
      {err && <div className="alert alert-error"><span className="alert-icon">✕</span><span className="alert-content">{err}</span><button className="alert-close" onClick={resetErr}>✕</button></div>}

      {/* Today summary */}
      <div className="grid-3">
        {[
          { label: "Morning (6am–6pm)", count: morningDrivers.length, type: "morning" },
          { label: "Evening (6pm–6am)", count: eveningDrivers.length, type: "evening" },
          { label: "Off Duty",          count: offDrivers.length,    type: "off"     },
        ].map(s => {
          const c = SHIFT_COLOR[s.type];
          const team = drivers.find(d => (d.effective_shift ?? d.shift_type) === s.type)?.team_name;
          return (
            <div key={s.type} className="stat-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div className="stat-label">{s.label}</div>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
              </div>
              <div className="stat-value" style={{ color: c.color }}>{s.count}</div>
              <div className="stat-delta">{team ?? "No team"} today</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="tab-group">
        {(["calendar","morning","evening","teams"] as const).map(t => (
          <button key={t} className={`tab-item ${tab===t?"active":""}`} onClick={() => setTab(t)}>
            {{ calendar:"📅 Calendar", morning:"🌅 Morning", evening:"🌙 Evening", teams:"👥 Teams" }[t]}
          </button>
        ))}
      </div>

      {loading
        ? <div className="flex justify-center py-12"><div className="spinner" /></div>
        : <TabContent
            tab={tab} teams={teams} drivers={drivers} units={units} routes={routes}
            morningDeps={morningDeps} morningDrivers={morningDrivers}
            eveningDrivers={eveningDrivers} offDrivers={offDrivers}
            calDays={calDays} calStart={calStart} setCalStart={setCalStart}
            schedule={schedule}
            onMoveOpen={d => { setMoveModal(d); setMoveTeamId(""); setMoveRole("member"); resetErr(); }}
            onCalloutOpen={d => { setCalloutModal(d); setCalloutDate(fmt(new Date())); setCalloutReason(""); resetErr(); }}
            onRouteOpen={d => { setRouteModal(d); setNewRouteId(""); setSwapWith(""); resetErr(); }}
            onDeployOpen={d => { setDeployModal(d); setNewUnitId(d.deployment_unit_id); resetErr(); }}
            genDeployments={genDeployments}
          />
      }

      {/* Move Driver Modal */}
      {moveModal && (
        <Modal title="Move Driver to Team" sub={moveModal.driver_name ?? ""} onClose={() => setMoveModal(null)}>
          {err && <div className="alert alert-error mb-3"><span>{err}</span></div>}
          <label className="form-label">Current Team</label>
          <div style={{ padding:"10px 14px", background:"var(--surface-2)", borderRadius:10, fontSize:13, marginBottom:12 }}>
            {moveModal.team_name ?? "Unassigned"}
          </div>
          <label className="form-label">New Team *</label>
          <select className={selectCls} value={moveTeamId} onChange={e => setMoveTeamId(e.target.value)} style={{ marginBottom:12 }}>
            <option value="">Select team…</option>
            {teams.filter(t => t.id !== moveModal.team_id).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <label className="form-label">Role in New Team</label>
          <select className={selectCls} value={moveRole} onChange={e => setMoveRole(e.target.value)}>
            <option value="member">Member</option>
            <option value="assistant">Assistant</option>
            <option value="leader">Team Leader</option>
          </select>
          <div className="modal-footer" style={{ marginTop:16 }}>
            <button className="btn btn-ghost" onClick={() => setMoveModal(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={!moveTeamId || saving} onClick={moveDriver}>
              {saving ? "Moving…" : "Move Driver"}
            </button>
          </div>
        </Modal>
      )}

      {/* Callout Modal */}
      {calloutModal && (
        <Modal title="Emergency Callout" sub={`${calloutModal.driver_name} is off duty`} onClose={() => setCalloutModal(null)}>
          {err && <div className="alert alert-error mb-3"><span>{err}</span></div>}
          <div className="alert alert-warning" style={{ marginBottom:12 }}>
            <span className="alert-icon">⚠</span>
            <span className="alert-content">This overrides the driver's off-duty status.</span>
          </div>
          <label className="form-label">Date *</label>
          <input type="date" className={inputCls} value={calloutDate}
            onChange={e => setCalloutDate(e.target.value)} style={{ marginBottom:12 }} />
          <label className="form-label">Reason *</label>
          <textarea className="tms-textarea" value={calloutReason}
            onChange={e => setCalloutReason(e.target.value)}
            placeholder="e.g. Short-staffed due to sickness" />
          <div className="modal-footer" style={{ marginTop:16 }}>
            <button className="btn btn-ghost" onClick={() => setCalloutModal(null)}>Cancel</button>
            <button className="btn btn-amber" disabled={saving} onClick={callout}>
              {saving ? "Saving…" : "Confirm Callout"}
            </button>
          </div>
        </Modal>
      )}

      {/* Route Modal */}
      {routeModal && (
        <Modal title="Evening Route" sub={`${routeModal.driver_name} · ${routeModal.evening_route ?? "No route"}`} onClose={() => setRouteModal(null)}>
          {err && <div className="alert alert-error mb-3"><span>{err}</span></div>}
          <label className="form-label">Assign New Route</label>
          <select className={selectCls} value={newRouteId} onChange={e => setNewRouteId(e.target.value)}>
            <option value="">Select route…</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.route_type})</option>)}
          </select>
          <button className="btn btn-primary btn-sm" style={{ marginTop:8 }}
            disabled={!newRouteId || saving} onClick={assignRoute}>
            {saving ? "Saving…" : "Assign Route"}
          </button>
          <div className="divider" style={{ margin:"16px 0" }} />
          <label className="form-label">Or Swap with Another Driver</label>
          <select className={selectCls} value={swapWith} onChange={e => setSwapWith(e.target.value)}>
            <option value="">Select driver…</option>
            {drivers.filter(d => d.driver_id !== routeModal.driver_id && d.evening_route).map(d => (
              <option key={d.driver_id} value={d.driver_id}>{d.driver_name} → {d.evening_route}</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" style={{ marginTop:8 }}
            disabled={!swapWith || saving} onClick={swapRoutes}>
            {saving ? "Swapping…" : "Swap Routes"}
          </button>
          <div className="modal-footer" style={{ marginTop:16 }}>
            <button className="btn btn-ghost" onClick={() => setRouteModal(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* Deploy Override Modal */}
      {deployModal && (
        <Modal title="Change Deployment Unit"
          sub={`${deployModal.driver_name} · ${deployModal.unit_name}`}
          onClose={() => setDeployModal(null)}>
          {err && <div className="alert alert-error mb-3"><span>{err}</span></div>}
          <label className="form-label">Move to Unit</label>
          <select className={selectCls} value={newUnitId} onChange={e => setNewUnitId(e.target.value)}>
            <option value="">Select unit…</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <div className="modal-footer" style={{ marginTop:16 }}>
            <button className="btn btn-ghost" onClick={() => setDeployModal(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={!newUnitId || saving} onClick={overrideDeploy}>
              {saving ? "Saving…" : "Update"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────
function Modal({ title, sub, onClose, children }: {
  title: string; sub: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            <div className="modal-sub">{sub}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── Tab content props ─────────────────────────────────────────
interface TabContentProps {
  tab: "calendar" | "morning" | "evening" | "teams";
  teams: Team[];
  drivers: TodayDriver[];
  units: Unit[];
  routes: Route[];
  morningDeps: MorningDep[];
  morningDrivers: TodayDriver[];
  eveningDrivers: TodayDriver[];
  offDrivers: TodayDriver[];
  calDays: Date[];
  calStart: Date;
  setCalStart: React.Dispatch<React.SetStateAction<Date>>;
  schedule: Record<string, Record<string, string>>;
  onMoveOpen: (d: TodayDriver) => void;
  onCalloutOpen: (d: TodayDriver) => void;
  onRouteOpen: (d: TodayDriver) => void;
  onDeployOpen: (d: MorningDep) => void;
  genDeployments: (teamId: string) => Promise<void>;
}

// ── Tab content split out to keep component readable ──────────
function TabContent({
  tab, teams, drivers, units, routes, morningDeps,
  morningDrivers, eveningDrivers, offDrivers,
  calDays, calStart, setCalStart, schedule,
  onMoveOpen, onCalloutOpen, onRouteOpen, onDeployOpen, genDeployments,
}: TabContentProps) {

  const today = fmt(new Date());

  if (tab === "calendar") return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">14-Day Team Schedule</span>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost btn-sm"
            onClick={() => setCalStart((d: Date) => { const n=new Date(d); n.setDate(n.getDate()-14); return n; })}>← Prev</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCalStart(new Date())}>Today</button>
          <button className="btn btn-ghost btn-sm"
            onClick={() => setCalStart((d: Date) => { const n=new Date(d); n.setDate(n.getDate()+14); return n; })}>Next →</button>
        </div>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table className="tms-table">
          <thead>
            <tr>
              <th style={{ minWidth:80 }}>Team</th>
              {calDays.map((d: Date) => (
                <th key={fmt(d)} style={{
                  minWidth:76, textAlign:"center",
                  background: fmt(d) === today ? "var(--accent)" : undefined,
                  color:      fmt(d) === today ? "var(--accent-text)" : undefined,
                }}>
                  {fmtDay(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((team: Team) => (
              <tr key={team.id}>
                <td style={{ fontWeight:700 }}>{team.name}</td>
                {calDays.map((d: Date) => {
                  const s = schedule[fmt(d)]?.[team.id];
                  const c = SHIFT_COLOR[s ?? "off"];
                  return (
                    <td key={fmt(d)} style={{ textAlign:"center", padding:"6px 4px" }}>
                      {s ? (
                        <span style={{
                          display:"inline-block", padding:"2px 8px", borderRadius:8,
                          fontSize:11, fontWeight:600, background:c.bg, color:c.color,
                        }}>
                          {c.icon} {s === "morning" ? "AM" : s === "evening" ? "PM" : "Off"}
                        </span>
                      ) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-footer" style={{ fontSize:12, color:"var(--text-muted)" }}>
        🌅 Morning = 6am–6pm &nbsp;·&nbsp; 🌙 Evening = 6pm–6am &nbsp;·&nbsp; 💤 Off = Rest days
      </div>
    </div>
  );

  if (tab === "morning") return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Generate Morning Deployments</span>
        </div>
        <div className="card-body" style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {teams.map((t: Team) => (
            <button key={t.id} className="btn btn-ghost" onClick={() => genDeployments(t.id)}>
              Generate {t.name}
            </button>
          ))}
        </div>
        <div className="card-footer" style={{ fontSize:12, color:"var(--text-muted)" }}>
          Auto-rotates so no driver repeats the same unit. Joy News: 3 drivers · Adom News: 2 · Joy Business: 1 · Rest → Production
        </div>
      </div>

      {units.map((unit: Unit) => {
        const assigned = morningDrivers.filter((d: TodayDriver) => d.deployment_unit === unit.name);
        if (assigned.length === 0) return null;
        return (
          <div key={unit.id} className="card">
            <div className="card-header">
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span className="card-title">{unit.name}</span>
                {unit.max_drivers && (
                  <span style={{ fontSize:11, color:"var(--text-muted)" }}>
                    {assigned.length}/{unit.max_drivers}
                  </span>
                )}
              </div>
              <span className={`badge ${UNIT_BADGE[unit.name] ?? "badge-draft"}`}>{unit.name}</span>
            </div>
            <div className="card-body" style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {assigned.map((d: TodayDriver) => {
                const dep = morningDeps.find((m: MorningDep) => m.driver_id === d.driver_id);
                return (
                  <div key={d.driver_id} style={{
                    display:"flex", alignItems:"center", gap:10,
                    padding:"8px 12px", borderRadius:10,
                    background:"var(--surface-2)", border:"1px solid var(--border)",
                  }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{d.driver_name}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>{d.team_name} · {d.team_role}</div>
                    </div>
                    {dep && (
                      <button className="btn btn-ghost btn-sm" onClick={() => onDeployOpen(dep)}>Move</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Undeployed → Production */}
      {morningDrivers.filter((d: TodayDriver) => !d.deployment_unit).length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Production</span></div>
          <div className="card-body" style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {morningDrivers.filter((d: TodayDriver) => !d.deployment_unit).map((d: TodayDriver) => (
              <div key={d.driver_id} style={{
                padding:"8px 12px", borderRadius:10,
                background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:13,
              }}>
                {d.driver_name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (tab === "evening") return (
    <div className="space-y-4">
      <div className="alert alert-info">
        <span className="alert-icon">ℹ</span>
        <span className="alert-content">Evening routes are fixed per driver. Only transport supervisor or corporate approver can change or swap.</span>
      </div>

      {(["tv","radio"] as const).map(type => {
        const evDrivers = eveningDrivers.filter((d: TodayDriver) =>
          type === "tv" ? (d.driver_type === "tv" || !d.driver_type) : d.driver_type === "radio"
        );
        return (
          <div key={type} className="card">
            <div className="card-header">
              <span className="card-title">{type === "tv" ? "📺 TV Routes" : "📻 Radio Routes"}</span>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table className="tms-table">
                <thead><tr><th>Driver</th><th>Team</th><th>Route</th><th></th></tr></thead>
                <tbody>
                  {evDrivers.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign:"center", color:"var(--text-dim)", padding:20 }}>
                      No {type} drivers on evening shift today
                    </td></tr>
                  ) : evDrivers.map((d: TodayDriver) => (
                    <tr key={d.driver_id}>
                      <td>
                        <div style={{ fontWeight:600 }}>{d.driver_name}</div>
                        {d.phone && <div style={{ fontSize:11, color:"var(--text-muted)" }}>{d.phone}</div>}
                      </td>
                      <td><span className="badge badge-draft">{d.team_name ?? "—"}</span></td>
                      <td>
                        {d.evening_route
                          ? <span className="badge badge-dispatched">{d.evening_route}</span>
                          : <span style={{ color:"var(--text-dim)", fontSize:12 }}>Not assigned</span>
                        }
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => onRouteOpen(d)}>
                          Change / Swap
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* All drivers for route assignment (not just today's evening team) */}
      <div className="card">
        <div className="card-header"><span className="card-title">All Driver Routes (Manage)</span></div>
        <div style={{ overflowX:"auto" }}>
          <table className="tms-table">
            <thead><tr><th>Driver</th><th>Team</th><th>Type</th><th>Fixed Route</th><th></th></tr></thead>
            <tbody>
              {drivers.map((d: TodayDriver) => (
                <tr key={d.driver_id}>
                  <td style={{ fontWeight:600 }}>{d.driver_name}</td>
                  <td>{d.team_name ?? "—"}</td>
                  <td><span className={`badge ${d.driver_type === "radio" ? "badge-recorded" : "badge-dispatched"}`}>
                    {d.driver_type ?? "tv"}
                  </span></td>
                  <td>
                    {d.evening_route
                      ? <span className="badge badge-draft">{d.evening_route}</span>
                      : <span style={{ color:"var(--text-dim)", fontSize:12 }}>None</span>
                    }
                  </td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => onRouteOpen(d)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (tab === "teams") return (
    <div className="space-y-4">
      {teams.map((team: Team) => {
        const teamDrivers = drivers.filter((d: TodayDriver) => d.team_id === team.id);
        const shift = teamDrivers[0]?.effective_shift ?? teamDrivers[0]?.shift_type ?? "off";
        return (
          <div key={team.id} className="card">
            <div className="card-header">
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span className="card-title">{team.name}</span>
                <ShiftChip type={shift} />
              </div>
              <span style={{ fontSize:13, color:"var(--text-muted)" }}>
                {teamDrivers.length} / 9 drivers
              </span>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table className="tms-table">
                <thead><tr><th>Driver</th><th>Role</th><th>Today</th><th>Actions</th></tr></thead>
                <tbody>
                  {teamDrivers.length === 0
                    ? <tr><td colSpan={4} style={{ textAlign:"center", color:"var(--text-dim)", padding:16 }}>No drivers in this team yet</td></tr>
                    : teamDrivers.map((d: TodayDriver) => (
                    <tr key={d.driver_id}>
                      <td>
                        <div style={{ fontWeight:600 }}>{d.driver_name ?? "—"}</div>
                        {d.phone && <div style={{ fontSize:11, color:"var(--text-muted)" }}>{d.phone}</div>}
                      </td>
                      <td>
                        <span className={`badge ${
                          d.team_role === "leader" ? "badge-approved" :
                          d.team_role === "assistant" ? "badge-dispatched" : "badge-draft"
                        }`}>{d.team_role ?? "member"}</span>
                      </td>
                      <td>
                        {shift === "morning" && d.deployment_unit &&
                          <span className={`badge ${UNIT_BADGE[d.deployment_unit] ?? "badge-draft"}`}>{d.deployment_unit}</span>}
                        {shift === "evening" && d.evening_route &&
                          <span className="badge badge-dispatched">{d.evening_route}</span>}
                        {(shift === "off" || (!d.deployment_unit && !d.evening_route)) &&
                          <span className="badge badge-closed">Off</span>}
                      </td>
                      <td>
                        <div style={{ display:"flex", gap:6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => onMoveOpen(d)}>Move</button>
                          {(shift === "off" || d.override_type === null) && (
                            <button className="btn btn-amber btn-sm" onClick={() => onCalloutOpen(d)}>Call Out</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Unassigned drivers */}
      {drivers.filter((d: TodayDriver) => !d.team_id).length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Unassigned Drivers</span></div>
          <div style={{ overflowX:"auto" }}>
            <table className="tms-table">
              <thead><tr><th>Driver</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {drivers.filter((d: TodayDriver) => !d.team_id).map((d: TodayDriver) => (
                  <tr key={d.driver_id}>
                    <td style={{ fontWeight:600 }}>{d.driver_name}</td>
                    <td><span className="badge badge-draft">No team</span></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => onMoveOpen(d)}>Assign Team</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return null;
}