// src/modules/camera/pages/CameraDashboard.tsx
// Head of Camera: deploy, view all deployments segmented by unit, manage pickups, delegates,
//   see all news assignments where camera techs are deployed.
// Technician (staff): see my deployment, my pickup requests, my assignments.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  PageSpinner, EmptyState, Badge, Card, CardHeader, CardBody,
  Field, Input, Select, Textarea, Btn, Modal, Alert, TabBar,
} from "@/components/TmsUI";
import { useToast } from "@/components/ErrorToast";
import { fmtDate } from "@/lib/utils";

const CAMERA_UNIT_ID = "252e08c0-0999-4afe-9eff-a15365bd4d47";

const DEPLOY_UNITS: { name: string; shift: string; sub?: string[] }[] = [
  { name: "Joy News",     shift: "straight_day" },
  { name: "Adom Tv",      shift: "straight_day" },
  { name: "Joy Business", shift: "straight_day" },
  { name: "Production",   shift: "production", sub: ["dawn", "afternoon"] },
];

const SHIFT_LABEL: Record<string, string> = {
  straight_day: "Straight Day (8am–5pm)",
  production:   "Production",
  dawn:         "Dawn (5am–2pm)",
  afternoon:    "Afternoon (2pm–last)",
};

const STATUS_CLS: Record<string, string> = {
  active:   "badge-approved",
  ended:    "badge-closed",
  pending:  "badge-submitted",
  approved: "badge-approved",
  rejected: "badge-rejected",
};

type Tech = { user_id: string; full_name: string; position_title: string | null };
type Unit = { id: string; name: string };
type Driver = { id: string; full_name: string | null; license_number: string; phone: string | null };

type Deployment = {
  id: string; technician_id: string; tech_name: string;
  unit_id: string; unit_name: string;
  shift_type: string; sub_shift: string | null;
  deployment_date: string; end_date: string | null;
  status: string; notes: string | null;
};

type Pickup = {
  id: string; technician_id: string; tech_name: string;
  pickup_type: string; pickup_date: string;
  pickup_location: string; dropoff_location: string;
  requested_time: string; status: string; notes: string | null;
  driver_name: string | null; driver_phone: string | null; vehicle_plate: string | null;
};

type Delegate = { id: string; user_id: string; full_name: string; unit_id: string | null };

type NewsAssignment = {
  id: string; destination: string; assignment_date: string;
  is_urgent: boolean; is_live_u: boolean;
  call_time: string | null; departure_time: string | null;
  status: string; notes: string | null;
  unit_name: string;
  reporter_name: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  camera_tech_name: string | null;
  gps_address: string | null;
};

type Tab = "deployments" | "pickups" | "assignments" | "delegates";

function shiftLbl(s: string, sub: string | null) {
  if (s === "production" && sub) return SHIFT_LABEL[sub] ?? sub;
  return SHIFT_LABEL[s] ?? s;
}

