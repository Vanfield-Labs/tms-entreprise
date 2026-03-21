// src/modules/camera/components/DeployedTechniciansPanel.tsx
// Reusable widget embedded in any receiving unit head's layout.
// Shows:
//   - Camera technicians currently deployed to this unit
//   - Their shift hours
//   - Dawn pickup / Evening drop-off column (today's)
//   - Assigned driver info per pickup
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardBody, EmptyState, Badge, Btn, Field, Input, Select, Modal, PageSpinner } from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";

type Deployed = {
  deployment_id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  shift_type: string;
  sub_shift: string | null;
  deployment_date: string;
  end_date: string | null;
  // Today's pickup
  pickup_id: string | null;
  pickup_type: string | null;
  pickup_date: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_time: string | null;
  pickup_status: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_plate: string | null;
};

type Driver = { id: string; full_name: string | null; license_number: string; phone: string | null };

const SHIFT_LABEL: Record<string, string> = {
  straight_day: "8am – 5pm",
  dawn:         "5am – 2pm",
  afternoon:    "2pm – end",
  production:   "Production",
};

const STATUS_COLOR: Record<string, string> = {
  pending:  "badge-submitted",
  approved: "badge-approved",
  rejected: "badge-rejected",
};

export function DeployedTechniciansPanel() {
  const { profile } = useAuth();
  const unitId = profile?.unit_id;

  const [deployed, setDeployed]   = useState<Deployed[]>([]);
  const [drivers, setDrivers]     = useState<Driver[]>([]);
  const [loading, setLoading]     = useState(true);
  const [actingId, setActingId]   = useState<string | null>(null);
  const [assignDrvId, setAssignDrvId] = useState<Record<string, string>>({});
  const [showPickupModal, setShowPickupModal] = useState<{ userId: string; name: string } | null>(null);
  // New pickup form
  const [pType, setPType]   = useState("dawn");
  const [pDate, setPDate]   = useState(new Date().toISOString().slice(0, 10));
  const [pFrom, setPFrom]   = useState("");
  const [pTo, setPTo]       = useState("");
  const [pTime, setPTime]   = useState("");
  const [pSaving, setPSaving] = useState(false);

  const load = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    // Get active deployments for this unit
    const { data: deps } = await supabase.from("camera_deployments")
      .select("id,technician_id,shift_type,sub_shift,deployment_date,end_date")
      .eq("unit_id", unitId)
      .eq("status", "active")
      .lte("deployment_date", today);

    const techIds = ((deps as any[]) || []).map(d => d.technician_id);
    if (techIds.length === 0) { setDeployed([]); setLoading(false); return; }

    // Profiles
    const { data: profiles } = await supabase.from("profiles")
      .select("user_id,full_name,phone").in("user_id", techIds);
    const pMap = Object.fromEntries(((profiles as any[]) || []).map(p => [p.user_id, p]));

    // Today's pickups for these technicians
    const { data: pickups } = await supabase.from("camera_pickups")
      .select("id,technician_id,pickup_type,pickup_date,pickup_location,dropoff_location,requested_time,status,driver_name,driver_phone,vehicle_plate")
      .in("technician_id", techIds)
      .eq("pickup_date", today)
      .in("status", ["pending","approved"]);
    const pkpMap: Record<string, any> = {};
    ((pickups as any[]) || []).forEach(p => { pkpMap[p.technician_id] = p; });

    setDeployed(((deps as any[]) || []).map(d => {
      const prof = pMap[d.technician_id] ?? {};
      const pkp  = pkpMap[d.technician_id];
      return {
        deployment_id: d.id,
        user_id:       d.technician_id,
        full_name:     prof.full_name ?? "Unknown",
        phone:         prof.phone ?? null,
        shift_type:    d.shift_type,
        sub_shift:     d.sub_shift,
        deployment_date: d.deployment_date,
        end_date:      d.end_date,
        pickup_id:     pkp?.id ?? null,
        pickup_type:   pkp?.pickup_type ?? null,
        pickup_date:   pkp?.pickup_date ?? null,
        pickup_location: pkp?.pickup_location ?? null,
        dropoff_location: pkp?.dropoff_location ?? null,
        pickup_time:   pkp?.requested_time ?? null,
        pickup_status: pkp?.status ?? null,
        driver_name:   pkp?.driver_name ?? null,
        driver_phone:  pkp?.driver_phone ?? null,
        vehicle_plate: pkp?.vehicle_plate ?? null,
      };
    }));

    // Active drivers for assignment
    const { data: drvs } = await supabase.from("drivers")
      .select("id,full_name,license_number,phone").eq("employment_status","active").order("full_name");
    setDrivers((drvs as Driver[]) || []);

    setLoading(false);
  }, [unitId]);

  useEffect(() => { load(); }, [load]);

  const approvePickup = async (pickupId: string, techId: string, action: "approved" | "rejected") => {
    setActingId(pickupId);
    const driverId = assignDrvId[pickupId] || null;
    await supabase.rpc("action_camera_pickup", {
      p_pickup_id: pickupId, p_action: action,
      p_driver_id: driverId || null,
    });
    await load();
    setActingId(null);
  };

  const createPickupForTech = async () => {
    if (!showPickupModal || !pDate || !pFrom || !pTo || !pTime) return;
    setPSaving(true);
    // Unit head creates pickup on behalf of technician — insert directly
    await supabase.from("camera_pickups").insert({
      technician_id: showPickupModal.userId,
      pickup_type: pType, pickup_date: pDate,
      pickup_location: pFrom, dropoff_location: pTo,
      requested_time: pTime, status: "approved",
      approved_by: (await supabase.auth.getUser()).data.user?.id,
      approved_at: new Date().toISOString(),
    });
    setShowPickupModal(null); setPFrom(""); setPTo(""); setPTime("");
    await load();
    setPSaving(false);
  };

  if (loading) return <PageSpinner />;
  if (!unitId) return null;

  return (
    <Card>
      <CardHeader
        title="📸 Camera Technicians"
        subtitle={`${deployed.length} currently deployed to your unit`}
      />
      {deployed.length === 0 ? (
        <CardBody>
          <EmptyState title="No camera technicians deployed" subtitle="The Camera Department will assign technicians here" />
        </CardBody>
      ) : (
        <div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="tms-table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Shift</th>
                  <th>Until</th>
                  <th>Dawn / Evening Today</th>
                  <th>Driver Info</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {deployed.map(d => (
                  <tr key={d.deployment_id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{d.full_name}</div>
                      {d.phone && <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>{d.phone}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {d.sub_shift ? SHIFT_LABEL[d.sub_shift] : SHIFT_LABEL[d.shift_type] ?? d.shift_type}
                    </td>
                    <td style={{ fontSize: 12 }}>{d.end_date ? fmtDate(d.end_date) : "Open-ended"}</td>
                    <td>
                      {d.pickup_id ? (
                        <div>
                          <span className={`badge ${STATUS_COLOR[d.pickup_status!] ?? "badge-draft"} text-xs`}>
                            {d.pickup_type === "dawn" ? "🌅 Dawn" : "🌆 Evening"} · {d.pickup_time?.slice(0,5)}
                          </span>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {d.pickup_location} → {d.dropoff_location}
                          </div>
                          {d.pickup_status === "pending" && (
                            <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                              <select
                                className="tms-select"
                                style={{ padding: "4px 8px", fontSize: 11, width: 140 }}
                                value={assignDrvId[d.pickup_id] ?? ""}
                                onChange={e => setAssignDrvId(m => ({ ...m, [d.pickup_id!]: e.target.value }))}
                              >
                                <option value="">No driver</option>
                                {drivers.map(dr => <option key={dr.id} value={dr.id}>{dr.full_name ?? dr.license_number}</option>)}
                              </select>
                              <button className="btn btn-success btn-sm" style={{ fontSize: 11, padding: "4px 10px" }}
                                disabled={actingId === d.pickup_id}
                                onClick={() => approvePickup(d.pickup_id!, d.user_id, "approved")}>✓</button>
                              <button className="btn btn-danger btn-sm" style={{ fontSize: 11, padding: "4px 10px" }}
                                disabled={actingId === d.pickup_id}
                                onClick={() => approvePickup(d.pickup_id!, d.user_id, "rejected")}>✕</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => setShowPickupModal({ userId: d.user_id, name: d.full_name })}
                        >
                          + Schedule
                        </button>
                      )}
                    </td>
                    <td>
                      {d.driver_name ? (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>🚗 {d.driver_name}</div>
                          {d.driver_phone && <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "monospace" }}>{d.driver_phone}</div>}
                          {d.vehicle_plate && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.vehicle_plate}</div>}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(d.deployment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y" style={{ borderColor: "var(--border)" }}>
            {deployed.map(d => (
              <div key={d.deployment_id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{d.full_name}</p>
                    {d.phone && <p className="text-xs font-mono" style={{ color: "var(--accent)" }}>{d.phone}</p>}
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {d.sub_shift ? SHIFT_LABEL[d.sub_shift] : SHIFT_LABEL[d.shift_type] ?? d.shift_type}
                      {d.end_date ? ` · until ${fmtDate(d.end_date)}` : ""}
                    </p>
                  </div>
                  <span className="badge badge-approved">Active</span>
                </div>

                {d.pickup_id ? (
                  <div className="rounded-xl p-3 space-y-1" style={{ background: "var(--surface-2)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                      {d.pickup_type === "dawn" ? "🌅 Dawn Pickup" : "🌆 Evening Drop-off"} · {d.pickup_time?.slice(0,5)}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{d.pickup_location} → {d.dropoff_location}</p>
                    <span className={`badge ${STATUS_COLOR[d.pickup_status!] ?? "badge-draft"} text-xs`}>{d.pickup_status}</span>
                    {d.driver_name && (
                      <p className="text-xs font-semibold" style={{ color: "var(--green)" }}>🚗 {d.driver_name} {d.driver_phone ? `· ${d.driver_phone}` : ""}</p>
                    )}
                    {d.pickup_status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <Btn size="sm" variant="success" loading={actingId === d.pickup_id}
                          onClick={() => approvePickup(d.pickup_id!, d.user_id, "approved")}>Approve</Btn>
                        <Btn size="sm" variant="danger" loading={actingId === d.pickup_id}
                          onClick={() => approvePickup(d.pickup_id!, d.user_id, "rejected")}>Reject</Btn>
                      </div>
                    )}
                  </div>
                ) : (
                  <Btn size="sm" variant="ghost"
                    onClick={() => setShowPickupModal({ userId: d.user_id, name: d.full_name })}>
                    + Schedule Dawn/Evening
                  </Btn>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule pickup modal */}
      <Modal open={!!showPickupModal} onClose={() => setShowPickupModal(null)} title={`Schedule for ${showPickupModal?.name}`} maxWidth="max-w-sm">
        <div className="space-y-4">
          <Field label="Type" required>
            <div className="flex gap-2">
              {[{ v:"dawn",l:"🌅 Dawn Pickup"},{ v:"evening",l:"🌆 Evening Drop-off"}].map(t=>(
                <button key={t.v} type="button" onClick={()=>setPType(t.v)}
                  style={{flex:1,padding:"8px",borderRadius:10,cursor:"pointer",textAlign:"center",
                    border:`2px solid ${pType===t.v?"var(--accent)":"var(--border)"}`,
                    background:pType===t.v?"var(--accent-dim)":"var(--surface-2)",
                    color:pType===t.v?"var(--accent)":"var(--text-muted)",fontSize:12,fontWeight:600}}>
                  {t.l}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <Input type="date" value={pDate} onChange={e=>setPDate(e.target.value)}/>
            </Field>
            <Field label="Time" required>
              <Input type="time" value={pTime} onChange={e=>setPTime(e.target.value)}/>
            </Field>
          </div>
          <Field label="Pickup Location" required>
            <Input placeholder="From where" value={pFrom} onChange={e=>setPFrom(e.target.value)}/>
          </Field>
          <Field label="Drop-off Location" required>
            <Input placeholder="To where" value={pTo} onChange={e=>setPTo(e.target.value)}/>
          </Field>
          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={()=>setShowPickupModal(null)}>Cancel</Btn>
            <Btn variant="primary" loading={pSaving} onClick={createPickupForTech}>Schedule</Btn>
          </div>
        </div>
      </Modal>
    </Card>
  );
}