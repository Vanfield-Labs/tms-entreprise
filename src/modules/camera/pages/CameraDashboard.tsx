// src/modules/camera/pages/CameraDashboard.tsx
// Head of Camera Department dashboard:
//   - Deploy technicians to units with date range + shift type
//   - View all active/upcoming deployments
//   - Approve/reject dawn & evening pickup requests (with driver assignment)
//   - Manage delegates
// Camera Technician (staff in Camera Dept) sees:
//   - Their current deployment unit + shift
//   - Their pickup requests + driver info
//   - Can submit new pickup requests
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  PageSpinner, EmptyState, Badge, Card, CardHeader, CardBody,
  Field, Input, Select, Textarea, Btn, Modal, Alert, TabBar,
} from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────
const CAMERA_UNIT_ID = "252e08c0-0999-4afe-9eff-a15365bd4d47";

// Deployable destinations + their shift rules
const DEPLOY_UNITS: { name: string; shift: string; sub?: string[] }[] = [
  { name: "Joy News",     shift: "straight_day" },
  { name: "Adom Tv",      shift: "straight_day" },
  { name: "Joy Business", shift: "straight_day" },
  { name: "Production",   shift: "production",   sub: ["dawn", "afternoon"] },
];

const SHIFT_LABEL: Record<string, string> = {
  straight_day: "Straight Day (8am – 5pm)",
  production:   "Production",
  dawn:         "Dawn (5am – 2pm)",
  afternoon:    "Afternoon (2pm – last programme)",
};