// ══════════════════════════════════════════════════════
// HEAD VIEW
// ══════════════════════════════════════════════════════
function HeadView() {
  const toast = useToast();
  const [tab, setTab]               = useState<Tab>("deployments");
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [pickups, setPickups]         = useState<Pickup[]>([]);
  const [delegates, setDelegates]     = useState<Delegate[]>([]);
  const [techs, setTechs]             = useState<Tech[]>([]);
  const [units, setUnits]             = useState<Unit[]>([]);
  const [drivers, setDrivers]         = useState<Driver[]>([]);
  const [newsAssignments, setNewsAssignments] = useState<NewsAssignment[]>([]);
  const [loading, setLoading]         = useState(true);

  // Deploy form
  const [showDeploy, setShowDeploy] = useState(false);
  const [dTech, setDTech]  = useState("");
  const [dUnit, setDUnit]  = useState("");
  const [dStart, setDStart] = useState("");
  const [dEnd, setDEnd]     = useState("");
  const [dShift, setDShift] = useState("straight_day");
  const [dSub, setDSub]     = useState("");
  const [dNotes, setDNotes] = useState("");
  const [deploying, setDeploying] = useState(false);

  // Amend form
  const [amendTarget, setAmendTarget] = useState<Deployment | null>(null);
  const [aEnd, setAEnd]   = useState("");
  const [aSub, setASub]   = useState("");
  const [aNotes, setANotes] = useState("");
  const [amending, setAmending] = useState(false);

  // End confirm
  const [endTarget, setEndTarget] = useState<string | null>(null);
  const [ending, setEnding]       = useState(false);

  // Pickup action
  const [actingPickup, setActingPickup] = useState<string | null>(null);
  const [pDriverId, setPDriverId] = useState<Record<string, string>>({});
  const [pNote, setPNote]         = useState<Record<string, string>>({});

  // Delegate form
  const [showDeleg, setShowDeleg]     = useState(false);
  const [delegUser, setDelegUser]     = useState("");
  const [delegUnit, setDelegUnit]     = useState("");
  const [addingDeleg, setAddingDeleg] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: t } = await supabase.from("profiles")
        .select("user_id,full_name,position_title")
        .eq("unit_id", CAMERA_UNIT_ID).eq("status", "active").order("full_name");
      setTechs((t as Tech[]) || []);

      const { data: u } = await supabase.from("units").select("id,name")
        .in("name", DEPLOY_UNITS.map(x => x.name));
      setUnits((u as Unit[]) || []);

      const { data: deps } = await supabase.from("camera_deployments")
        .select("id,technician_id,unit_id,shift_type,sub_shift,deployment_date,end_date,status,notes")
        .in("status", ["active", "ended"])
        .order("deployment_date", { ascending: false }).limit(300);
      const depArr = (deps as any[]) || [];
      const techIds = [...new Set(depArr.map(d => d.technician_id))];
      const unitIds = [...new Set(depArr.map(d => d.unit_id))];
      const [{ data: pData }, { data: uData }] = await Promise.all([
        techIds.length ? supabase.from("profiles").select("user_id,full_name").in("user_id", techIds) : Promise.resolve({ data: [] }),
        unitIds.length ? supabase.from("units").select("id,name").in("id", unitIds) : Promise.resolve({ data: [] }),
      ]);
      const pMap = Object.fromEntries(((pData as any[]) || []).map(p => [p.user_id, p.full_name]));
      const uMap = Object.fromEntries(((uData as any[]) || []).map(u => [u.id, u.name]));
      setDeployments(depArr.map(d => ({ ...d, tech_name: pMap[d.technician_id] ?? "Unknown", unit_name: uMap[d.unit_id] ?? "Unknown" })));

      const { data: pkps } = await supabase.from("camera_pickups")
        .select("id,technician_id,pickup_type,pickup_date,pickup_location,dropoff_location,requested_time,status,notes,driver_name,driver_phone,vehicle_plate")
        .in("status", ["pending", "approved", "rejected"])
        .order("pickup_date", { ascending: false }).limit(100);
      const pkpArr = (pkps as any[]) || [];
      const pkpIds = [...new Set(pkpArr.map(p => p.technician_id))];
      const { data: pkpP } = pkpIds.length ? await supabase.from("profiles").select("user_id,full_name").in("user_id", pkpIds) : { data: [] };
      const pkpMap = Object.fromEntries(((pkpP as any[]) || []).map(p => [p.user_id, p.full_name]));
      setPickups(pkpArr.map(p => ({ ...p, tech_name: pkpMap[p.technician_id] ?? "Unknown" })));

      const { data: drv } = await supabase.from("drivers").select("id,full_name,license_number,phone").eq("employment_status", "active").order("full_name");
      setDrivers((drv as Driver[]) || []);

      // News assignments where any camera tech from this dept is involved
      const techUserIds = ((t as Tech[]) || []).map(x => x.user_id);
      if (techUserIds.length > 0) {
        const { data: asgData } = await supabase.from("news_assignments")
          .select("id,destination,assignment_date,is_urgent,is_live_u,call_time,departure_time,status,notes,gps_address,unit_id,reporter_id,driver_id,camera_tech_id")
          .in("camera_tech_id", techUserIds)
          .order("assignment_date", { ascending: false }).limit(200);
        const asgArr = (asgData as any[]) || [];
        const repIds     = [...new Set(asgArr.map(a => a.reporter_id).filter(Boolean))];
        const drvIds     = [...new Set(asgArr.map(a => a.driver_id).filter(Boolean))];
        const camIds     = [...new Set(asgArr.map(a => a.camera_tech_id).filter(Boolean))];
        const asgUnitIds = [...new Set(asgArr.map(a => a.unit_id).filter(Boolean))];
        const [{ data: repP }, { data: drvD }, { data: camP }, { data: asgUnits }] = await Promise.all([
          repIds.length ? supabase.from("profiles").select("user_id,full_name").in("user_id", repIds) : Promise.resolve({ data: [] }),
          drvIds.length ? supabase.from("drivers").select("id,full_name,phone").in("id", drvIds) : Promise.resolve({ data: [] }),
          camIds.length ? supabase.from("profiles").select("user_id,full_name").in("user_id", camIds) : Promise.resolve({ data: [] }),
          asgUnitIds.length ? supabase.from("units").select("id,name").in("id", asgUnitIds) : Promise.resolve({ data: [] }),
        ]);
        const repMap  = Object.fromEntries(((repP as any[]) || []).map(p => [p.user_id, p.full_name]));
        const drvMap  = Object.fromEntries(((drvD as any[]) || []).map(d => [d.id, d]));
        const camMap  = Object.fromEntries(((camP as any[]) || []).map(p => [p.user_id, p.full_name]));
        const uNameMap = Object.fromEntries(((asgUnits as any[]) || []).map(u => [u.id, u.name]));
        setNewsAssignments(asgArr.map(a => ({
          ...a,
          unit_name:        uNameMap[a.unit_id] ?? "Unknown",
          reporter_name:    a.reporter_id    ? repMap[a.reporter_id]    ?? null : null,
          driver_name:      a.driver_id      ? (drvMap[a.driver_id] as any)?.full_name ?? null : null,
          driver_phone:     a.driver_id      ? (drvMap[a.driver_id] as any)?.phone ?? null : null,
          camera_tech_name: a.camera_tech_id ? camMap[a.camera_tech_id] ?? null : null,
        })));
      } else {
        setNewsAssignments([]);
      }

      const { data: deleg } = await supabase.from("camera_delegates").select("id,user_id,unit_id");
      const delegIds = ((deleg as any[]) || []).map(d => d.user_id);
      const { data: delegP } = delegIds.length ? await supabase.from("profiles").select("user_id,full_name").in("user_id", delegIds) : { data: [] };
      const delegMap = Object.fromEntries(((delegP as any[]) || []).map(p => [p.user_id, p.full_name]));
      setDelegates(((deleg as any[]) || []).map(d => ({ ...d, full_name: delegMap[d.user_id] ?? "Unknown" })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deploy = async () => {
    if (!dTech || !dUnit || !dStart || !dEnd) { toast.error("Validation Error", "All required fields must be filled."); return; }
    const unitRow = units.find(u => u.name === dUnit);
    if (!unitRow) { toast.error("Unit Error", "Selected unit not found."); return; }
    const cfg = DEPLOY_UNITS.find(u => u.name === dUnit);
    setDeploying(true);
    try {
      const { error: e } = await supabase.rpc("deploy_camera_technician", {
        p_technician_id: dTech, p_unit_id: unitRow.id,
        p_start_date: dStart, p_end_date: dEnd,
        p_shift_type: cfg?.shift === "production" ? "production" : "straight_day",
        p_sub_shift:  cfg?.shift === "production" ? (dSub || "dawn") : null,
        p_notes: dNotes || null,
      });
      if (e) throw e;
      toast.success("Deployed!", "Technician has been deployed.");
      setShowDeploy(false);
      setDTech(""); setDUnit(""); setDStart(""); setDEnd(""); setDSub(""); setDNotes("");
      await load();
    } catch (e: any) { toast.error("Deploy Failed", e.message); }
    finally { setDeploying(false); }
  };

  const endDeployment = async () => {
    if (!endTarget) return;
    setEnding(true);
    try {
      const { error: e } = await supabase.rpc("end_camera_deployment", { p_deployment_id: endTarget });
      if (e) throw e;
      toast.success("Deployment Ended");
      setEndTarget(null);
      await load();
    } catch (e: any) { toast.error("Failed to End Deployment", e.message); }
    finally { setEnding(false); }
  };

  const amendDeployment = async () => {
    if (!amendTarget) return;
    setAmending(true);
    try {
      const { error: e } = await supabase.rpc("amend_camera_deployment", {
        p_deployment_id: amendTarget.id,
        p_end_date:   aEnd   || null,
        p_sub_shift:  aSub   || null,
        p_notes:      aNotes || null,
      });
      if (e) throw e;
      toast.success("Amended", "Deployment updated.");
      setAmendTarget(null);
      await load();
    } catch (e: any) { toast.error("Amend Failed", e.message); }
    finally { setAmending(false); }
  };

  const actPickup = async (id: string, action: "approved" | "rejected") => {
    setActingPickup(id);
    try {
      const { error: e } = await supabase.rpc("action_camera_pickup", {
        p_pickup_id: id, p_action: action,
        p_driver_id: pDriverId[id] || null, p_notes: pNote[id] || null,
      });
      if (e) throw e;
      toast.success(action === "approved" ? "Pickup Approved" : "Pickup Rejected");
      await load();
    } catch (e: any) { toast.error("Action Failed", e.message); }
    finally { setActingPickup(null); }
  };

  const addDelegate = async () => {
    if (!delegUser) return;
    setAddingDeleg(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: e } = await supabase.from("camera_delegates").insert({ user_id: delegUser, delegated_by: user?.id, unit_id: delegUnit || null });
      if (e) throw e;
      toast.success("Delegate Added");
      setShowDeleg(false); setDelegUser(""); setDelegUnit("");
      await load();
    } catch (e: any) { toast.error("Failed", e.message); }
    finally { setAddingDeleg(false); }
  };

  const removeDelegate = async (id: string) => {
    const { error: e } = await supabase.from("camera_delegates").delete().eq("id", id);
    if (e) { toast.error("Failed to remove", e.message); return; }
    toast.success("Delegate Removed");
    await load();
  };

  const activeDeployments = deployments.filter(d => d.status === "active" && (!d.end_date || d.end_date >= today));
  const pastDeployments   = deployments.filter(d => d.status !== "active" || (d.end_date && d.end_date < today));

  // Group by unit
  const byUnit: Record<string, Deployment[]> = {};
  activeDeployments.forEach(d => { (byUnit[d.unit_name] = byUnit[d.unit_name] || []).push(d); });

  const asgByUnit: Record<string, NewsAssignment[]> = {};
  newsAssignments.forEach(a => { (asgByUnit[a.unit_name] = asgByUnit[a.unit_name] || []).push(a); });

  const tabs: { value: Tab; label: string }[] = [
    { value: "deployments",  label: "Active Deployments" },
    { value: "pickups",      label: "Pickup Requests" },
    { value: "assignments",  label: "Assignments Coverage" },
    { value: "delegates",    label: "Delegates" },
  ];
  const counts = {
    deployments: activeDeployments.length,
    pickups:     pickups.filter(p => p.status === "pending").length,
    assignments: newsAssignments.filter(a => a.status === "active").length,
    delegates:   delegates.length,
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Camera Department</h1>
          <p className="page-sub">Deploy technicians · Manage pickups · Assignments coverage</p>
        </div>
        <Btn variant="primary" onClick={() => setShowDeploy(true)}>+ Deploy Technician</Btn>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Deployments", value: activeDeployments.length, color: "var(--green)" },
          { label: "Pending Pickups",    value: pickups.filter(p => p.status === "pending").length, color: "var(--amber)" },
          { label: "Technicians",        value: techs.length, color: "var(--accent)" },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} counts={counts} />

      {/* ─── DEPLOYMENTS ─── */}
      {tab === "deployments" && (
        <div className="space-y-5">
          {Object.keys(byUnit).length === 0 ? (
            <EmptyState title="No active deployments" subtitle="Deploy a technician to get started" />
          ) : (
            Object.entries(byUnit).map(([unitName, deps]) => (
              <div key={unitName}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  📺 {unitName} — {deps.length} deployed
                </h3>
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="tms-table">
                      <thead><tr><th>Technician</th><th>Shift</th><th>From</th><th>Until</th><th>Status</th><th></th></tr></thead>
                      <tbody>
                        {deps.map(d => (
                          <tr key={d.id}>
                            <td className="font-medium">{d.tech_name}</td>
                            <td className="text-xs" style={{ color: "var(--text-muted)" }}>{shiftLbl(d.shift_type, d.sub_shift)}</td>
                            <td className="text-xs whitespace-nowrap">{fmtDate(d.deployment_date)}</td>
                            <td className="text-xs whitespace-nowrap">{d.end_date ? fmtDate(d.end_date) : "Open-ended"}</td>
                            <td><span className={`badge ${STATUS_CLS[d.status] ?? "badge-draft"}`}>{d.status}</span></td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <Btn size="sm" variant="ghost" onClick={() => { setAmendTarget(d); setAEnd(d.end_date ?? ""); setASub(d.sub_shift ?? ""); setANotes(d.notes ?? ""); }}>Amend</Btn>
                                <Btn size="sm" variant="amber" onClick={() => setEndTarget(d.id)}>End</Btn>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}

          {pastDeployments.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2 mt-4" style={{ color: "var(--text-muted)" }}>Past Deployments</h3>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="tms-table">
                    <thead><tr><th>Technician</th><th>Unit</th><th>Shift</th><th>From</th><th>Until</th><th>Status</th></tr></thead>
                    <tbody>
                      {pastDeployments.slice(0, 30).map(d => (
                        <tr key={d.id}>
                          <td>{d.tech_name}</td>
                          <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.unit_name}</td>
                          <td className="text-xs" style={{ color: "var(--text-muted)" }}>{shiftLbl(d.shift_type, d.sub_shift)}</td>
                          <td className="text-xs">{fmtDate(d.deployment_date)}</td>
                          <td className="text-xs">{d.end_date ? fmtDate(d.end_date) : "—"}</td>
                          <td><span className={`badge ${STATUS_CLS[d.status] ?? "badge-draft"}`}>{d.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── PICKUPS ─── */}
      {tab === "pickups" && (
        <div className="space-y-3">
          {pickups.length === 0 ? (
            <EmptyState title="No pickup requests" />
          ) : pickups.map(p => (
            <Card key={p.id}>
              <div className="px-4 py-3 border-b flex items-start justify-between gap-2"
                style={{ borderColor: "var(--border)", background: p.pickup_type.includes("dawn") ? "var(--amber-dim)" : "var(--accent-dim)" }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                    {p.pickup_type.includes("dawn") ? "🌅 Dawn Pickup" : "🌆 Evening Drop-off"} — {p.tech_name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{fmtDate(p.pickup_date)} · {p.requested_time?.slice(0, 5)}</p>
                </div>
                <span className={`badge ${STATUS_CLS[p.status] ?? "badge-draft"}`}>{p.status}</span>
              </div>
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>📍 {p.pickup_location} → {p.dropoff_location}</p>
                {p.driver_name && (
                  <p className="text-xs mt-1" style={{ color: "var(--green)" }}>
                    🚗 {p.driver_name}{p.driver_phone ? ` · ${p.driver_phone}` : ""}{p.vehicle_plate ? ` (${p.vehicle_plate})` : ""}
                  </p>
                )}
              </div>
              {p.status === "pending" && (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Assign Driver">
                      <Select value={pDriverId[p.id] ?? ""} onChange={e => setPDriverId(m => ({ ...m, [p.id]: e.target.value }))}>
                        <option value="">— No driver —</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name ?? d.license_number}{d.phone ? ` · ${d.phone}` : ""}</option>)}
                      </Select>
                    </Field>
                    <Field label="Note">
                      <Input value={pNote[p.id] ?? ""} onChange={e => setPNote(m => ({ ...m, [p.id]: e.target.value }))} placeholder="Optional…" />
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

      {/* ─── ASSIGNMENTS COVERAGE ─── */}
      {tab === "assignments" && (
        <div className="space-y-5">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            All assignments where camera technicians from this department are deployed, segmented by news unit.
          </p>
          {Object.keys(asgByUnit).length === 0 ? (
            <EmptyState title="No assignments found" subtitle="No assignments covering camera technicians yet" />
          ) : (
            Object.entries(asgByUnit).map(([unitName, asgs]) => (
              <div key={unitName}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  📺 {unitName} — {asgs.length} assignment{asgs.length !== 1 ? "s" : ""}
                </h3>
                <div className="space-y-2">
                  {asgs.map(a => (
                    <Card key={a.id}>
                      <div className="px-4 py-3 border-b flex items-start justify-between gap-2"
                        style={{ borderColor: "var(--border)", background: a.is_urgent ? "var(--red-dim)" : "var(--surface-2)" }}>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {a.is_urgent && <span className="badge badge-rejected">🚨 URGENT</span>}
                            {a.is_live_u && <span className="badge badge-dispatched">📡 Live U</span>}
                            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{a.destination}</p>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {fmtDate(a.assignment_date)}
                            {a.call_time && ` · Call: ${a.call_time.slice(0, 5)}`}
                          </p>
                        </div>
                        <Badge status={a.status} />
                      </div>
                      <div className="px-4 py-3 grid grid-cols-3 gap-3">
                        {[
                          { icon: "🎤", label: "Reporter", val: a.reporter_name, sub: null },
                          { icon: "📷", label: "Camera",   val: a.camera_tech_name, sub: null },
                          { icon: "🚗", label: "Driver",   val: a.driver_name, sub: a.driver_phone },
                        ].map(m => (
                          <div key={m.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18 }}>{m.icon}</div>
                            <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>{m.label}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{m.val ?? "—"}</div>
                            {m.sub && <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "monospace" }}>{m.sub}</div>}
                          </div>
                        ))}
                      </div>
                      {a.gps_address && (
                        <div className="px-4 pb-3">
                          <a href={a.gps_address} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--accent)" }}>📍 Navigate →</a>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── DELEGATES ─── */}
      {tab === "delegates" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Btn size="sm" variant="primary" onClick={() => setShowDeleg(true)}>+ Add Delegate</Btn>
          </div>
          {delegates.length === 0 ? (
            <EmptyState title="No delegates" />
          ) : delegates.map(d => (
            <Card key={d.id}>
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{d.full_name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{d.unit_id ? "Scoped to unit" : "All units"}</p>
                </div>
                <Btn size="sm" variant="danger" onClick={() => removeDelegate(d.id)}>Remove</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Deploy Modal ── */}
      <Modal open={showDeploy} onClose={() => setShowDeploy(false)} title="Deploy Camera Technician" maxWidth="max-w-lg">
        <div className="space-y-4">
          <Field label="Technician" required>
            <Select value={dTech} onChange={e => setDTech(e.target.value)}>
              <option value="">Select technician…</option>
              {techs.map(t => <option key={t.user_id} value={t.user_id}>{t.full_name}{t.position_title ? ` — ${t.position_title}` : ""}</option>)}
            </Select>
          </Field>
          <Field label="Deploy To" required>
            <div className="grid grid-cols-2 gap-2">
              {DEPLOY_UNITS.map(u => (
                <button key={u.name} type="button"
                  onClick={() => { setDUnit(u.name); setDShift(u.shift ?? "straight_day"); setDSub(""); }}
                  style={{
                    padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                    border: `2px solid ${dUnit === u.name ? "var(--accent)" : "var(--border)"}`,
                    background: dUnit === u.name ? "var(--accent-dim)" : "var(--surface-2)",
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: dUnit === u.name ? "var(--accent)" : "var(--text)" }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {u.shift === "production" ? "Dawn / Afternoon" : "8am–5pm"}
                  </div>
                </button>
              ))}
            </div>
          </Field>
          {DEPLOY_UNITS.find(u => u.name === dUnit)?.shift === "production" && (
            <Field label="Sub-shift" required>
              <div className="flex gap-2">
                {["dawn", "afternoon"].map(s => (
                  <button key={s} type="button" onClick={() => setDSub(s)}
                    style={{ flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                      textAlign: "center", fontWeight: 600, fontSize: 13,
                      border: `2px solid ${dSub === s ? "var(--accent)" : "var(--border)"}`,
                      background: dSub === s ? "var(--accent-dim)" : "var(--surface-2)",
                      color: dSub === s ? "var(--accent)" : "var(--text-muted)" }}>
                    {s === "dawn" ? "🌅 Dawn (5am–2pm)" : "🌆 Afternoon (2pm–end)"}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date" required><Input type="date" value={dStart} min={today} onChange={e => setDStart(e.target.value)} /></Field>
            <Field label="End Date" required><Input type="date" value={dEnd} min={dStart || today} onChange={e => setDEnd(e.target.value)} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={dNotes} onChange={e => setDNotes(e.target.value)} /></Field>
          <div className="flex justify-end gap-3 pt-1">
            <Btn variant="ghost" onClick={() => setShowDeploy(false)}>Cancel</Btn>
            <Btn variant="primary" loading={deploying} onClick={deploy}>Deploy</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Amend Modal ── */}
      <Modal open={!!amendTarget} onClose={() => setAmendTarget(null)} title="Amend Deployment" maxWidth="max-w-sm">
        {amendTarget && (
          <div className="space-y-4">
            <div className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)" }}>
              <p style={{ color: "var(--text)", fontWeight: 600 }}>{amendTarget.tech_name}</p>
              <p style={{ color: "var(--text-muted)", fontSize: 12 }}>{amendTarget.unit_name} · {shiftLbl(amendTarget.shift_type, amendTarget.sub_shift)}</p>
            </div>
            <Field label="New End Date"><Input type="date" value={aEnd} min={today} onChange={e => setAEnd(e.target.value)} /></Field>
            {amendTarget.shift_type === "production" && (
              <Field label="Change Sub-shift">
                <Select value={aSub} onChange={e => setASub(e.target.value)}>
                  <option value="">Keep current ({amendTarget.sub_shift ?? "—"})</option>
                  <option value="dawn">🌅 Dawn (5am–2pm)</option>
                  <option value="afternoon">🌆 Afternoon (2pm–end)</option>
                </Select>
              </Field>
            )}
            <Field label="Notes"><Textarea rows={2} value={aNotes} onChange={e => setANotes(e.target.value)} placeholder="Reason for amendment…" /></Field>
            <div className="flex justify-end gap-3">
              <Btn variant="ghost" onClick={() => setAmendTarget(null)}>Cancel</Btn>
              <Btn variant="primary" loading={amending} onClick={amendDeployment}>Save Changes</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ── End Confirm ── */}
      <Modal open={!!endTarget} onClose={() => setEndTarget(null)} title="End Deployment?" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>This will mark the deployment as ended. The technician will be notified.</p>
          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={() => setEndTarget(null)}>Cancel</Btn>
            <Btn variant="amber" loading={ending} onClick={endDeployment}>End Deployment</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Add Delegate ── */}
      <Modal open={showDeleg} onClose={() => setShowDeleg(false)} title="Add Delegate" maxWidth="max-w-sm">
        <div className="space-y-4">
          <Field label="Team Member" required>
            <Select value={delegUser} onChange={e => setDelegUser(e.target.value)}>
              <option value="">Select…</option>
              {techs.map(t => <option key={t.user_id} value={t.user_id}>{t.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Scope to Unit (optional)">
            <Select value={delegUnit} onChange={e => setDelegUnit(e.target.value)}>
              <option value="">All units</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={() => setShowDeleg(false)}>Cancel</Btn>
            <Btn variant="primary" loading={addingDeleg} onClick={addDelegate}>Add Delegate</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// TECHNICIAN VIEW
// ══════════════════════════════════════════════════════
function TechnicianView({ userId }: { userId: string }) {
  const toast = useToast();
  type TechTab = "deployment" | "pickups" | "assignments";
  const [tab, setTab]               = useState<TechTab>("deployment");
  const [deployment, setDeployment] = useState<any | null>(null);
  const [myPickups, setMyPickups]   = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<NewsAssignment[]>([]);
  const [loading, setLoading]       = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [pType, setPType]   = useState("dawn");
  const [pDate, setPDate]   = useState("");
  const [pFrom, setPFrom]   = useState("");
  const [pTo, setPTo]       = useState("");
  const [pTime, setPTime]   = useState("");
  const [pNotes, setPNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [amendPickup, setAmendPickup] = useState<any | null>(null);
  const [apFrom, setApFrom] = useState("");
  const [apTo, setApTo]     = useState("");
  const [apTime, setApTime] = useState("");
  const [apNotes, setApNotes] = useState("");
  const [amendingSaving, setAmendingSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: deps } = await supabase.from("camera_deployments")
        .select("id,unit_id,shift_type,sub_shift,deployment_date,end_date,status,notes")
        .eq("technician_id", userId).eq("status", "active")
        .lte("deployment_date", today).order("deployment_date", { ascending: false }).limit(1);
      if (deps && (deps as any[]).length > 0) {
        const dep = (deps as any[])[0];
        const { data: unit } = await supabase.from("units").select("name").eq("id", dep.unit_id).single();
        setDeployment({ ...dep, unit_name: (unit as any)?.name ?? "Unknown" });
      } else { setDeployment(null); }

      const { data: pkps } = await supabase.from("camera_pickups")
        .select("id,pickup_type,pickup_date,pickup_location,dropoff_location,requested_time,status,notes,driver_name,driver_phone,vehicle_plate")
        .eq("technician_id", userId).order("pickup_date", { ascending: false }).limit(20);
      setMyPickups((pkps as any[]) || []);

      const { data: asgData } = await supabase.from("news_assignments")
        .select("id,destination,assignment_date,is_urgent,is_live_u,call_time,departure_time,status,notes,gps_address,unit_id,reporter_id,driver_id,camera_tech_id")
        .eq("camera_tech_id", userId).order("assignment_date", { ascending: false }).limit(50);
      const asgArr = (asgData as any[]) || [];
      if (asgArr.length > 0) {
        const repIds  = [...new Set(asgArr.map(a => a.reporter_id).filter(Boolean))];
        const drvIds  = [...new Set(asgArr.map(a => a.driver_id).filter(Boolean))];
        const unitIds = [...new Set(asgArr.map(a => a.unit_id).filter(Boolean))];
        const [{ data: repP }, { data: drvD }, { data: uData }] = await Promise.all([
          repIds.length ? supabase.from("profiles").select("user_id,full_name").in("user_id", repIds) : Promise.resolve({ data: [] }),
          drvIds.length ? supabase.from("drivers").select("id,full_name,phone").in("id", drvIds) : Promise.resolve({ data: [] }),
          unitIds.length ? supabase.from("units").select("id,name").in("id", unitIds) : Promise.resolve({ data: [] }),
        ]);
        const repMap = Object.fromEntries(((repP as any[]) || []).map(p => [p.user_id, p.full_name]));
        const drvMap = Object.fromEntries(((drvD as any[]) || []).map(d => [d.id, d]));
        const uMap   = Object.fromEntries(((uData as any[]) || []).map(u => [u.id, u.name]));
        setMyAssignments(asgArr.map(a => ({
          ...a, unit_name: uMap[a.unit_id] ?? "Unknown",
          reporter_name:    a.reporter_id ? repMap[a.reporter_id] ?? null : null,
          driver_name:      a.driver_id   ? (drvMap[a.driver_id] as any)?.full_name ?? null : null,
          driver_phone:     a.driver_id   ? (drvMap[a.driver_id] as any)?.phone ?? null : null,
          camera_tech_name: null,
        })));
      } else { setMyAssignments([]); }
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const submitPickup = async () => {
    if (!pDate || !pFrom || !pTo || !pTime) { toast.error("Missing Fields", "Please fill all required fields."); return; }
    setSaving(true);
    try {
      const { error: e } = await supabase.rpc("request_camera_pickup", {
        p_pickup_type: pType, p_pickup_date: pDate,
        p_pickup_location: pFrom, p_dropoff_location: pTo,
        p_requested_time: pTime, p_notes: pNotes || null,
      });
      if (e) throw e;
      toast.success("Request Submitted");
      setShowForm(false); setPDate(""); setPFrom(""); setPTo(""); setPTime(""); setPNotes("");
      await load();
    } catch (e: any) { toast.error("Submission Failed", e.message); }
    finally { setSaving(false); }
  };

  const amendPickupFn = async () => {
    if (!amendPickup) return;
    setAmendingSaving(true);
    try {
      const { error: e } = await supabase.from("camera_pickups").update({
        pickup_location: apFrom || amendPickup.pickup_location,
        dropoff_location: apTo || amendPickup.dropoff_location,
        requested_time: apTime || amendPickup.requested_time,
        notes: apNotes || amendPickup.notes,
      }).eq("id", amendPickup.id).eq("technician_id", userId).eq("status", "pending");
      if (e) throw e;
      toast.success("Pickup Updated");
      setAmendPickup(null); await load();
    } catch (e: any) { toast.error("Update Failed", e.message); }
    finally { setAmendingSaving(false); }
  };

  const techTabs: { value: TechTab; label: string }[] = [
    { value: "deployment",  label: "My Deployment" },
    { value: "assignments", label: "My Assignments" },
    { value: "pickups",     label: "Pickups" },
  ];

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="page-header"><h1 className="page-title">My Schedule</h1></div>

      <TabBar tabs={techTabs} active={tab} onChange={setTab}
        counts={{ assignments: myAssignments.filter(a => a.status === "active").length, pickups: myPickups.filter(p => p.status === "pending").length }} />

      {tab === "deployment" && (
        <Card>
          <CardHeader title="Current Deployment" />
          <CardBody>
            {!deployment ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No active deployment assigned to you.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: "var(--accent-dim)" }}>📺</div>
                  <div>
                    <p className="font-bold" style={{ color: "var(--text)" }}>{deployment.unit_name}</p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>{shiftLbl(deployment.shift_type, deployment.sub_shift)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs" style={{ color: "var(--text-muted)" }}>From</p><p style={{ color: "var(--text)", fontWeight: 600 }}>{fmtDate(deployment.deployment_date)}</p></div>
                  <div><p className="text-xs" style={{ color: "var(--text-muted)" }}>Until</p><p style={{ color: "var(--text)", fontWeight: 600 }}>{deployment.end_date ? fmtDate(deployment.end_date) : "Open-ended"}</p></div>
                </div>
                <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>⏰ Working Hours</p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {deployment.shift_type === "production"
                      ? deployment.sub_shift === "dawn" ? "🌅 5:00 AM – 2:00 PM" : "🌆 2:00 PM – until last programme"
                      : "🕗 8:00 AM – 5:00 PM"}
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {tab === "assignments" && (
        <div className="space-y-3">
          {myAssignments.length === 0 ? (
            <EmptyState title="No assignments" subtitle="Assignments from news units will appear here" />
          ) : myAssignments.map(a => (
            <Card key={a.id}>
              <div className="px-4 py-3 border-b flex items-start justify-between gap-2"
                style={{ borderColor: "var(--border)", background: a.is_urgent ? "var(--red-dim)" : "var(--surface-2)" }}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.is_urgent && <span className="badge badge-rejected">🚨 URGENT</span>}
                    {a.is_live_u && <span className="badge badge-dispatched">📡 Live U</span>}
                    <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{a.destination}</p>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {a.unit_name} · {fmtDate(a.assignment_date)}
                    {a.call_time && ` · Call: ${a.call_time.slice(0, 5)}`}
                    {a.departure_time && ` · Depart: ${a.departure_time.slice(0, 5)}`}
                  </p>
                </div>
                <Badge status={a.status} />
              </div>
              <div className="px-4 py-3 grid grid-cols-3 gap-3">
                {[
                  { icon: "🎤", label: "Reporter", val: a.reporter_name, sub: null },
                  { icon: "📷", label: "Camera",   val: "You", sub: null },
                  { icon: "🚗", label: "Driver",   val: a.driver_name, sub: a.driver_phone },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18 }}>{m.icon}</div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>{m.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: m.val === "You" ? "var(--accent)" : "var(--text)", marginTop: 2 }}>{m.val ?? "—"}</div>
                    {m.sub && <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "monospace" }}>{m.sub}</div>}
                  </div>
                ))}
              </div>
              {(a.gps_address || a.notes) && (
                <div className="px-4 pb-3">
                  {a.gps_address && <a href={a.gps_address} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--accent)", display: "block" }}>📍 Navigate →</a>}
                  {a.notes && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{a.notes}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === "pickups" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>My Pickup Requests</p>
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
                      {p.pickup_type.includes("dawn") ? "🌅 Dawn Pickup" : "🌆 Evening Drop-off"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(p.pickup_date)} · {p.requested_time?.slice(0,5)}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`badge ${STATUS_CLS[p.status] ?? "badge-draft"}`}>{p.status}</span>
                    {p.status === "pending" && (
                      <Btn size="sm" variant="ghost" onClick={() => { setAmendPickup(p); setApFrom(p.pickup_location); setApTo(p.dropoff_location); setApTime(p.requested_time?.slice(0,5) ?? ""); setApNotes(p.notes ?? ""); }}>Amend</Btn>
                    )}
                  </div>
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>📍 {p.pickup_location} → {p.dropoff_location}</p>
                {p.status === "approved" && p.driver_name && (
                  <div className="rounded-xl px-3 py-2" style={{ background: "var(--green-dim)", border: "1px solid var(--green)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--green)" }}>🚗 Driver Assigned</p>
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{p.driver_name}</p>
                    {p.driver_phone && <p className="text-sm font-mono" style={{ color: "var(--accent)" }}>{p.driver_phone}</p>}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Request Pickup / Drop-off" maxWidth="max-w-sm">
        <div className="space-y-4">
          <Field label="Type" required>
            <div className="flex gap-2">
              {[{ v: "dawn", l: "🌅 Dawn" }, { v: "evening", l: "🌆 Evening" }].map(t => (
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
            <Field label="Date" required><Input type="date" value={pDate} min={today} onChange={e => setPDate(e.target.value)} /></Field>
            <Field label="Time" required><Input type="time" value={pTime} onChange={e => setPTime(e.target.value)} /></Field>
          </div>
          <Field label="Pickup Location" required><Input value={pFrom} onChange={e => setPFrom(e.target.value)} placeholder="Where to pick you up" /></Field>
          <Field label="Drop-off Location" required><Input value={pTo} onChange={e => setPTo(e.target.value)} placeholder="Where to drop you off" /></Field>
          <Field label="Notes"><Textarea rows={2} value={pNotes} onChange={e => setPNotes(e.target.value)} /></Field>
          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={submitPickup}>Submit</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!amendPickup} onClose={() => setAmendPickup(null)} title="Amend Pickup Request" maxWidth="max-w-sm">
        {amendPickup && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Update details for {amendPickup.pickup_type.includes("dawn") ? "dawn pickup" : "evening drop-off"} on {fmtDate(amendPickup.pickup_date)}.
            </p>
            <Field label="Pickup Location"><Input value={apFrom} onChange={e => setApFrom(e.target.value)} /></Field>
            <Field label="Drop-off Location"><Input value={apTo} onChange={e => setApTo(e.target.value)} /></Field>
            <Field label="Requested Time"><Input type="time" value={apTime} onChange={e => setApTime(e.target.value)} /></Field>
            <Field label="Notes"><Textarea rows={2} value={apNotes} onChange={e => setApNotes(e.target.value)} /></Field>
            <div className="flex justify-end gap-3">
              <Btn variant="ghost" onClick={() => setAmendPickup(null)}>Cancel</Btn>
              <Btn variant="primary" loading={amendingSaving} onClick={amendPickupFn}>Save Changes</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════
export default function CameraDashboard() {
  const { profile, user } = useAuth();
  if (!profile || !user) return <PageSpinner />;
  const isCameraHead = profile.system_role === "unit_head" && profile.unit_id === CAMERA_UNIT_ID;
  const isCameraTech = profile.unit_id === CAMERA_UNIT_ID && profile.system_role === "staff";
  if (isCameraHead || profile.system_role === "admin") return <HeadView />;
  if (isCameraTech) return <TechnicianView userId={user.id} />;
  return <div className="empty-state"><div className="empty-state-icon">📷</div><div>Camera Department access only</div></div>;
}