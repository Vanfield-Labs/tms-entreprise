// src/modules/news/pages/NewsUnitDashboard.tsx
// Shared dashboard for Joy News, Adom TV, Joy Business.
// Drivers shown in Team tab: only those assigned to this unit today.
// Drivers shown in New Assignment form: only those on duty for the chosen date and assigned to this unit.
// Camera techs shown: only those deployed to this unit via camera_deployments.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  PageSpinner,
  EmptyState,
  Badge,
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Select,
  Textarea,
  Btn,
  Modal,
  TabBar,
} from "@/components/TmsUI";
import { useToast } from "@/components/ErrorToast";
import { usePagination, PaginationBar } from "@/hooks/usePagination";
import { fmtDate } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type Reporter = {
  user_id: string;
  full_name: string;
  position_title: string | null;
};

type Driver = {
  id: string;
  full_name: string | null;
  license_number: string;
  phone: string | null;
};

type CamTech = {
  user_id: string;
  full_name: string;
  shift_type: string;
  sub_shift: string | null;
};

type Delegate = {
  id: string;
  user_id: string;
  full_name: string;
};

type Assignment = {
  id: string;
  destination: string;
  gps_address: string | null;
  call_time: string | null;
  departure_time: string | null;
  assignment_date: string;
  is_urgent: boolean;
  is_live_u: boolean;
  notes: string | null;
  status: string;
  reporter_id: string | null;
  reporter_name: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  camera_tech_id: string | null;
  camera_tech_name: string | null;
};

type Tab = "assignments" | "team" | "delegates";

function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : "—";
}

async function getDriverRecordsByIds(driverIds: string[]): Promise<Driver[]> {
  if (!driverIds.length) return [];
  const { data, error } = await supabase
    .from("drivers")
    .select("id,full_name,license_number,phone")
    .in("id", driverIds)
    .eq("employment_status", "active");

  if (error) {
    console.error("Failed to load drivers:", error.message);
    return [];
  }

  return (data as Driver[]) || [];
}