const STATUS_COLOR: Record<string, string> = {
  active:   "badge-approved",
  ended:    "badge-closed",
  rejected: "badge-rejected",
  pending:  "badge-submitted",
  approved: "badge-approved",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Technician = { user_id: string; full_name: string; position_title: string | null };
type Unit = { id: string; name: string };
type Driver = { id: string; full_name: string | null; license_number: string; phone: string | null };

type Deployment = {
  id: string; technician_id: string; tech_name: string;
  unit_id: string; unit_name: string;
  shift_type: string; sub_shift: string | null;
  deployment_date: string; end_date: string | null;
  status: string; notes: string | null;
};

type PickupRequest = {
  id: string; technician_id: string; tech_name: string;
  pickup_type: string; pickup_date: string;
  pickup_location: string; dropoff_location: string;
  requested_time: string; status: string; notes: string | null;
  driver_name: string | null; driver_phone: string | null; vehicle_plate: string | null;
};

type Delegate = { id: string; user_id: string; full_name: string; unit_id: string | null };

type Tab = "deployments" | "pickups" | "delegates";

// ── Helpers ───────────────────────────────────────────────────────────────────
function shiftBadge(shift: string, sub: string | null) {
  if (shift === "production" && sub) return SHIFT_LABEL[sub] ?? sub;
  return SHIFT_LABEL[shift] ?? shift;
}

// ══════════════════════════════════════════════════════════════════════════════
// HEAD / DELEGATE VIEW
// ══════════════════════════════════════════════════════════════════════════════
function HeadView() {
  const [tab, setTab]                   = useState<Tab>("deployments");
  const [deployments, setDeployments]   = useState<Deployment[]>([]);
  const [pickups, setPickups]           = useState<PickupRequest[]>([]);
  const [delegates, setDelegates]       = useState<Delegate[]>([]);
  const [technicians, setTechnicians]   = useState<Technician[]>([]);
  const [units, setUnits]               = useState<Unit[]>([]);
  const [drivers, setDrivers]           = useState<Driver[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // Deploy form
  const [showDeployForm, setShowDeployForm]   = useState(false);
  const [dTechId, setDTechId]                 = useState("");
  const [dUnitName, setDUnitName]             = useState("");
  const [dStart, setDStart]                   = useState("");
  const [dEnd, setDEnd]                       = useState("");
  const [dShift, setDShift]                   = useState("straight_day");
  const [dSub, setDSub]                       = useState("");
  const [dNotes, setDNotes]                   = useState("");
  const [deploying, setDeploying]             = useState(false);

  // Pickup action
  const [actingPickup, setActingPickup]       = useState<string | null>(null);
  const [pickupDriverId, setPickupDriverId]   = useState<Record<string, string>>({});
  const [pickupNote, setPickupNote]           = useState<Record<string, string>>({});

  // Delegate form
  const [showDelegForm, setShowDelegForm]     = useState(false);
  const [delegUserId, setDelegUserId]         = useState("");
  const [delegUnitId, setDelegUnitId]         = useState("");
  const [addingDeleg, setAddingDeleg]         = useState(false);

  const CAMERA_UNIT = "Camera Department";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load camera technicians (staff in camera dept)
      const { data: techs } = await supabase.from("profiles")
        .select("user_id,full_name,position_title")
        .eq("unit_id", CAMERA_UNIT_ID)
        .eq("status", "active")
        .order("full_name");
      setTechnicians((techs as Technician[]) || []);

      // Load deployment units (by name)
      const unitNames = DEPLOY_UNITS.map(u => u.name);
      const { data: unitData } = await supabase.from("units").select("id,name").in("name", unitNames);
      setUnits((unitData as Unit[]) || []);

      // Load active deployments
      const { data: deps } = await supabase.from("camera_deployments")
        .select("id,technician_id,unit_id,shift_type,sub_shift,deployment_date,end_date,status,notes")
        .in("status", ["active", "ended"])
        .order("deployment_date", { ascending: false })
        .limit(200);

      const techIds  = [...new Set(((deps as any[]) || []).map((d: any) => d.technician_id))];
      const unitIds  = [...new Set(((deps as any[]) || []).map((d: any) => d.unit_id))];

      const [{ data: pData }, { data: uData }] = await Promise.all([
        techIds.length ? supabase.from("profiles").select("user_id,full_name").in("user_id", techIds) : Promise.resolve({ data: [] }),
        unitIds.length ? supabase.from("units").select("id,name").in("id", unitIds) : Promise.resolve({ data: [] }),
      ]);
      const pMap = Object.fromEntries(((pData as any[]) || []).map(p => [p.user_id, p.full_name]));
      const uMap = Object.fromEntries(((uData as any[]) || []).map(u => [u.id, u.name]));

      setDeployments(((deps as any[]) || []).map(d => ({
        ...d, tech_name: pMap[d.technician_id] ?? "Unknown", unit_name: uMap[d.unit_id] ?? "Unknown",
      })));

      // Load pending pickup requests
      const { data: pkps } = await supabase.from("camera_pickups")
        .select("id,technician_id,pickup_type,pickup_date,pickup_location,dropoff_location,requested_time,status,notes,driver_name,driver_phone,vehicle_plate")
        .in("status", ["pending", "approved", "rejected"])
        .order("pickup_date", { ascending: false })
        .limit(100);
      const pkpTechIds = [...new Set(((pkps as any[]) || []).map((p: any) => p.technician_id))];
      const { data: pkpProfiles } = pkpTechIds.length
        ? await supabase.from("profiles").select("user_id,full_name").in("user_id", pkpTechIds)
        : { data: [] };
      const pkpMap = Object.fromEntries(((pkpProfiles as any[]) || []).map(p => [p.user_id, p.full_name]));
      setPickups(((pkps as any[]) || []).map(p => ({ ...p, tech_name: pkpMap[p.technician_id] ?? "Unknown" })));

      // Load active drivers for pickup assignment
      const { data: drv } = await supabase.from("drivers")
        .select("id,full_name,license_number,phone").eq("employment_status", "active").order("full_name");
      setDrivers((drv as Driver[]) || []);

      // Load delegates
      const { data: deleg } = await supabase.from("camera_delegates")
        .select("id,user_id,unit_id");
      const delegUserIds = ((deleg as any[]) || []).map(d => d.user_id);
      const { data: delegP } = delegUserIds.length
        ? await supabase.from("profiles").select("user_id,full_name").in("user_id", delegUserIds)
        : { data: [] };
      const delegPMap = Object.fromEntries(((delegP as any[]) || []).map(p => [p.user_id, p.full_name]));
      setDelegates(((deleg as any[]) || []).map(d => ({ ...d, full_name: delegPMap[d.user_id] ?? "Unknown" })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deploy = async () => {
    if (!dTechId || !dUnitName || !dStart || !dEnd) { setError("All required fields must be filled."); return; }
    const unitRow = units.find(u => u.name === dUnitName);
    if (!unitRow) { setError("Selected unit not found."); return; }
    const unitConfig = DEPLOY_UNITS.find(u => u.name === dUnitName);
    setDeploying(true); setError(null);
    try {
      const { error: e } = await supabase.rpc("deploy_camera_technician", {
        p_technician_id: dTechId, p_unit_id: unitRow.id,
        p_start_date: dStart, p_end_date: dEnd,
        p_shift_type: unitConfig?.shift === "production" ? "production" : "straight_day",
        p_sub_shift: unitConfig?.shift === "production" ? (dSub || "dawn") : null,
        p_notes: dNotes || null,
      });
      if (e) throw e;
      setShowDeployForm(false);
      setDTechId(""); setDUnitName(""); setDStart(""); setDEnd(""); setDSub(""); setDNotes("");
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setDeploying(false); }
  };

  const endDeployment = async (id: string) => {
    await supabase.rpc("end_camera_deployment", { p_deployment_id: id });
    await load();
  };

  const actPickup = async (id: string, action: "approved" | "rejected") => {
    setActingPickup(id);
    try {
      const drvId = pickupDriverId[id] || null;
      const note  = pickupNote[id] || null;
      const { error: e } = await supabase.rpc("action_camera_pickup", {
        p_pickup_id: id, p_action: action,
        p_driver_id: drvId || null,
        p_notes: note,
      });
      if (e) throw e;
      await load();
    } catch(e: any) { setError(e.message); }
    finally { setActingPickup(null); }
  };

  const addDelegate = async () => {
    if (!delegUserId) return;
    setAddingDeleg(true);
    const { error: e } = await supabase.from("camera_delegates").insert({ user_id: delegUserId, delegated_by: (await supabase.auth.getUser()).data.user?.id, unit_id: delegUnitId || null });
    if (e) setError(e.message);
    else { setShowDelegForm(false); setDelegUserId(""); setDelegUnitId(""); await load(); }
    setAddingDeleg(false);
  };

  const removeDelegate = async (id: string) => {
    await supabase.from("camera_delegates").delete().eq("id", id);
    await load();
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: "deployments", label: "Deployments" },
    { value: "pickups",     label: "Pickup Requests" },
    { value: "delegates",   label: "Delegates" },
  ];
  const counts = {
    deployments: deployments.filter(d => d.status === "active").length,
    pickups: pickups.filter(p => p.status === "pending").length,
    delegates: delegates.length,
  };

const today = new Date().toISOString().slice(0, 10);

const activeDeployments = deployments.filter(
  d => d.status === "active" && (!d.end_date || d.end_date >= today)
);

const pastDeployments = deployments.filter(
  d => d.status !== "active" || (d.end_date && d.end_date < today)
);
  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Camera Department</h1>
          <p className="page-sub">Deploy technicians · Manage pickups · Assign delegates</p>
        </div>
        <Btn variant="primary" onClick={() => setShowDeployForm(true)}>+ Deploy Technician</Btn>
      </div>

      {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Deployments", value: activeDeployments.length, color: "var(--green)" },
          { label: "Pending Pickups",    value: pickups.filter(p => p.status === "pending").length, color: "var(--amber)" },
          { label: "Technicians",        value: technicians.length, color: "var(--accent)" },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} counts={counts} />

      {/* ─── DEPLOYMENTS TAB ─── */}
      {tab === "deployments" && (
        <div className="space-y-4">
          {/* Active */}
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>ACTIVE DEPLOYMENTS</h3>
          {activeDeployments.length === 0 ? (
            <EmptyState title="No active deployments" subtitle="Deploy a technician to get started" />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead>
                    <tr><th>Technician</th><th>Deployed To</th><th>Shift</th><th>From</th><th>Until</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {activeDeployments.map(d => (
                      <tr key={d.id}>
                        <td className="font-medium">{d.tech_name}</td>
                        <td>{d.unit_name}</td>
                        <td className="text-xs" style={{ color: "var(--text-muted)" }}>{shiftBadge(d.shift_type, d.sub_shift)}</td>
                        <td className="text-xs whitespace-nowrap">{fmtDate(d.deployment_date)}</td>
                        <td className="text-xs whitespace-nowrap">{d.end_date ? fmtDate(d.end_date) : "Open-ended"}</td>
                        <td><span className={`badge ${STATUS_COLOR[d.status] ?? "badge-draft"}`}>{d.status}</span></td>
                        <td>
                          <Btn size="sm" variant="amber" onClick={() => endDeployment(d.id)}>End</Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Past */}
          {pastDeployments.length > 0 && (
            <>
              <h3 className="text-sm font-semibold mt-4" style={{ color: "var(--text-muted)" }}>PAST DEPLOYMENTS</h3>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="tms-table">
                    <thead><tr><th>Technician</th><th>Unit</th><th>Shift</th><th>From</th><th>Until</th><th>Status</th></tr></thead>
                    <tbody>
                      {pastDeployments.slice(0, 20).map(d => (
                        <tr key={d.id}>
                          <td>{d.tech_name}</td>
                          <td>{d.unit_name}</td>
                          <td className="text-xs" style={{ color: "var(--text-muted)" }}>{shiftBadge(d.shift_type, d.sub_shift)}</td>
                          <td className="text-xs">{fmtDate(d.deployment_date)}</td>
                          <td className="text-xs">{d.end_date ? fmtDate(d.end_date) : "—"}</td>
                          <td><span className={`badge ${STATUS_COLOR[d.status] ?? "badge-draft"}`}>{d.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── PICKUPS TAB ─── */}
      {tab === "pickups" && (
        <div className="space-y-3">
          {pickups.length === 0 ? (
            <EmptyState title="No pickup requests" subtitle="Technician requests will appear here" />
          ) : pickups.map(p => (
            <Card key={p.id}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: p.pickup_type === "dawn" ? "var(--amber-dim)" : "var(--accent-dim)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                      {p.pickup_type === "dawn" ? "🌅 Dawn Pickup" : "🌆 Evening Drop-off"} — {p.tech_name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {fmtDate(p.pickup_date)} · {p.requested_time?.slice(0, 5)}
                    </p>
                  </div>
                  <span className={`badge ${STATUS_COLOR[p.status] ?? "badge-draft"}`}>{p.status}</span>
                </div>
              </div>
              <div className="px-4 py-3 space-y-1 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>📍 {p.pickup_location} → {p.dropoff_location}</p>
                {p.driver_name && <p className="text-xs" style={{ color: "var(--green)" }}>🚗 {p.driver_name} {p.driver_phone ? `· ${p.driver_phone}` : ""} {p.vehicle_plate ? `(${p.vehicle_plate})` : ""}</p>}
                {p.notes && <p className="text-xs italic" style={{ color: "var(--text-dim)" }}>{p.notes}</p>}
              </div>

              {p.status === "pending" && (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Assign Driver (optional)">
                      <Select value={pickupDriverId[p.id] ?? ""} onChange={e => setPickupDriverId(m => ({ ...m, [p.id]: e.target.value }))}>
                        <option value="">— No driver assigned —</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name ?? d.license_number}{d.phone ? ` · ${d.phone}` : ""}</option>)}
                      </Select>
                    </Field>
                    <Field label="Note (optional)">
                      <Input value={pickupNote[p.id] ?? ""} onChange={e => setPickupNote(m => ({ ...m, [p.id]: e.target.value }))} placeholder="Optional note…" />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Btn variant="success" size="sm" loading={actingPickup === p.id} onClick={() => actPickup(p.id, "approved")}>Approve</Btn>
                    <Btn variant="danger"  size="sm" loading={actingPickup === p.id} onClick={() => actPickup(p.id, "rejected")}>Reject</Btn>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ─── DELEGATES TAB ─── */}
      {tab === "delegates" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Btn variant="primary" size="sm" onClick={() => setShowDelegForm(true)}>+ Add Delegate</Btn>
          </div>
          {delegates.length === 0 ? (
            <EmptyState title="No delegates" subtitle="Delegates can deploy technicians on your behalf" />
          ) : delegates.map(d => (
            <Card key={d.id}>
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{d.full_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {d.unit_id ? `Scoped to unit` : "All units"}
                  </p>
                </div>
                <Btn size="sm" variant="danger" onClick={() => removeDelegate(d.id)}>Remove</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Deploy Modal ── */}
      <Modal open={showDeployForm} onClose={() => setShowDeployForm(false)} title="Deploy Camera Technician" maxWidth="max-w-lg">
        <div className="space-y-4">
          {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

          <Field label="Technician" required>
            <Select value={dTechId} onChange={e => setDTechId(e.target.value)}>
              <option value="">Select technician…</option>
              {technicians.map(t => <option key={t.user_id} value={t.user_id}>{t.full_name}{t.position_title ? ` — ${t.position_title}` : ""}</option>)}
            </Select>
          </Field>

          <Field label="Deploy To" required>
            <div className="grid grid-cols-2 gap-2">
              {DEPLOY_UNITS.map(u => (
                <button key={u.name} type="button"
                  onClick={() => { setDUnitName(u.name); setDShift(u.shift ?? "straight_day"); setDSub(""); }}
                  style={{
                    padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                    border: `2px solid ${dUnitName === u.name ? "var(--accent)" : "var(--border)"}`,
                    background: dUnitName === u.name ? "var(--accent-dim)" : "var(--surface-2)",
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: dUnitName === u.name ? "var(--accent)" : "var(--text)" }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {u.shift === "production" ? "Dawn / Afternoon" : "8am – 5pm"}
                  </div>
                </button>
              ))}
            </div>
          </Field>

          {/* Production sub-shift */}
          {DEPLOY_UNITS.find(u => u.name === dUnitName)?.shift === "production" && (
            <Field label="Sub-shift" required>
              <div className="flex gap-2">
                {["dawn","afternoon"].map(s => (
                  <button key={s} type="button" onClick={() => setDSub(s)}
                    style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                      border: `2px solid ${dSub === s ? "var(--accent)" : "var(--border)"}`,
                      background: dSub === s ? "var(--accent-dim)" : "var(--surface-2)",
                      color: dSub === s ? "var(--accent)" : "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>
                    {s === "dawn" ? "🌅 Dawn (5am–2pm)" : "🌆 Afternoon (2pm–end)"}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date" required>
              <Input type="date" value={dStart} min={new Date().toISOString().slice(0,10)} onChange={e => setDStart(e.target.value)} />
            </Field>
            <Field label="End Date" required>
              <Input type="date" value={dEnd} min={dStart} onChange={e => setDEnd(e.target.value)} />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea rows={2} placeholder="Any special instructions…" value={dNotes} onChange={e => setDNotes(e.target.value)} />
          </Field>

          <div className="flex justify-end gap-3 pt-1">
            <Btn variant="ghost" onClick={() => setShowDeployForm(false)}>Cancel</Btn>
            <Btn variant="primary" loading={deploying} onClick={deploy}>Deploy</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Add Delegate Modal ── */}
      <Modal open={showDelegForm} onClose={() => setShowDelegForm(false)} title="Add Delegate" maxWidth="max-w-sm">
        <div className="space-y-4">
          <Field label="Team Member" required>
            <Select value={delegUserId} onChange={e => setDelegUserId(e.target.value)}>
              <option value="">Select…</option>
              {technicians.map(t => <option key={t.user_id} value={t.user_id}>{t.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Scope to Unit (optional)">
            <Select value={delegUnitId} onChange={e => setDelegUnitId(e.target.value)}>
              <option value="">All units (full delegate)</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={() => setShowDelegForm(false)}>Cancel</Btn>
            <Btn variant="primary" loading={addingDeleg} onClick={addDelegate}>Add Delegate</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TECHNICIAN (STAFF) VIEW
// ══════════════════════════════════════════════════════════════════════════════
function TechnicianView({ userId }: { userId: string }) {
  const [deployment, setDeployment] = useState<any | null>(null);
  const [myPickups, setMyPickups]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [pType, setPType]           = useState("dawn");
  const [pDate, setPDate]           = useState("");
  const [pFrom, setPFrom]           = useState("");
  const [pTo, setPTo]               = useState("");
  const [pTime, setPTime]           = useState("");
  const [pNotes, setPNotes]         = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Get active deployment
      const { data: deps } = await supabase.from("camera_deployments")
        .select("id,unit_id,shift_type,sub_shift,deployment_date,end_date,status,notes")
        .eq("technician_id", userId)
        .eq("status", "active")
        .lte("deployment_date", today)
        .order("deployment_date", { ascending: false })
        .limit(1);

      if (deps && deps.length > 0) {
        const dep = (deps as any[])[0];
        // Get unit name
        const { data: unit } = await supabase.from("units").select("name").eq("id", dep.unit_id).single();
        setDeployment({ ...dep, unit_name: (unit as any)?.name ?? "Unknown" });
      } else {
        setDeployment(null);
      }

      // My pickup requests
      const { data: pkps } = await supabase.from("camera_pickups")
        .select("id,pickup_type,pickup_date,pickup_location,dropoff_location,requested_time,status,notes,driver_name,driver_phone,vehicle_plate")
        .eq("technician_id", userId)
        .order("pickup_date", { ascending: false })
        .limit(20);
      setMyPickups((pkps as any[]) || []);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const submitPickup = async () => {
    if (!pDate || !pFrom || !pTo || !pTime) { setError("Please fill all required fields."); return; }
    setSaving(true); setError(null);
    try {
      const { error: e } = await supabase.rpc("request_camera_pickup", {
        p_pickup_type: pType, p_pickup_date: pDate,
        p_pickup_location: pFrom, p_dropoff_location: pTo,
        p_requested_time: pTime, p_notes: pNotes || null,
      });
      if (e) throw e;
      setShowForm(false);
      setPDate(""); setPFrom(""); setPTo(""); setPTime(""); setPNotes("");
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">My Schedule</h1>
      </div>

      {/* Current deployment card */}
      <Card>
        <CardHeader title="Current Deployment" />
        <CardBody>
          {!deployment ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>You have no active deployment.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: "var(--accent-dim)" }}>📺</div>
                <div>
                  <p className="font-bold" style={{ color: "var(--text)" }}>{deployment.unit_name}</p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{shiftBadge(deployment.shift_type, deployment.sub_shift)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>From</p>
                  <p style={{ color: "var(--text)", fontWeight: 600 }}>{fmtDate(deployment.deployment_date)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Until</p>
                  <p style={{ color: "var(--text)", fontWeight: 600 }}>{deployment.end_date ? fmtDate(deployment.end_date) : "Open-ended"}</p>
                </div>
              </div>
              {/* Shift hours info */}
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p className="font-semibold" style={{ color: "var(--text)" }}>⏰ Working Hours</p>
                <p style={{ color: "var(--text-muted)" }}>
                  {deployment.shift_type === "production"
                    ? deployment.sub_shift === "dawn"
                      ? "🌅 5:00 AM – 2:00 PM"
                      : "🌆 2:00 PM – until last programme"
                    : "🕗 8:00 AM – 5:00 PM"}
                </p>
              </div>
              {deployment.notes && <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>{deployment.notes}</p>}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Pickup requests */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>MY PICKUP REQUESTS</h2>
        <Btn size="sm" variant="primary" onClick={() => setShowForm(true)}>+ Request Pickup</Btn>
      </div>

      {myPickups.length === 0 ? (
        <EmptyState title="No pickup requests" subtitle="Request a dawn pickup or evening drop-off" />
      ) : myPickups.map(p => (
        <Card key={p.id}>
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                  {p.pickup_type === "dawn" ? "🌅 Dawn Pickup" : "🌆 Evening Drop-off"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{fmtDate(p.pickup_date)} · {p.requested_time?.slice(0, 5)}</p>
              </div>
              <span className={`badge ${STATUS_COLOR[p.status] ?? "badge-draft"}`}>{p.status}</span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>📍 {p.pickup_location} → {p.dropoff_location}</p>
            {p.status === "approved" && p.driver_name && (
              <div className="rounded-xl px-3 py-2" style={{ background: "var(--green-dim)", border: "1px solid var(--green)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--green)" }}>🚗 Driver Assigned</p>
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{p.driver_name}</p>
                {p.driver_phone && <p className="text-sm font-mono" style={{ color: "var(--accent)" }}>{p.driver_phone}</p>}
                {p.vehicle_plate && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Vehicle: {p.vehicle_plate}</p>}
              </div>
            )}
          </div>
        </Card>
      ))}

      {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {/* Pickup Request Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Request Pickup / Drop-off" maxWidth="max-w-sm">
        <div className="space-y-4">
          {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

          <Field label="Type" required>
            <div className="flex gap-2">
              {[{ v: "dawn", l: "🌅 Dawn Pickup" }, { v: "evening", l: "🌆 Evening Drop-off" }].map(t => (
                <button key={t.v} type="button" onClick={() => setPType(t.v)}
                  style={{ flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                    border: `2px solid ${pType === t.v ? "var(--accent)" : "var(--border)"}`,
                    background: pType === t.v ? "var(--accent-dim)" : "var(--surface-2)",
                    color: pType === t.v ? "var(--accent)" : "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>
                  {t.l}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <Input type="date" value={pDate} min={new Date().toISOString().slice(0,10)} onChange={e => setPDate(e.target.value)} />
            </Field>
            <Field label="Requested Time" required>
              <Input type="time" value={pTime} onChange={e => setPTime(e.target.value)} />
            </Field>
          </div>

          <Field label="Pickup Location" required>
            <Input placeholder="Where to pick you up" value={pFrom} onChange={e => setPFrom(e.target.value)} />
          </Field>
          <Field label="Drop-off Location" required>
            <Input placeholder="Where to drop you off" value={pTo} onChange={e => setPTo(e.target.value)} />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} placeholder="Any additional info…" value={pNotes} onChange={e => setPNotes(e.target.value)} />
          </Field>

          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={submitPickup}>Submit Request</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RECEIVING UNIT HEAD VIEW
// Shows camera technicians deployed to their unit + can approve pickups for them
// ══════════════════════════════════════════════════════════════════════════════
function ReceivingUnitHeadView({ unitId }: { unitId: string }) {
  const [deployed, setDeployed] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("camera_deployments")
        .select("id,technician_id,shift_type,sub_shift,deployment_date,end_date,status,notes")
        .eq("unit_id", unitId)
        .eq("status", "active")
        .lte("deployment_date", today);

      const techIds = ((data as any[]) || []).map(d => d.technician_id);
      const { data: profiles } = techIds.length
        ? await supabase.from("profiles").select("user_id,full_name,phone").in("user_id", techIds)
        : { data: [] };
      const pMap = Object.fromEntries(((profiles as any[]) || []).map(p => [p.user_id, p]));

      setDeployed(((data as any[]) || []).map(d => ({ ...d, ...pMap[d.technician_id] })));
      setLoading(false);
    })();
  }, [unitId]);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="📸 Deployed Camera Technicians" subtitle="Currently assigned to your unit" />
        <CardBody>
          {deployed.length === 0 ? (
            <EmptyState title="No technicians deployed" subtitle="Camera dept will assign technicians here" />
          ) : (
            <div className="space-y-3">
              {deployed.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: "var(--accent-dim)" }}>📷</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{d.full_name ?? "Unknown"}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{shiftBadge(d.shift_type, d.sub_shift)}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Until {d.end_date ? fmtDate(d.end_date) : "open-ended"}</p>
                  </div>
                  {d.phone && <p className="text-xs font-mono shrink-0" style={{ color: "var(--accent)" }}>{d.phone}</p>}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT — routes to the right view based on role + unit
// ══════════════════════════════════════════════════════════════════════════════
export default function CameraDashboard() {
  const { profile, user } = useAuth();

  if (!profile || !user) return <PageSpinner />;

  const isCameraHead = profile.system_role === "unit_head" && profile.unit_id === CAMERA_UNIT_ID;
  const isCameraTech = profile.unit_id === CAMERA_UNIT_ID && profile.system_role === "staff";

  // Check if user is a delegate (we'd need to check camera_delegates)
  // For simplicity: unit_head of camera dept + admins → HeadView
  // staff of camera dept → TechnicianView
  // unit_head of receiving unit → ReceivingUnitHeadView (embedded in their layout)
  // admin / transport_supervisor → HeadView

  if (isCameraHead || profile.system_role === "admin") {
    return <HeadView />;
  }

  if (isCameraTech) {
    return <TechnicianView userId={user.id} />;
  }

  // Receiving unit heads see deployed technicians in their own layout as a widget
  if (profile.system_role === "unit_head" && profile.unit_id) {
    return <ReceivingUnitHeadView unitId={profile.unit_id} />;
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">📷</div>
      <div>Camera Department access only</div>
    </div>
  );
}