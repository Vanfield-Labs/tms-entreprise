// src/modules/unithead/pages/UnitHeadDashboard.tsx
// Universal unit head dashboard — works for every unit head regardless of department.
// Shows:
//   - Unit bookings (today + pending)
//   - Staff list with today's dawn/evening pickup status
//   - Camera technicians deployed to this unit (if any)
//   - Evening route driver info
//   - Schedule dawn/evening pickups for staff
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  PageSpinner, EmptyState, Badge, Card, CardHeader, CardBody,
  Field, Input, Select, Textarea, Btn, Modal, Alert, TabBar,
} from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";
import { usePagination, PaginationBar } from "@/hooks/usePagination";

// ── Types ─────────────────────────────────────────────────────────────────────
type StaffMember = {
  user_id: string; full_name: string; position_title: string | null;
  // today pickup
  pickup_id: string | null; pickup_type: string | null;
  pickup_time: string | null; pickup_status: string | null;
  pickup_location: string | null; dropoff_location: string | null;
  driver_name: string | null; driver_phone: string | null; vehicle_plate: string | null;
};

type UnitBooking = {
  id: string; purpose: string; trip_date: string; trip_time: string;
  status: string; pickup_location: string; dropoff_location: string;
  requester_name: string;
  booking_status?: string | null;
};

type DeployedTech = {
  deployment_id: string; user_id: string; full_name: string;
  shift_type: string; sub_shift: string | null;
  deployment_date: string; end_date: string | null;
};

type Driver = { id: string; full_name: string | null; license_number: string; phone: string | null };
type Vehicle = { id: string; plate_number: string };

type Tab = "overview" | "schedule" | "bookings" | "camera";