async function getUnitDriversForDate(date: string, unitName: string): Promise<Driver[]> {
  const { data: deptAssigns, error: deptErr } = await supabase
    .from("driver_department_assignments")
    .select("driver_id")
    .eq("shift_date", date)
    .eq("department_name", unitName);

  if (deptErr) {
    console.error("Failed to load driver department assignments:", deptErr.message);
  }

  const unitDriverIds = [...new Set(((deptAssigns as any[]) || []).map((d) => d.driver_id).filter(Boolean))] as string[];

  if (unitDriverIds.length > 0) {
    return getDriverRecordsByIds(unitDriverIds);
  }

  const { data: shiftData, error: shiftErr } = await supabase
    .from("shift_schedules")
    .select("driver_id,shift_code,status")
    .eq("schedule_date", date)
    .in("status", ["assigned", "published"])
    .in("shift_code", ["morning", "evening", "night", "on_duty"]);

  if (shiftErr) {
    console.error("Failed to load shift schedules:", shiftErr.message);
    return [];
  }

  const onDutyIds = [...new Set(((shiftData as any[]) || []).map((s) => s.driver_id).filter(Boolean))] as string[];
  if (!onDutyIds.length) return [];

  return getDriverRecordsByIds(onDutyIds);
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NewsUnitDashboard({
  unitId,
  unitName,
}: {
  unitId: string;
  unitName: string;
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("assignments");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [formDrivers, setFormDrivers] = useState<Driver[]>([]);
  const [camTechs, setCamTechs] = useState<CamTech[]>([]);
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [allStaff, setAllStaff] = useState<Reporter[]>([]);
  const [loading, setLoading] = useState(true);

  // New assignment form
  const [showForm, setShowForm] = useState(false);
  const [fReporter, setFReporter] = useState("");
  const [fDriver, setFDriver] = useState("");
  const [fCamTech, setFCamTech] = useState("");
  const [fDest, setFDest] = useState("");
  const [fGps, setFGps] = useState("");
  const [fCallTime, setFCallTime] = useState("");
  const [fDeptTime, setFDeptTime] = useState("");
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fUrgent, setFUrgent] = useState(false);
  const [fLiveU, setFLiveU] = useState(false);
  const [fNotes, setFNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Amend assignment form
  const [amendTarget, setAmendTarget] = useState<Assignment | null>(null);
  const [aReporter, setAReporter] = useState("");
  const [aDriver, setADriver] = useState("");
  const [aCamTech, setACamTech] = useState("");
  const [aDest, setADest] = useState("");
  const [aGps, setAGps] = useState("");
  const [aCallTime, setACallTime] = useState("");
  const [aDeptTime, setADeptTime] = useState("");
  const [aUrgent, setAUrgent] = useState(false);
  const [aLiveU, setALiveU] = useState(false);
  const [aNotes, setANotes] = useState("");
  const [amending, setAmending] = useState(false);

  // Delegate form
  const [showDelegForm, setShowDelegForm] = useState(false);
  const [delegUserId, setDelegUserId] = useState("");
  const [addingDeleg, setAddingDeleg] = useState(false);

  const [actingId, setActingId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const activeAsg = useMemo(
    () => assignments.filter((a) => a.status === "active"),
    [assignments]
  );
  const pastAsg = useMemo(
    () => assignments.filter((a) => a.status !== "active"),
    [assignments]
  );

  const activeAsgPg = usePagination(activeAsg);
  const pastAsgPg = usePagination(pastAsg);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Assignments for this unit
      const { data: asgData, error: asgErr } = await supabase
        .from("news_assignments")
        .select(
          "id,destination,gps_address,call_time,departure_time,assignment_date,is_urgent,is_live_u,notes,status,reporter_id,driver_id,camera_tech_id"
        )
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (asgErr) throw asgErr;

      const asgList = (asgData as any[]) || [];
      const repIds = [...new Set(asgList.map((a) => a.reporter_id).filter(Boolean))];
      const drvIds = [...new Set(asgList.map((a) => a.driver_id).filter(Boolean))];
      const camIds = [...new Set(asgList.map((a) => a.camera_tech_id).filter(Boolean))];

      const [{ data: repP }, { data: drvD }, { data: camP }] = await Promise.all([
        repIds.length
          ? supabase.from("profiles").select("user_id,full_name").in("user_id", repIds)
          : Promise.resolve({ data: [] as any[] }),
        drvIds.length
          ? supabase.from("drivers").select("id,full_name,phone").in("id", drvIds)
          : Promise.resolve({ data: [] as any[] }),
        camIds.length
          ? supabase.from("profiles").select("user_id,full_name").in("user_id", camIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const repMap = Object.fromEntries(((repP as any[]) || []).map((p) => [p.user_id, p.full_name]));
      const drvMap = Object.fromEntries(((drvD as any[]) || []).map((d) => [d.id, d]));
      const camMap = Object.fromEntries(((camP as any[]) || []).map((p) => [p.user_id, p.full_name]));

      setAssignments(
        asgList.map((a) => ({
          ...a,
          reporter_name: a.reporter_id ? repMap[a.reporter_id] ?? "Unknown" : null,
          driver_name: a.driver_id ? (drvMap[a.driver_id] as any)?.full_name ?? "Unknown" : null,
          driver_phone: a.driver_id ? (drvMap[a.driver_id] as any)?.phone ?? null : null,
          camera_tech_name: a.camera_tech_id ? camMap[a.camera_tech_id] ?? "Unknown" : null,
        }))
      );

      // Reporters = staff in this unit
      const { data: staffData, error: staffErr } = await supabase
        .from("profiles")
        .select("user_id,full_name,position_title")
        .eq("unit_id", unitId)
        .eq("status", "active")
        .order("full_name");

      if (staffErr) throw staffErr;

      setReporters((staffData as Reporter[]) || []);
      setAllStaff((staffData as Reporter[]) || []);

      // Drivers assigned to this unit today (for Team tab + stats)
      const todayDrivers = await getUnitDriversForDate(today, unitName);
      setDrivers(todayDrivers);

      // Camera techs deployed to this unit today
      const { data: camDeps, error: camDepErr } = await supabase
        .from("camera_deployments")
        .select("technician_id,shift_type,sub_shift")
        .eq("unit_id", unitId)
        .eq("status", "active")
        .lte("deployment_date", today);

      if (camDepErr) throw camDepErr;

      const camTechIds = ((camDeps as any[]) || []).map((c) => c.technician_id);
      const { data: camProfiles } = camTechIds.length
        ? await supabase.from("profiles").select("user_id,full_name").in("user_id", camTechIds)
        : { data: [] as any[] };

      const camPMap = Object.fromEntries(((camProfiles as any[]) || []).map((p) => [p.user_id, p.full_name]));
      setCamTechs(
        ((camDeps as any[]) || []).map((c) => ({
          user_id: c.technician_id,
          full_name: camPMap[c.technician_id] ?? "Unknown",
          shift_type: c.shift_type,
          sub_shift: c.sub_shift,
        }))
      );

      // Delegates
      const { data: delegData, error: delegErr } = await supabase
        .from("news_delegates")
        .select("id,user_id")
        .eq("unit_id", unitId);

      if (delegErr) throw delegErr;

      const delegIds = ((delegData as any[]) || []).map((d) => d.user_id);
      const { data: delegP } = delegIds.length
        ? await supabase.from("profiles").select("user_id,full_name").in("user_id", delegIds)
        : { data: [] as any[] };

      const delegPMap = Object.fromEntries(((delegP as any[]) || []).map((p) => [p.user_id, p.full_name]));
      setDelegates(
        ((delegData as any[]) || []).map((d) => ({
          ...d,
          full_name: delegPMap[d.user_id] ?? "Unknown",
        }))
      );
    } catch (e: any) {
      console.error("NewsUnitDashboard load failed:", e?.message ?? e);
      toast.error("Load Failed", e?.message ?? "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [today, toast, unitId, unitName]);

  useEffect(() => {
    void load();
  }, [load]);

  // Drivers for the chosen assignment date
  useEffect(() => {
    let dead = false;

    (async () => {
      const nextDrivers = await getUnitDriversForDate(fDate, unitName);
      if (!dead) {
        setFormDrivers(nextDrivers);

        if (fDriver && !nextDrivers.some((d) => d.id === fDriver)) {
          setFDriver("");
        }
      }
    })();

    return () => {
      dead = true;
    };
  }, [fDate, fDriver, unitName]);

  // Step 9 — notification focus to exact assignment card
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ entityId?: string }>).detail;
      const id = detail?.entityId;
      if (!id) return;

      setTab("assignments");

      window.setTimeout(() => {
        const el = document.getElementById(`row-${id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    };

    window.addEventListener("tms:focus-news-assignment", handler);
    return () => window.removeEventListener("tms:focus-news-assignment", handler);
  }, []);

  // Create assignment
  const createAssignment = async () => {
    if (!fReporter) {
      toast.error("Validation Error", "Reporter is required.");
      return;
    }
    if (!fDest.trim()) {
      toast.error("Validation Error", "Destination is required.");
      return;
    }

    setSaving(true);
    try {
      const { error: e } = await supabase.rpc("create_news_assignment", {
        p_unit_id: unitId,
        p_reporter_id: fReporter,
        p_driver_id: fDriver || null,
        p_camera_tech_id: fCamTech || null,
        p_destination: fDest.trim(),
        p_gps_address: fGps.trim() || null,
        p_call_time: fCallTime || null,
        p_departure_time: fDeptTime || null,
        p_assignment_date: fDate,
        p_is_urgent: fUrgent,
        p_is_live_u: fLiveU,
        p_notes: fNotes.trim() || null,
      });
      if (e) throw e;

      toast.success(
        "Assignment Created",
        fUrgent ? "🚨 Urgent assignment deployed." : "Team members have been notified."
      );

      setShowForm(false);
      setFReporter("");
      setFDriver("");
      setFCamTech("");
      setFDest("");
      setFGps("");
      setFCallTime("");
      setFDeptTime("");
      setFUrgent(false);
      setFLiveU(false);
      setFNotes("");

      await load();
    } catch (e: any) {
      toast.error("Create Failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  // Amend assignment
  const openAmend = (a: Assignment) => {
    setAmendTarget(a);
    setAReporter(a.reporter_id ?? "");
    setADriver(a.driver_id ?? "");
    setACamTech(a.camera_tech_id ?? "");
    setADest(a.destination);
    setAGps(a.gps_address ?? "");
    setACallTime(a.call_time ?? "");
    setADeptTime(a.departure_time ?? "");
    setAUrgent(a.is_urgent);
    setALiveU(a.is_live_u);
    setANotes(a.notes ?? "");
  };

  const amendAssignment = async () => {
    if (!amendTarget) return;
    if (!aDest.trim()) {
      toast.error("Validation Error", "Destination is required.");
      return;
    }

    setAmending(true);
    try {
      const { error: e } = await supabase.rpc("amend_news_assignment", {
        p_assignment_id: amendTarget.id,
        p_reporter_id: aReporter || null,
        p_driver_id: aDriver || null,
        p_camera_tech_id: aCamTech || null,
        p_destination: aDest.trim(),
        p_gps_address: aGps.trim() || null,
        p_call_time: aCallTime || null,
        p_departure_time: aDeptTime || null,
        p_is_urgent: aUrgent,
        p_is_live_u: aLiveU,
        p_notes: aNotes.trim() || null,
      });
      if (e) throw e;

      toast.success("Assignment Updated", "Team members have been notified of the change.");
      setAmendTarget(null);
      await load();
    } catch (e: any) {
      toast.error("Amend Failed", e.message);
    } finally {
      setAmending(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setActingId(id);
    try {
      const { error: e } = await supabase.rpc("update_news_assignment_status", {
        p_assignment_id: id,
        p_status: status,
      });
      if (e) throw e;

      toast.success(status === "completed" ? "Marked Complete" : "Assignment Cancelled");
      await load();
    } catch (e: any) {
      toast.error("Update Failed", e.message);
    } finally {
      setActingId(null);
    }
  };

  const addDelegate = async () => {
    if (!delegUserId) return;

    setAddingDeleg(true);
    try {
      const { error: e } = await supabase
        .from("news_delegates")
        .insert({ unit_id: unitId, user_id: delegUserId, delegated_by: user?.id });

      if (e) throw e;

      toast.success("Delegate Added");
      setShowDelegForm(false);
      setDelegUserId("");
      await load();
    } catch (e: any) {
      toast.error("Failed", e.message);
    } finally {
      setAddingDeleg(false);
    }
  };

  const removeDelegate = async (id: string) => {
    const { error: e } = await supabase.from("news_delegates").delete().eq("id", id);
    if (e) {
      toast.error("Failed to remove", e.message);
      return;
    }
    toast.success("Delegate Removed");
    await load();
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: "assignments", label: "Assignments" },
    { value: "team", label: "Available Team" },
    { value: "delegates", label: "Delegates" },
  ];

  const counts = { assignments: activeAsg.length, delegates: delegates.length };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">{unitName}</h1>
          <p className="page-sub">
            Assignment Editor · {reporters.length} reporters · {camTechs.length} camera techs ·{" "}
            {drivers.length} drivers on duty
          </p>
        </div>
        <Btn variant="primary" onClick={() => setShowForm(true)}>
          + New Assignment
        </Btn>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Assignments", value: activeAsg.length, color: "var(--green)" },
          { label: "On-Duty Drivers", value: drivers.length, color: "var(--accent)" },
          { label: "Camera Techs Here", value: camTechs.length, color: "var(--amber)" },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ textAlign: "center", overflow: "hidden" }}>
            <div
              style={{
                fontSize: "clamp(22px, 5vw, 40px)",
                fontWeight: 700,
                color: s.color,
                lineHeight: 1,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {s.value}
            </div>
            <div
              className="stat-label"
              style={{ marginTop: 4, fontSize: "clamp(9px, 1.5vw, 11px)" }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} counts={counts} />

      {/* ─── ASSIGNMENTS ─── */}
      {tab === "assignments" && (
        <div className="space-y-4">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Active Assignments ({activeAsg.length})
          </p>

          {activeAsg.length === 0 ? (
            <EmptyState title="No active assignments" subtitle="Create an assignment to get started" />
          ) : (
            <div className="space-y-3">
              {activeAsgPg.slice.map((a) => (
                <Card key={a.id}>
                  <div id={`row-${a.id}`}>
                    <div
                      className="px-4 py-3 border-b flex items-start justify-between gap-2"
                      style={{
                        borderColor: "var(--border)",
                        background: a.is_urgent ? "var(--red-dim)" : "var(--surface-2)",
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {a.is_urgent && <span className="badge badge-rejected">🚨 URGENT</span>}
                          {a.is_live_u && <span className="badge badge-dispatched">📡 Live U</span>}
                          <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                            {a.destination}
                          </p>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {fmtDate(a.assignment_date)}
                          {a.call_time && ` · Call: ${fmtTime(a.call_time)}`}
                          {a.departure_time && ` · Depart: ${fmtTime(a.departure_time)}`}
                        </p>
                      </div>
                      <Badge status={a.status} />
                    </div>

                    {/* Full team info */}
                    <div
                      className="px-4 py-3 grid grid-cols-3 gap-3 border-b"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {[
                        { icon: "🎤", label: "Reporter", name: a.reporter_name, sub: null },
                        { icon: "📷", label: "Camera", name: a.camera_tech_name, sub: null },
                        { icon: "🚗", label: "Driver", name: a.driver_name, sub: a.driver_phone },
                      ].map((m) => (
                        <div key={m.label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 18 }}>{m.icon}</div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--text-dim)",
                              textTransform: "uppercase",
                              marginTop: 2,
                            }}
                          >
                            {m.label}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text)",
                              marginTop: 1,
                            }}
                          >
                            {m.name ?? "—"}
                          </div>
                          {m.sub && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--accent)",
                                fontFamily: "monospace",
                              }}
                            >
                              {m.sub}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {(a.gps_address || a.notes) && (
                      <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                        {a.gps_address && (
                          <a
                            href={a.gps_address}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 12,
                              color: "var(--accent)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            📍 <span className="underline truncate">{a.gps_address}</span>
                          </a>
                        )}
                        {a.notes && (
                          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                            {a.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="px-4 py-3 flex gap-2 flex-wrap">
                      <Btn size="sm" variant="ghost" onClick={() => openAmend(a)}>
                        ✏️ Amend
                      </Btn>
                      <Btn
                        size="sm"
                        variant="success"
                        loading={actingId === a.id}
                        onClick={() => updateStatus(a.id, "completed")}
                      >
                        ✓ Complete
                      </Btn>
                      <Btn
                        size="sm"
                        variant="danger"
                        loading={actingId === a.id}
                        onClick={() => updateStatus(a.id, "cancelled")}
                      >
                        Cancel
                      </Btn>
                    </div>
                  </div>
                </Card>
              ))}
              <PaginationBar {...activeAsgPg} />
            </div>
          )}

          {/* Past */}
          {pastAsg.length > 0 && (
            <>
              <p
                className="text-xs font-semibold uppercase tracking-wide mt-4"
                style={{ color: "var(--text-muted)" }}
              >
                Past Assignments ({pastAsg.length})
              </p>

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="tms-table">
                    <thead>
                      <tr>
                        <th>Destination</th>
                        <th>Date</th>
                        <th>Reporter</th>
                        <th>Driver</th>
                        <th>Camera</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastAsgPg.slice.map((a) => (
                        <tr key={a.id}>
                          <td className="font-medium max-w-[160px] truncate">{a.destination}</td>
                          <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                            {fmtDate(a.assignment_date)}
                          </td>
                          <td style={{ fontSize: 12 }}>{a.reporter_name ?? "—"}</td>
                          <td style={{ fontSize: 12 }}>{a.driver_name ?? "—"}</td>
                          <td style={{ fontSize: 12 }}>{a.camera_tech_name ?? "—"}</td>
                          <td>
                            <Badge status={a.status} />
                          </td>
                          <td>
                            <Btn size="sm" variant="ghost" onClick={() => openAmend(a)}>
                              Amend
                            </Btn>
                          </td>
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

      {/* ─── TEAM ─── */}
      {tab === "team" && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={`🎤 Reporters / Staff (${reporters.length})`}
              subtitle="Members of your unit"
            />
            {reporters.length === 0 ? (
              <CardBody>
                <EmptyState title="No staff found" />
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Position</th>
                      <th>Assignments Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporters.map((r) => {
                      const cnt = activeAsg.filter(
                        (a) => a.reporter_id === r.user_id && a.assignment_date === today
                      ).length;

                      return (
                        <tr key={r.user_id}>
                          <td className="font-medium">{r.full_name}</td>
                          <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {r.position_title ?? "—"}
                          </td>
                          <td>
                            {cnt > 0 ? (
                              <span className="badge badge-dispatched">{cnt} active</span>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Free</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title={`📷 Camera Technicians (${camTechs.length})`}
              subtitle="Deployed to your unit today"
            />
            {camTechs.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="No camera technicians deployed"
                  subtitle="Camera dept will assign technicians here"
                />
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Shift</th>
                      <th>Assignments Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {camTechs.map((c) => {
                      const cnt = activeAsg.filter(
                        (a) => a.camera_tech_id === c.user_id && a.assignment_date === today
                      ).length;

                      const sl =
                        c.sub_shift === "dawn"
                          ? "5am–2pm"
                          : c.sub_shift === "afternoon"
                          ? "2pm–end"
                          : "8am–5pm";

                      return (
                        <tr key={c.user_id}>
                          <td className="font-medium">{c.full_name}</td>
                          <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{sl}</td>
                          <td>
                            {cnt > 0 ? (
                              <span className="badge badge-dispatched">{cnt} active</span>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Free</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title={`🚗 Drivers on Duty (${drivers.length})`}
              subtitle={`Assigned to ${unitName} today`}
            />
            {drivers.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="No drivers assigned to this unit today"
                  subtitle="Driver assignment comes from the shift schedule calendar"
                />
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Phone</th>
                      <th>Assignments Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => {
                      const cnt = activeAsg.filter(
                        (a) => a.driver_id === d.id && a.assignment_date === today
                      ).length;

                      return (
                        <tr key={d.id}>
                          <td className="font-medium">{d.full_name ?? d.license_number}</td>
                          <td
                            style={{
                              fontSize: 12,
                              fontFamily: "monospace",
                              color: "var(--accent)",
                            }}
                          >
                            {d.phone ?? "—"}
                          </td>
                          <td>
                            {cnt > 0 ? (
                              <span className="badge badge-dispatched">{cnt} active</span>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Free</span>
                            )}
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

      {/* ─── DELEGATES ─── */}
      {tab === "delegates" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Btn size="sm" variant="primary" onClick={() => setShowDelegForm(true)}>
              + Add Delegate
            </Btn>
          </div>

          {delegates.length === 0 ? (
            <EmptyState
              title="No delegates"
              subtitle="Delegates can create assignments on your behalf"
            />
          ) : (
            delegates.map((d) => (
              <Card key={d.id}>
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <p className="font-medium text-sm" style={{ color: "var(--text)" }}>
                    {d.full_name}
                  </p>
                  <Btn size="sm" variant="danger" onClick={() => removeDelegate(d.id)}>
                    Remove
                  </Btn>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ─── NEW ASSIGNMENT MODAL ─── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Assignment"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Reporter" required>
              <Select value={fReporter} onChange={(e) => setFReporter(e.target.value)}>
                <option value="">Select reporter…</option>
                {reporters.map((r) => (
                  <option key={r.user_id} value={r.user_id}>
                    {r.full_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Driver">
              <Select value={fDriver} onChange={(e) => setFDriver(e.target.value)}>
                <option value="">— No driver —</option>
                {formDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name ?? d.license_number}
                    {d.phone ? ` · ${d.phone}` : ""}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-[color:var(--text-muted)] mt-1">
                Only drivers on duty for {fDate} are listed.
              </p>
            </Field>

            <Field label="Camera Technician">
              <Select value={fCamTech} onChange={(e) => setFCamTech(e.target.value)}>
                <option value="">— No camera tech —</option>
                {camTechs.map((c) => (
                  <option key={c.user_id} value={c.user_id}>
                    {c.full_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Date" required>
              <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </Field>
          </div>

          <Field label="Destination" required>
            <Input
              placeholder="e.g. Parliament House, Accra"
              value={fDest}
              onChange={(e) => setFDest(e.target.value)}
            />
          </Field>

          <Field label="GPS / Map Link">
            <Input
              placeholder="https://maps.google.com/..."
              value={fGps}
              onChange={(e) => setFGps(e.target.value)}
            />
            <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
              Team members can tap to navigate directly
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Call Time">
              <Input type="time" value={fCallTime} onChange={(e) => setFCallTime(e.target.value)} />
            </Field>
            <Field label="Departure Time">
              <Input type="time" value={fDeptTime} onChange={(e) => setFDeptTime(e.target.value)} />
            </Field>
          </div>

          <div className="flex gap-4">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={fUrgent}
                onChange={(e) => setFUrgent(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--red)" }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: fUrgent ? "var(--red)" : "var(--text-muted)",
                }}
              >
                🚨 Urgent
              </span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={fLiveU}
                onChange={(e) => setFLiveU(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: fLiveU ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                📡 Live U
              </span>
            </label>
          </div>

          <Field label="Notes">
            <Textarea rows={2} value={fNotes} onChange={(e) => setFNotes(e.target.value)} />
          </Field>

          <div className="flex justify-end gap-3 pt-1">
            <Btn variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Btn>
            <Btn variant="primary" loading={saving} onClick={createAssignment}>
              Create Assignment
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ─── AMEND ASSIGNMENT MODAL ─── */}
      <Modal
        open={!!amendTarget}
        onClose={() => setAmendTarget(null)}
        title="Amend Assignment"
        maxWidth="max-w-lg"
      >
        {amendTarget && (
          <div className="space-y-4">
            <div className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)" }}>
              <p style={{ color: "var(--text)", fontWeight: 600 }}>{amendTarget.destination}</p>
              <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {fmtDate(amendTarget.assignment_date)}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Reporter">
                <Select value={aReporter} onChange={(e) => setAReporter(e.target.value)}>
                  <option value="">— No change —</option>
                  {reporters.map((r) => (
                    <option key={r.user_id} value={r.user_id}>
                      {r.full_name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Driver">
                <Select value={aDriver} onChange={(e) => setADriver(e.target.value)}>
                  <option value="">— No change —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name ?? d.license_number}
                      {d.phone ? ` · ${d.phone}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Camera Technician">
                <Select value={aCamTech} onChange={(e) => setACamTech(e.target.value)}>
                  <option value="">— No change —</option>
                  {camTechs.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Destination" required>
              <Input value={aDest} onChange={(e) => setADest(e.target.value)} />
            </Field>

            <Field label="GPS / Map Link">
              <Input value={aGps} onChange={(e) => setAGps(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Call Time">
                <Input type="time" value={aCallTime} onChange={(e) => setACallTime(e.target.value)} />
              </Field>
              <Field label="Departure Time">
                <Input type="time" value={aDeptTime} onChange={(e) => setADeptTime(e.target.value)} />
              </Field>
            </div>

            <div className="flex gap-4">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={aUrgent}
                  onChange={(e) => setAUrgent(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--red)" }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: aUrgent ? "var(--red)" : "var(--text-muted)",
                  }}
                >
                  🚨 Urgent
                </span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={aLiveU}
                  onChange={(e) => setALiveU(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: aLiveU ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  📡 Live U
                </span>
              </label>
            </div>

            <Field label="Notes">
              <Textarea rows={2} value={aNotes} onChange={(e) => setANotes(e.target.value)} />
            </Field>

            <div className="flex justify-end gap-3">
              <Btn variant="ghost" onClick={() => setAmendTarget(null)}>
                Cancel
              </Btn>
              <Btn variant="primary" loading={amending} onClick={amendAssignment}>
                Save Changes
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── ADD DELEGATE MODAL ─── */}
      <Modal
        open={showDelegForm}
        onClose={() => setShowDelegForm(false)}
        title="Add Delegate"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <Field label="Staff Member" required>
            <Select value={delegUserId} onChange={(e) => setDelegUserId(e.target.value)}>
              <option value="">Select…</option>
              {allStaff.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={() => setShowDelegForm(false)}>
              Cancel
            </Btn>
            <Btn variant="primary" loading={addingDeleg} onClick={addDelegate}>
              Add Delegate
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}