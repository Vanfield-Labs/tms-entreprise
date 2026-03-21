// src/modules/news/pages/NewsUnitDashboard.tsx
// Shared dashboard for Joy News, Adom TV/News, Joy Business assignment editors.
// Features:
//   - Create team assignments (reporter + driver + camera tech → story)
//   - View today's active assignments with full team info
//   - See available reporters, deployed camera techs, on-duty drivers
//   - Delegates management
//   - Notifications pushed to all 3 team members
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  PageSpinner, EmptyState, Badge, Card, CardHeader, CardBody,
  Field, Input, Select, Textarea, Btn, Modal, Alert, TabBar,
} from "@/components/TmsUI";
import { usePagination, PaginationBar } from "@/hooks/usePagination";
import { fmtDate } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type Reporter = { user_id: string; full_name: string; position_title: string | null };
type Driver   = { id: string; full_name: string | null; license_number: string; phone: string | null; route_name: string | null; shift: string | null };
type CamTech  = { user_id: string; full_name: string; unit_name: string; shift_type: string; sub_shift: string | null };
type Delegate = { id: string; user_id: string; full_name: string };

type Assignment = {
  id: string; destination: string; gps_address: string | null;
  call_time: string | null; departure_time: string | null;
  assignment_date: string; is_urgent: boolean; is_live_u: boolean;
  notes: string | null; status: string;
  reporter_id: string | null;
  reporter_name: string | null;
  driver_id: string | null;
  driver_name: string | null; driver_phone: string | null;
  camera_tech_id: string | null;
  camera_tech_name: string | null;
};