const SHIFT_LABEL: Record<string, string> = {
  straight_day: "8am – 5pm", dawn: "5am – 2pm", afternoon: "2pm – end", production: "Production",
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UnitHeadDashboard() {
  const { profile, user } = useAuth();
  const unitId = profile?.unit_id;

  const [tab, setTab]               = useState<Tab>("overview");
  const [staff, setStaff]           = useState<StaffMember[]>([]);
  const [bookings, setBookings]     = useState<UnitBooking[]>([]);
  const [deployedTechs, setDeployedTechs] = useState<DeployedTech[]>([]);
  const [drivers, setDrivers]       = useState<Driver[]>([]);
  const [vehicles, setVehicles]     = useState<Vehicle[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [unitName, setUnitName]     = useState("");

  // Pickup schedule modal
  const [showSched, setShowSched]   = useState<StaffMember | null>(null);
  const [sDate, setSDate]           = useState(new Date().toISOString().slice(0, 10));
  const [sType, setSType]           = useState("dawn");
  const [sFrom, setSFrom]           = useState("");
  const [sTo, setSTo]               = useState("");
  const [sTime, setSTime]           = useState("");
  const [sDriverId, setSDriverId]   = useState("");
  const [sVehicleId, setSVehicleId] = useState("");
  const [sNotes, setSNotes]         = useState("");
  const [sSaving, setSSaving]       = useState(false);

  const staffPg = usePagination(staff);
  const bookingsPg = usePagination(bookings);

  const load = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    // Unit name
    const { data: unitData } = await supabase.from("units").select("name").eq("id", unitId).single();
    setUnitName((unitData as any)?.name ?? "");

    // Staff in this unit
    const { data: staffData } = await supabase.from("profiles")
      .select("user_id,full_name,position_title")
      .eq("unit_id", unitId).eq("status", "active").order("full_name");
    const staffList = (staffData as StaffMember[]) || [];

    // Today's pickup schedules for this unit's staff
    const staffIds = staffList.map(s => s.user_id);
    const { data: pickups } = staffIds.length
      ? await supabase.from("unit_pickup_schedule")
          .select("id,user_id,pickup_type,pickup_time,pickup_location,dropoff_location,status,driver_id,vehicle_id")
          .in("user_id", staffIds).eq("schedule_date", today)
      : { data: [] };

    // Resolve driver/vehicle names for pickups
    const driverIds  = [...new Set(((pickups as any[]) || []).map((p: any) => p.driver_id).filter(Boolean))];
    const vehicleIds = [...new Set(((pickups as any[]) || []).map((p: any) => p.vehicle_id).filter(Boolean))];
    const [{ data: drvData }, { data: vehData }] = await Promise.all([
      driverIds.length  ? supabase.from("drivers").select("id,full_name,phone").in("id", driverIds) : Promise.resolve({ data: [] }),
      vehicleIds.length ? supabase.from("vehicles").select("id,plate_number").in("id", vehicleIds)  : Promise.resolve({ data: [] }),
    ]);
    const drvMap = Object.fromEntries(((drvData as any[]) || []).map(d => [d.id, d]));
    const vehMap = Object.fromEntries(((vehData as any[]) || []).map(v => [v.id, v.plate_number]));

    const pickupMap: Record<string, any> = {};
    ((pickups as any[]) || []).forEach((p: any) => { pickupMap[p.user_id] = p; });

    setStaff(staffList.map(s => {
      const p = pickupMap[s.user_id];
      const drv = p?.driver_id ? drvMap[p.driver_id] : null;
      return {
        ...s,
        pickup_id:       p?.id ?? null,
        pickup_type:     p?.pickup_type ?? null,
        pickup_time:     p?.pickup_time ?? null,
        pickup_status:   p?.status ?? null,
        pickup_location: p?.pickup_location ?? null,
        dropoff_location: p?.dropoff_location ?? null,
        driver_name:     drv?.full_name ?? null,
        driver_phone:    drv?.phone ?? null,
        vehicle_plate:   p?.vehicle_id ? vehMap[p.vehicle_id] ?? null : null,
      };
    }));

    // Bookings for this unit (today + recent pending)
    const { data: bookData } = await supabase.from("bookings")
      .select("id,purpose,trip_date,trip_time,status,pickup_location,dropoff_location,created_by")
      .eq("unit_id", unitId)
      .in("status", ["draft","finance_pending","submitted","approved","dispatched","in_progress"])
      .order("trip_date", { ascending: false }).limit(50);

    const reqIds = [...new Set(((bookData as any[]) || []).map((b: any) => b.created_by))];
    const { data: reqProfiles } = reqIds.length
      ? await supabase.from("profiles").select("user_id,full_name").in("user_id", reqIds)
      : { data: [] };
    const reqMap = Object.fromEntries(((reqProfiles as any[]) || []).map(p => [p.user_id, p.full_name]));

    setBookings(((bookData as any[]) || []).map(b => ({
      ...b, requester_name: reqMap[b.created_by] ?? "Unknown",
    })));

    // Camera technicians deployed to this unit
    const { data: techs } = await supabase.from("camera_deployments")
      .select("id,technician_id,shift_type,sub_shift,deployment_date,end_date")
      .eq("unit_id", unitId).eq("status", "active")
      .lte("deployment_date", today);
    const techIds2 = ((techs as any[]) || []).map((t: any) => t.technician_id);
    const { data: techProfiles } = techIds2.length
      ? await supabase.from("profiles").select("user_id,full_name").in("user_id", techIds2)
      : { data: [] };
    const techMap = Object.fromEntries(((techProfiles as any[]) || []).map(p => [p.user_id, p.full_name]));
    setDeployedTechs(((techs as any[]) || []).map((t: any) => ({
      deployment_id: t.id, user_id: t.technician_id,
      full_name: techMap[t.technician_id] ?? "Unknown",
      shift_type: t.shift_type, sub_shift: t.sub_shift,
      deployment_date: t.deployment_date, end_date: t.end_date,
    })));

    // Active drivers + vehicles for scheduling
    const [{ data: allDrvs }, { data: allVehs }] = await Promise.all([
      supabase.from("drivers").select("id,full_name,license_number,phone").eq("employment_status","active").order("full_name"),
      supabase.from("vehicles").select("id,plate_number").eq("status","active").order("plate_number"),
    ]);
    setDrivers((allDrvs as Driver[]) || []);
    setVehicles((allVehs as Vehicle[]) || []);

    setLoading(false);
  }, [unitId]);

  useEffect(() => { load(); }, [load]);

  const schedulePick = async () => {
    if (!showSched || !sDate) return;
    setSSaving(true); setError(null);
    try {
      const { error: e } = await supabase.rpc("schedule_unit_pickup", {
        p_user_id: showSched.user_id, p_pickup_type: sType, p_date: sDate,
        p_pickup_location: sFrom || null, p_dropoff_location: sTo || null,
        p_pickup_time: sTime || null,
        p_driver_id: sDriverId || null, p_vehicle_id: sVehicleId || null,
        p_notes: sNotes || null,
      });
      if (e) throw e;
      setShowSched(null); setSFrom(""); setSTo(""); setSTime(""); setSDriverId(""); setSVehicleId(""); setSNotes("");
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSSaving(false); }
  };

  const cancelPickup = async (pickupId: string) => {
    await supabase.from("unit_pickup_schedule").update({ status: "cancelled" }).eq("id", pickupId);
    await load();
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview",  label: "Overview" },
    { value: "schedule",  label: "Dawn / Evening" },
    { value: "bookings",  label: "Bookings" },
    { value: "camera",    label: "Camera Techs" },
  ];
  const counts = {
    schedule: staff.filter(s => !s.pickup_id).length,
    bookings: bookings.filter(b => ["draft","finance_pending","submitted"].includes(b.booking_status ?? b.status ?? "")).length,
    camera: deployedTechs.length,
  };

  if (loading) return <PageSpinner variant="dashboard" />;
  if (!unitId) return <EmptyState title="No unit assigned" subtitle="Contact your administrator" />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">{unitName}</h1>
          <p className="page-sub">{profile?.position_title ?? "Unit Head"} · {staff.length} staff members</p>
        </div>
      </div>

      {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Staff",      value: staff.length,         color: "var(--text)"  },
          { label: "Active Bookings", value: bookings.filter(b => ["approved","dispatched","in_progress"].includes((b as any).booking_status ?? b.status ?? "")).length, color: "var(--green)" },
          { label: "Camera Techs", value: deployedTechs.length, color: "var(--accent)" },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} counts={counts} />

      {/* ─── OVERVIEW ─── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Today's schedule summary */}
          <Card>
            <CardHeader title="Today's Staff Schedule" subtitle={new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})} />
            {staff.length === 0 ? (
              <CardBody><EmptyState title="No staff in this unit" /></CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead><tr><th>Name</th><th>Position</th><th>Dawn / Evening</th><th>Driver</th><th></th></tr></thead>
                  <tbody>
                    {staffPg.slice.map(s => (
                      <tr key={s.user_id}>
                        <td className="font-medium">{s.full_name}</td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.position_title ?? "—"}</td>
                        <td>
                          {s.pickup_id ? (
                            <div>
                              <span className="badge badge-approved text-xs">
                                {s.pickup_type === "dawn" ? "🌅" : "🌆"} {s.pickup_type} · {s.pickup_time?.slice(0,5) ?? ""}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Not scheduled</span>
                          )}
                        </td>
                        <td>
                          {s.driver_name ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>🚗 {s.driver_name}</div>
                              {s.driver_phone && <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "monospace" }}>{s.driver_phone}</div>}
                              {s.vehicle_plate && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.vehicle_plate}</div>}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <Btn size="sm" variant="ghost" onClick={() => {
                            setShowSched(s);
                            setSType(s.pickup_id ? "evening" : "dawn");
                            setSDate(new Date().toISOString().slice(0,10));
                          }}>
                            {s.pickup_id ? "Edit" : "+ Schedule"}
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationBar {...staffPg} />
              </div>
            )}
          </Card>

          {/* Recent bookings snapshot */}
          {bookings.length > 0 && (
            <Card>
              <CardHeader title="Recent Unit Bookings" />
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead><tr><th>Purpose</th><th>Requested By</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {bookings.slice(0, 5).map(b => (
                      <tr key={b.id}>
                        <td className="font-medium max-w-[200px] truncate">{b.purpose}</td>
                        <td style={{ fontSize: 12 }}>{b.requester_name}</td>
                        <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(b.trip_date)}</td>
                        <td><Badge status={(b as any).booking_status ?? b.status ?? "draft"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── DAWN / EVENING SCHEDULE ─── */}
      {tab === "schedule" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Dawn & Evening Pickup Schedule
            </p>
            <Btn size="sm" variant="primary" onClick={() => { setShowSched(staff[0] ?? null); setSType("dawn"); setSDate(new Date().toISOString().slice(0,10)); }}>
              + Schedule Pickup
            </Btn>
          </div>

          {staff.length === 0 ? (
            <EmptyState title="No staff to schedule" />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Dawn Pickup</th>
                      <th>Evening Drop-off</th>
                      <th>Driver</th>
                      <th>Vehicle</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPg.slice.map(s => {
                      const dawnPick   = s.pickup_type === "dawn"    ? s : null;
                      const eveningPick = s.pickup_type === "evening" ? s : null;
                      return (
                        <tr key={s.user_id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{s.full_name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.position_title ?? "—"}</div>
                          </td>
                          <td>
                            {dawnPick?.pickup_id ? (
                              <div>
                                <div style={{ fontSize: 12 }}>🌅 {dawnPick.pickup_time?.slice(0,5)}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{dawnPick.pickup_location}</div>
                              </div>
                            ) : (
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                                onClick={() => { setShowSched(s); setSType("dawn"); setSDate(new Date().toISOString().slice(0,10)); }}>
                                + Dawn
                              </button>
                            )}
                          </td>
                          <td>
                            {eveningPick?.pickup_id ? (
                              <div>
                                <div style={{ fontSize: 12 }}>🌆 {eveningPick.pickup_time?.slice(0,5)}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{eveningPick.dropoff_location}</div>
                              </div>
                            ) : (
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                                onClick={() => { setShowSched(s); setSType("evening"); setSDate(new Date().toISOString().slice(0,10)); }}>
                                + Evening
                              </button>
                            )}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {s.driver_name ? (
                              <div>
                                <div style={{ fontWeight: 600 }}>{s.driver_name}</div>
                                {s.driver_phone && <div style={{ color: "var(--accent)", fontFamily: "monospace", fontSize: 11 }}>{s.driver_phone}</div>}
                              </div>
                            ) : "—"}
                          </td>
                          <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.vehicle_plate ?? "—"}</td>
                          <td>
                            {s.pickup_id && (
                              <Btn size="sm" variant="danger" onClick={() => cancelPickup(s.pickup_id!)}>Cancel</Btn>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar {...staffPg} />
            </div>
          )}
        </div>
      )}

      {/* ─── BOOKINGS ─── */}
      {tab === "bookings" && (
        <div className="space-y-3">
          {bookings.length === 0 ? (
            <EmptyState title="No bookings for this unit" subtitle="Bookings made by your staff will appear here" />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead><tr><th>Purpose</th><th>Requested By</th><th>Date</th><th>Route</th><th>Status</th></tr></thead>
                  <tbody>
                    {bookingsPg.slice.map(b => (
                      <tr key={b.id}>
                        <td className="font-medium max-w-[180px] truncate">{b.purpose}</td>
                        <td style={{ fontSize: 12 }}>{b.requester_name}</td>
                        <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(b.trip_date)} {b.trip_time?.slice(0,5)}</td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 160 }}>
                          <div className="truncate">{b.pickup_location}</div>
                          <div className="truncate">→ {b.dropoff_location}</div>
                        </td>
                        <td><Badge status={(b as any).booking_status ?? b.status ?? "draft"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar {...bookingsPg} />
            </div>
          )}
        </div>
      )}

      {/* ─── CAMERA TECHS ─── */}
      {tab === "camera" && (
        <div className="space-y-3">
          {deployedTechs.length === 0 ? (
            <EmptyState title="No camera technicians deployed" subtitle="The Camera Department head assigns technicians to units" />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tms-table">
                  <thead><tr><th>Technician</th><th>Shift</th><th>From</th><th>Until</th></tr></thead>
                  <tbody>
                    {deployedTechs.map(d => (
                      <tr key={d.deployment_id}>
                        <td className="font-medium">{d.full_name}</td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {d.sub_shift ? SHIFT_LABEL[d.sub_shift] : SHIFT_LABEL[d.shift_type] ?? d.shift_type}
                        </td>
                        <td style={{ fontSize: 12 }}>{fmtDate(d.deployment_date)}</td>
                        <td style={{ fontSize: 12 }}>{d.end_date ? fmtDate(d.end_date) : "Open-ended"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Schedule Pickup Modal ── */}
      <Modal
        open={!!showSched}
        onClose={() => setShowSched(null)}
        title={`Schedule for ${showSched?.full_name ?? ""}`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}

          {/* Pickup type */}
          <Field label="Type" required>
            <div className="flex gap-2">
              {[{ v: "dawn", l: "🌅 Dawn Pickup" }, { v: "evening", l: "🌆 Evening Drop-off" }].map(t => (
                <button key={t.v} type="button" onClick={() => setSType(t.v)}
                  style={{ flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                    border: `2px solid ${sType === t.v ? "var(--accent)" : "var(--border)"}`,
                    background: sType === t.v ? "var(--accent-dim)" : "var(--surface-2)",
                    color: sType === t.v ? "var(--accent)" : "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>
                  {t.l}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <Input type="date" value={sDate} onChange={e => setSDate(e.target.value)} />
            </Field>
            <Field label="Pickup Time">
              <Input type="time" value={sTime} onChange={e => setSTime(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pickup Location">
              <Input placeholder="Where to pick up" value={sFrom} onChange={e => setSFrom(e.target.value)} />
            </Field>
            <Field label="Drop-off Location">
              <Input placeholder="Where to drop off" value={sTo} onChange={e => setSTo(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Assign Driver">
              <Select value={sDriverId} onChange={e => setSDriverId(e.target.value)}>
                <option value="">— Select driver —</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.full_name ?? d.license_number}{d.phone ? ` · ${d.phone}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assign Vehicle">
              <Select value={sVehicleId} onChange={e => setSVehicleId(e.target.value)}>
                <option value="">— Select vehicle —</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <Textarea rows={2} placeholder="Any notes…" value={sNotes} onChange={e => setSNotes(e.target.value)} />
          </Field>

          <div className="flex justify-end gap-3 pt-1">
            <Btn variant="ghost" onClick={() => setShowSched(null)}>Cancel</Btn>
            <Btn variant="primary" loading={sSaving} onClick={schedulePick}>Save Schedule</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