type Tab = "assignments" | "team" | "delegates";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : "—";
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NewsUnitDashboard({ unitId, unitName }: { unitId: string; unitName: string }) {
  const { user } = useAuth();
  const [tab, setTab]                 = useState<Tab>("assignments");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reporters, setReporters]     = useState<Reporter[]>([]);
  const [drivers, setDrivers]         = useState<Driver[]>([]);
  const [camTechs, setCamTechs]       = useState<CamTech[]>([]);
  const [delegates, setDelegates]     = useState<Delegate[]>([]);
  const [allStaff, setAllStaff]       = useState<Reporter[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // Assignment form
  const [showForm, setShowForm]       = useState(false);
  const [fReporter, setFReporter]     = useState("");
  const [fDriver, setFDriver]         = useState("");
  const [fCamTech, setFCamTech]       = useState("");
  const [fDest, setFDest]             = useState("");
  const [fGps, setFGps]               = useState("");
  const [fCallTime, setFCallTime]     = useState("");
  const [fDeptTime, setFDeptTime]     = useState("");
  const [fDate, setFDate]             = useState(new Date().toISOString().slice(0, 10));
  const [fUrgent, setFUrgent]         = useState(false);
  const [fLiveU, setFLiveU]           = useState(false);
  const [fNotes, setFNotes]           = useState("");
  const [saving, setSaving]           = useState(false);

  // Delegate form
  const [showDelegForm, setShowDelegForm] = useState(false);
  const [delegUserId, setDelegUserId]     = useState("");
  const [addingDeleg, setAddingDeleg]     = useState(false);

  const [actingId, setActingId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const asgPg = usePagination(assignments);
  const teamPg = usePagination([...reporters, ...camTechs.map(c => ({ user_id: c.user_id, full_name: c.full_name, position_title: `Camera · ${c.unit_name}` }))]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load today's assignments for this unit
      const { data: asgData } = await supabase.from("news_assignments")
        .select("id,destination,gps_address,call_time,departure_time,assignment_date,is_urgent,is_live_u,notes,status,reporter_id,driver_id,camera_tech_id")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false })
        .limit(200);

      const asgList = (asgData as any[]) || [];
      const repIds  = [...new Set(asgList.map(a => a.reporter_id).filter(Boolean))];
      const drvIds  = [...new Set(asgList.map(a => a.driver_id).filter(Boolean))];
      const camIds  = [...new Set(asgList.map(a => a.camera_tech_id).filter(Boolean))];

      const [{ data: repP }, { data: drvD }, { data: camP }] = await Promise.all([
        repIds.length ? supabase.from("profiles").select("user_id,full_name").in("user_id", repIds) : Promise.resolve({ data: [] }),
        drvIds.length ? supabase.from("drivers").select("id,full_name,phone").in("id", drvIds) : Promise.resolve({ data: [] }),
        camIds.length ? supabase.from("profiles").select("user_id,full_name").in("user_id", camIds) : Promise.resolve({ data: [] }),
      ]);
      const repMap = Object.fromEntries(((repP as any[]) || []).map(p => [p.user_id, p.full_name]));
      const drvMap = Object.fromEntries(((drvD as any[]) || []).map(d => [d.id, d]));
      const camMap = Object.fromEntries(((camP as any[]) || []).map(p => [p.user_id, p.full_name]));

      setAssignments(asgList.map(a => ({
        ...a,
        reporter_name:    a.reporter_id    ? repMap[a.reporter_id]    ?? "Unknown" : null,
        driver_name:      a.driver_id      ? drvMap[a.driver_id]?.full_name ?? "Unknown" : null,
        driver_phone:     a.driver_id      ? drvMap[a.driver_id]?.phone ?? null : null,
        camera_tech_name: a.camera_tech_id ? camMap[a.camera_tech_id] ?? "Unknown" : null,
      })));

      // Reporters = all staff in this unit
      const { data: staffData } = await supabase.from("profiles")
        .select("user_id,full_name,position_title")
        .eq("unit_id", unitId).eq("status", "active").order("full_name");
      setReporters((staffData as Reporter[]) || []);
      setAllStaff((staffData as Reporter[]) || []);

      // Drivers on morning shift today
      const { data: shiftData } = await supabase.from("shift_schedules")
        .select("driver_id").eq("shift_date", today).eq("shift_code", "morning");
      const onDutyIds = ((shiftData as any[]) || []).map(s => s.driver_id);

      const { data: drvAll } = onDutyIds.length
        ? await supabase.from("drivers").select("id,full_name,license_number,phone,route_id").in("id", onDutyIds).eq("employment_status","active")
        : { data: [] };

      const routeIds = [...new Set(((drvAll as any[]) || []).map(d => d.route_id).filter(Boolean))];
      const { data: routeData } = routeIds.length
        ? await supabase.from("evening_routes").select("id,name").in("id", routeIds)
        : { data: [] };
      const routeMap = Object.fromEntries(((routeData as any[]) || []).map(r => [r.id, r.name]));

      setDrivers(((drvAll as any[]) || []).map(d => ({
        id: d.id, full_name: d.full_name, license_number: d.license_number,
        phone: d.phone, route_name: d.route_id ? routeMap[d.route_id] ?? null : null,
        shift: "morning",
      })));

      // Camera techs deployed to this unit
      const { data: camDeps } = await supabase.from("camera_deployments")
        .select("technician_id,shift_type,sub_shift,unit_id")
        .eq("unit_id", unitId).eq("status", "active")
        .lte("deployment_date", today);

      const camTechIds = ((camDeps as any[]) || []).map(c => c.technician_id);
      const { data: camProfiles } = camTechIds.length
        ? await supabase.from("profiles").select("user_id,full_name").in("user_id", camTechIds)
        : { data: [] };
      const camPMap = Object.fromEntries(((camProfiles as any[]) || []).map(p => [p.user_id, p.full_name]));

      setCamTechs(((camDeps as any[]) || []).map(c => ({
        user_id:    c.technician_id,
        full_name:  camPMap[c.technician_id] ?? "Unknown",
        unit_name:  unitName,
        shift_type: c.shift_type,
        sub_shift:  c.sub_shift,
      })));

      // Delegates
      const { data: delegData } = await supabase.from("news_delegates")
        .select("id,user_id").eq("unit_id", unitId);
      const delegIds = ((delegData as any[]) || []).map(d => d.user_id);
      const { data: delegP } = delegIds.length
        ? await supabase.from("profiles").select("user_id,full_name").in("user_id", delegIds)
        : { data: [] };
      const delegPMap = Object.fromEntries(((delegP as any[]) || []).map(p => [p.user_id, p.full_name]));
      setDelegates(((delegData as any[]) || []).map(d => ({ ...d, full_name: delegPMap[d.user_id] ?? "Unknown" })));
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => { load(); }, [load]);

  const createAssignment = async () => {
    if (!fReporter) { setError("Reporter is required."); return; }
    if (!fDest.trim()) { setError("Destination is required."); return; }
    setSaving(true); setError(null);
    try {
      const { error: e } = await supabase.rpc("create_news_assignment", {
        p_unit_id:        unitId,
        p_reporter_id:    fReporter,
        p_driver_id:      fDriver  || null,
        p_camera_tech_id: fCamTech || null,
        p_destination:    fDest.trim(),
        p_gps_address:    fGps.trim()      || null,
        p_call_time:      fCallTime        || null,
        p_departure_time: fDeptTime        || null,
        p_assignment_date: fDate,
        p_is_urgent:      fUrgent,
        p_is_live_u:      fLiveU,
        p_notes:          fNotes.trim()    || null,
      });
      if (e) throw e;
      setShowForm(false);
      // Reset form
      setFReporter(""); setFDriver(""); setFCamTech(""); setFDest(""); setFGps("");
      setFCallTime(""); setFDeptTime(""); setFUrgent(false); setFLiveU(false); setFNotes("");
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    setActingId(id);
    await supabase.rpc("update_news_assignment_status", { p_assignment_id: id, p_status: status });
    await load();
    setActingId(null);
  };

  const addDelegate = async () => {
    if (!delegUserId) return;
    setAddingDeleg(true);
    const { error: e } = await supabase.from("news_delegates")
      .insert({ unit_id: unitId, user_id: delegUserId, delegated_by: user?.id });
    if (e) setError(e.message);
    else { setShowDelegForm(false); setDelegUserId(""); await load(); }
    setAddingDeleg(false);
  };

  const removeDelegate = async (id: string) => {
    await supabase.from("news_delegates").delete().eq("id", id);
    await load();
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: "assignments", label: "Assignments" },
    { value: "team",        label: "Available Team" },
    { value: "delegates",   label: "Delegates" },
  ];
  const counts = {
    assignments: assignments.filter(a => a.status === "active").length,
    delegates:   delegates.length,
  };

  const activeAsg  = assignments.filter(a => a.status === "active");
  const pastAsg    = assignments.filter(a => a.status !== "active");
  const activeAsgPg = usePagination(activeAsg);
  const pastAsgPg   = usePagination(pastAsg);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">{unitName}</h1>
          <p className="page-sub">Assignment Editor · {reporters.length} reporters · {camTechs.length} camera techs · {drivers.length} drivers on duty</p>
        </div>
        <Btn variant="primary" onClick={() => setShowForm(true)}>+ New Assignment</Btn>
      </div>

      {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {/* Stats — fluid font size scales with container */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Assignments", value: activeAsg.length, color: "var(--green)" },
          { label: "On-Duty Drivers",    value: drivers.length,   color: "var(--accent)" },
          { label: "Camera Techs Here",  value: camTechs.length,  color: "var(--amber)" },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ textAlign: "center", overflow: "hidden" }}>
            <div style={{
              fontSize: "clamp(22px, 5vw, 40px)", fontWeight: 700,
              color: s.color, lineHeight: 1, fontFamily: "'IBM Plex Mono', monospace",
            }}>{s.value}</div>
            <div className="stat-label" style={{ marginTop: 4, fontSize: "clamp(9px, 1.5vw, 11px)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} counts={counts} />

      {/* ─── ASSIGNMENTS TAB ─── */}
      {tab === "assignments" && (
        <div className="space-y-4">
          {/* Active */}
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Active Assignments ({activeAsg.length})
          </p>
          {activeAsg.length === 0 ? (
            <EmptyState title="No active assignments" subtitle="Create an assignment to get started" />
          ) : (
            <div className="space-y-3">
              {activeAsgPg.slice.map(a => (
                <Card key={a.id}>
                  {/* Header bar */}
                  <div className="px-4 py-3 border-b flex items-start justify-between gap-2"
                    style={{ borderColor: "var(--border)", background: a.is_urgent ? "var(--red-dim)" : "var(--surface-2)" }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.is_urgent && <span className="badge badge-rejected">🚨 URGENT</span>}
                        {a.is_live_u && <span className="badge badge-dispatched">📡 Live U</span>}
                        <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{a.destination}</p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {fmtDate(a.assignment_date)}
                        {a.call_time      && ` · Call: ${fmtTime(a.call_time)}`}
                        {a.departure_time && ` · Depart: ${fmtTime(a.departure_time)}`}
                      </p>
                    </div>
                    <Badge status={a.status} />
                  </div>

                  {/* Team row */}
                  <div className="px-4 py-3 grid grid-cols-3 gap-3 border-b" style={{ borderColor: "var(--border)" }}>
                    {[
                      { icon: "🎤", label: "Reporter", name: a.reporter_name, sub: null },
                      { icon: "📷", label: "Camera",   name: a.camera_tech_name, sub: null },
                      { icon: "🚗", label: "Driver",   name: a.driver_name, sub: a.driver_phone },
                    ].map(m => (
                      <div key={m.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 18 }}>{m.icon}</div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", marginTop: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 1 }}>{m.name ?? "—"}</div>
                        {m.sub && <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "monospace" }}>{m.sub}</div>}
                      </div>
                    ))}
                  </div>

                  {/* GPS + Notes */}
                  {(a.gps_address || a.notes) && (
                    <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                      {a.gps_address && (
                        <a href={a.gps_address} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}>
                          📍 <span className="underline truncate">{a.gps_address}</span>
                        </a>
                      )}
                      {a.notes && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{a.notes}</p>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-4 py-3 flex gap-2">
                    <Btn size="sm" variant="success" loading={actingId === a.id}
                      onClick={() => updateStatus(a.id, "completed")}>Mark Complete</Btn>
                    <Btn size="sm" variant="danger" loading={actingId === a.id}
                      onClick={() => updateStatus(a.id, "cancelled")}>Cancel</Btn>
                  </div>
                </Card>
              ))}
              <PaginationBar {...activeAsgPg} />
            </div>
          )}

          {/* Past */}
          {pastAsg.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide mt-4" style={{ color: "var(--text-muted)" }}>
                Past Assignments ({pastAsg.length})
              </p>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="tms-table">
                    <thead><tr><th>Destination</th><th>Date</th><th>Reporter</th><th>Driver</th><th>Camera</th><th>Status</th></tr></thead>
                    <tbody>
                      {pastAsgPg.slice.map(a => (
                        <tr key={a.id}>
                          <td className="font-medium max-w-[160px] truncate">{a.destination}</td>
                          <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(a.assignment_date)}</td>
                          <td style={{ fontSize: 12 }}>{a.reporter_name ?? "—"}</td>
                          <td style={{ fontSize: 12 }}>{a.driver_name ?? "—"}</td>
                          <td style={{ fontSize: 12 }}>{a.camera_tech_name ?? "—"}</td>
                          <td><Badge status={a.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationBar {...pastAsgPg} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TEAM TAB ─── */}
      {tab === "team" && (
        <div className="space-y-4">
          {/* Reporters */}
          <Card>
            <CardHeader title={`🎤 Reporters / Staff (${reporters.length})`} subtitle="Members of your unit" />
            {reporters.length === 0 ? (
              <CardBody><EmptyState title="No staff found" /></CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead><tr><th>Name</th><th>Position</th><th>Assignments Today</th></tr></thead>
                  <tbody>
                    {reporters.map(r => {
                      const todayCount = activeAsg.filter(a => a.reporter_id === r.user_id && a.assignment_date === today).length;
                      return (
                        <tr key={r.user_id}>
                          <td className="font-medium">{r.full_name}</td>
                          <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.position_title ?? "—"}</td>
                          <td>
                            {todayCount > 0
                              ? <span className="badge badge-dispatched">{todayCount} active</span>
                              : <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Free</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Camera Techs */}
          <Card>
            <CardHeader title={`📷 Camera Technicians (${camTechs.length})`} subtitle="Deployed to your unit today" />
            {camTechs.length === 0 ? (
              <CardBody>
                <EmptyState title="No camera technicians deployed" subtitle="Camera dept will assign technicians here" />
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead><tr><th>Name</th><th>Shift</th><th>Assignments Today</th></tr></thead>
                  <tbody>
                    {camTechs.map(c => {
                      const todayCount = activeAsg.filter(a => a.camera_tech_id === c.user_id && a.assignment_date === today).length;
                      const shiftLabel = c.sub_shift === "dawn" ? "5am–2pm" : c.sub_shift === "afternoon" ? "2pm–end" : "8am–5pm";
                      return (
                        <tr key={c.user_id}>
                          <td className="font-medium">{c.full_name}</td>
                          <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{shiftLabel}</td>
                          <td>
                            {todayCount > 0
                              ? <span className="badge badge-dispatched">{todayCount} active</span>
                              : <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Free</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Drivers */}
          <Card>
            <CardHeader title={`🚗 Drivers on Morning Duty (${drivers.length})`} subtitle="Scheduled for morning shift today" />
            {drivers.length === 0 ? (
              <CardBody><EmptyState title="No drivers on morning duty today" /></CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead><tr><th>Driver</th><th>Phone</th><th>Route</th><th>Assignments Today</th></tr></thead>
                  <tbody>
                    {drivers.map(d => {
                      const todayCount = activeAsg.filter(a => a.driver_id === d.id && a.assignment_date === today).length;
                      return (
                        <tr key={d.id}>
                          <td className="font-medium">{d.full_name ?? d.license_number}</td>
                          <td style={{ fontSize: 12, fontFamily: "monospace", color: "var(--accent)" }}>{d.phone ?? "—"}</td>
                          <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.route_name ?? "—"}</td>
                          <td>
                            {todayCount > 0
                              ? <span className="badge badge-dispatched">{todayCount} active</span>
                              : <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Free</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── DELEGATES TAB ─── */}
      {tab === "delegates" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Btn size="sm" variant="primary" onClick={() => setShowDelegForm(true)}>+ Add Delegate</Btn>
          </div>
          {delegates.length === 0 ? (
            <EmptyState title="No delegates" subtitle="Delegates can create assignments on your behalf" />
          ) : delegates.map(d => (
            <Card key={d.id}>
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{d.full_name}</p>
                <Btn size="sm" variant="danger" onClick={() => removeDelegate(d.id)}>Remove</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ─── NEW ASSIGNMENT MODAL ─── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Assignment" maxWidth="max-w-lg">
        <div className="space-y-4">
          {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Reporter" required>
              <Select value={fReporter} onChange={e => setFReporter(e.target.value)}>
                <option value="">Select reporter…</option>
                {reporters.map(r => <option key={r.user_id} value={r.user_id}>{r.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Driver">
              <Select value={fDriver} onChange={e => setFDriver(e.target.value)}>
                <option value="">— No driver —</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.full_name ?? d.license_number}{d.phone ? ` · ${d.phone}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Camera Technician">
              <Select value={fCamTech} onChange={e => setFCamTech(e.target.value)}>
                <option value="">— No camera tech —</option>
                {camTechs.map(c => <option key={c.user_id} value={c.user_id}>{c.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Assignment Date" required>
              <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
            </Field>
          </div>

          <Field label="Destination" required>
            <Input placeholder="e.g. Parliament House, Accra" value={fDest} onChange={e => setFDest(e.target.value)} />
          </Field>

          <Field label="GPS Address / Map Link">
            <Input placeholder="https://maps.google.com/... or GPS coords" value={fGps} onChange={e => setFGps(e.target.value)} />
            <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Team members can tap this to navigate directly</p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Call Time">
              <Input type="time" value={fCallTime} onChange={e => setFCallTime(e.target.value)} />
            </Field>
            <Field label="Departure Time">
              <Input type="time" value={fDeptTime} onChange={e => setFDeptTime(e.target.value)} />
            </Field>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-4">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={fUrgent} onChange={e => setFUrgent(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--red)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: fUrgent ? "var(--red)" : "var(--text-muted)" }}>
                🚨 Urgent
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={fLiveU} onChange={e => setFLiveU(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: fLiveU ? "var(--accent)" : "var(--text-muted)" }}>
                📡 Live U
              </span>
            </label>
          </div>

          <Field label="Additional Notes">
            <Textarea rows={2} placeholder="Any additional instructions…" value={fNotes} onChange={e => setFNotes(e.target.value)} />
          </Field>

          <div className="flex justify-end gap-3 pt-1">
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={createAssignment}>Create Assignment</Btn>
          </div>
        </div>
      </Modal>

      {/* ─── ADD DELEGATE MODAL ─── */}
      <Modal open={showDelegForm} onClose={() => setShowDelegForm(false)} title="Add Delegate" maxWidth="max-w-sm">
        <div className="space-y-4">
          <Field label="Staff Member" required>
            <Select value={delegUserId} onChange={e => setDelegUserId(e.target.value)}>
              <option value="">Select…</option>
              {allStaff.map(s => <option key={s.user_id} value={s.user_id}>{s.full_name}</option>)}
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