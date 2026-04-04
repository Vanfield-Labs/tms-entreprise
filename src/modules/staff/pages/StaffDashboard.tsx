// src/modules/staff/pages/StaffDashboard.tsx
// Dashboard for regular staff (unit_head or staff role):
//   - Today's scheduled dawn/evening pickup (if any) with driver info
//   - Their active deployment if camera technician
//   - Their bookings (active)
//   - Their evening route driver on duty today (if scheduled)
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageSpinner, EmptyState, Card, CardHeader, CardBody, Badge } from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";

type TodayPickup = {
  id: string; pickup_type: string; schedule_date: string;
  pickup_time: string | null; pickup_location: string | null;
  dropoff_location: string | null; status: string;
  driver_name: string | null; driver_phone: string | null; vehicle_plate: string | null;
};

type ActiveBooking = {
  id: string; purpose: string; trip_date: string; trip_time: string;
  status: string; pickup_location: string; dropoff_location: string;
  vehicle_plate: string | null; driver_name: string | null; driver_phone: string | null;
};

type EveningDriver = {
  driver_name: string; driver_phone: string | null;
  vehicle_plate: string | null; route_name: string;
};

type CameraDeployment = {
  unit_name: string; shift_type: string; sub_shift: string | null;
  deployment_date: string; end_date: string | null;
};

const SHIFT_LABEL: Record<string, string> = {
  straight_day: "8:00 AM – 5:00 PM",
  dawn:         "5:00 AM – 2:00 PM",
  afternoon:    "2:00 PM – until last programme",
};

export default function StaffDashboard() {
  const { profile, user } = useAuth();
  const [pickup, setPickup]           = useState<TodayPickup | null>(null);
  const [bookings, setBookings]       = useState<ActiveBooking[]>([]);
  const [eveningDriver, setEveningDriver] = useState<EveningDriver | null>(null);
  const [cameraDeployment, setCameraDeployment] = useState<CameraDeployment | null>(null);
  const [loading, setLoading]         = useState(true);

  const CAMERA_UNIT_ID = "252e08c0-0999-4afe-9eff-a15365bd4d47";

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    // Today's scheduled pickup for this user
    const { data: pickupData } = await supabase.from("unit_pickup_schedule")
      .select("id,pickup_type,schedule_date,pickup_time,pickup_location,dropoff_location,status,driver_id,vehicle_id")
      .eq("user_id", user.id).eq("schedule_date", today)
      .in("status", ["scheduled","cancelled"]).limit(1);
    
    if (pickupData && pickupData.length > 0) {
      const p = (pickupData as any[])[0];
      // Resolve driver/vehicle
      let driverName = null, driverPhone = null, vehiclePlate = null;
      if (p.driver_id) {
        const { data: drv } = await supabase.from("drivers").select("full_name,phone").eq("id", p.driver_id).single();
        driverName = (drv as any)?.full_name ?? null;
        driverPhone = (drv as any)?.phone ?? null;
      }
      if (p.vehicle_id) {
        const { data: veh } = await supabase.from("vehicles").select("plate_number").eq("id", p.vehicle_id).single();
        vehiclePlate = (veh as any)?.plate_number ?? null;
      }
      setPickup({ ...p, driver_name: driverName, driver_phone: driverPhone, vehicle_plate: vehiclePlate });
    } else {
      setPickup(null);
    }

    // Active bookings for this user
    const { data: bookData } = await supabase.from("bookings")
      .select("id,purpose,trip_date,trip_time,status,pickup_location,dropoff_location")
      .eq("created_by", user.id)
      .in("status", ["finance_pending","submitted","approved","dispatched","in_progress"])
      .order("trip_date").limit(10);

    // Get dispatch info for each booking
    const bookIds = ((bookData as any[]) || []).map(b => b.id);
    const { data: dispatchData } = bookIds.length
      ? await supabase.from("dispatch_assignments")
          .select("booking_id,vehicle_id,driver_id").in("booking_id", bookIds)
      : { data: [] };

    const vehIds = [...new Set(((dispatchData as any[]) || []).map(d => d.vehicle_id).filter(Boolean))];
    const drvIds = [...new Set(((dispatchData as any[]) || []).map(d => d.driver_id).filter(Boolean))];
    const [{ data: vehs }, { data: drvs }] = await Promise.all([
      vehIds.length ? supabase.from("vehicles").select("id,plate_number").in("id", vehIds) : Promise.resolve({ data: [] }),
      drvIds.length ? supabase.from("drivers").select("id,full_name,phone").in("id", drvIds) : Promise.resolve({ data: [] }),
    ]);
    const vMap = Object.fromEntries(((vehs as any[]) || []).map(v => [v.id, v.plate_number]));
    const dMap = Object.fromEntries(((drvs as any[]) || []).map(d => [d.id, d]));
    const dispMap: Record<string, any> = {};
    ((dispatchData as any[]) || []).forEach(d => { dispMap[d.booking_id] = d; });

    setBookings(((bookData as any[]) || []).map(b => {
      const disp = dispMap[b.id];
      const drv = disp?.driver_id ? dMap[disp.driver_id] : null;
      return {
        ...b,
        vehicle_plate: disp?.vehicle_id ? vMap[disp.vehicle_id] ?? null : null,
        driver_name:   drv?.full_name ?? null,
        driver_phone:  drv?.phone ?? null,
      };
    }));

    // If camera tech, get current deployment
    if (profile?.unit_id === CAMERA_UNIT_ID) {
      const { data: dep } = await supabase.from("camera_deployments")
        .select("unit_id,shift_type,sub_shift,deployment_date,end_date")
        .eq("technician_id", user.id).eq("status", "active")
        .lte("deployment_date", today)
        .order("deployment_date", { ascending: false }).limit(1);
      if (dep && dep.length > 0) {
        const d = (dep as any[])[0];
        const { data: unit } = await supabase.from("units").select("name").eq("id", d.unit_id).single();
        setCameraDeployment({ ...d, unit_name: (unit as any)?.name ?? "Unknown" });
      }
    }

    // Evening route driver on duty today — look up evening_routes based on unit
    // Find if there's a driver on the evening shift whose route covers this user's unit/area
    // We surface all evening drivers on duty today for the user's unit
    const { data: onDutyDrivers } = await supabase
      .from("shift_schedules")
      .select("driver_id")
      .eq("shift_date", today)
      .eq("shift_code", "evening")
      .limit(20);

    if (onDutyDrivers && (onDutyDrivers as any[]).length > 0) {
      const onDutyIds = (onDutyDrivers as any[]).map(s => s.driver_id);
      const { data: evDrivers } = await supabase.from("drivers")
        .select("id,full_name,phone,route_id").in("id", onDutyIds);
      
      // Filter to drivers whose route matches this user's rough area (simplified: show all evening drivers on duty)
      const firstDriver = ((evDrivers as any[]) || [])[0];
      if (firstDriver) {
        const { data: routeData } = firstDriver.route_id
          ? await supabase.from("evening_routes").select("name").eq("id", firstDriver.route_id).single()
          : { data: null };
        // Get vehicle for this driver
        const { data: drvVeh } = await supabase.from("drivers").select("assigned_vehicle_id").eq("id", firstDriver.id).single();
        let plate = null;
        if ((drvVeh as any)?.assigned_vehicle_id) {
          const { data: vv } = await supabase.from("vehicles").select("plate_number").eq("id", (drvVeh as any).assigned_vehicle_id).single();
          plate = (vv as any)?.plate_number ?? null;
        }
        setEveningDriver({
          driver_name: firstDriver.full_name ?? "Unknown",
          driver_phone: firstDriver.phone,
          vehicle_plate: plate,
          route_name: (routeData as any)?.name ?? "Evening route",
        });
      }
    }

    setLoading(false);
  }, [user?.id, profile?.unit_id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSpinner />;

  const todayStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Dashboard</h1>
          <p className="page-sub">{todayStr}</p>
        </div>
      </div>

      {/* Camera deployment banner */}
      {cameraDeployment && (
        <div style={{
          padding: "14px 16px", borderRadius: 14,
          background: "var(--accent-dim)", border: "1px solid var(--accent)",
          display: "flex", gap: 12, alignItems: "center",
        }}>
          <span style={{ fontSize: 24 }}>📺</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              You are deployed to: {cameraDeployment.unit_name}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              ⏰ {SHIFT_LABEL[cameraDeployment.sub_shift ?? cameraDeployment.shift_type] ?? cameraDeployment.shift_type}
              {" · "} Until {cameraDeployment.end_date ? fmtDate(cameraDeployment.end_date) : "further notice"}
            </p>
          </div>
        </div>
      )}

      {/* Today's pickup */}
      <Card>
        <CardHeader title="Today's Pickup / Drop-off" />
        <CardBody>
          {!pickup ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🚗</div>
              <div>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No pickup scheduled for today</p>
                <p style={{ fontSize: 12, color: "var(--text-dim)" }}>Your unit head will schedule a pickup when needed</p>
              </div>
            </div>
          ) : pickup.status === "cancelled" ? (
            <div className="alert alert-amber">Today's pickup has been cancelled.</div>
          ) : (
            <div className="space-y-3">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: pickup.pickup_type === "dawn" ? "var(--amber-dim)" : "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                  {pickup.pickup_type === "dawn" ? "🌅" : "🌆"}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                    {pickup.pickup_type === "dawn" ? "Dawn Pickup" : "Evening Drop-off"}
                  </p>
                  {pickup.pickup_time && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>⏰ {pickup.pickup_time.slice(0,5)}</p>
                  )}
                </div>
              </div>

              {(pickup.pickup_location || pickup.dropoff_location) && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)" }}>
                  {pickup.pickup_location && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>📍 From: <strong style={{ color: "var(--text)" }}>{pickup.pickup_location}</strong></p>
                  )}
                  {pickup.dropoff_location && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>📍 To: <strong style={{ color: "var(--text)" }}>{pickup.dropoff_location}</strong></p>
                  )}
                </div>
              )}

              {pickup.driver_name && (
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--green-dim)", border: "1px solid var(--green)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>🚗 Your Driver</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{pickup.driver_name}</p>
                  {pickup.driver_phone && (
                    <p style={{ fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", color: "var(--accent)", marginTop: 4 }}>
                      📞 {pickup.driver_phone}
                    </p>
                  )}
                  {pickup.vehicle_plate && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Vehicle: {pickup.vehicle_plate}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Evening route drivers on duty */}
      {eveningDriver && (
        <Card>
          <CardHeader title="Evening Route Drivers on Duty" subtitle="Drivers scheduled for evening shifts today" />
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🌙</div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{eveningDriver.driver_name}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{eveningDriver.route_name}</p>
                {eveningDriver.driver_phone && (
                  <p style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: "var(--accent)" }}>
                    📞 {eveningDriver.driver_phone}
                  </p>
                )}
                {eveningDriver.vehicle_plate && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Vehicle: {eveningDriver.vehicle_plate}</p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Active bookings */}
      <Card>
        <CardHeader title="My Active Bookings" subtitle={`${bookings.length} active request${bookings.length !== 1 ? "s" : ""}`} />
        {bookings.length === 0 ? (
          <CardBody>
            <EmptyState title="No active bookings" subtitle="Your submitted bookings will appear here" />
          </CardBody>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {bookings.map(b => (
              <div key={b.id} style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{b.purpose}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {fmtDate(b.trip_date)} · {b.trip_time?.slice(0,5)} · {b.pickup_location} → {b.dropoff_location}
                    </p>
                    {b.driver_name && (
                      <p style={{ fontSize: 12, color: "var(--green)", marginTop: 4 }}>
                        🚗 {b.driver_name}{b.driver_phone ? ` · ${b.driver_phone}` : ""}
                        {b.vehicle_plate ? ` (${b.vehicle_plate})` : ""}
                      </p>
                    )}
                  </div>
                  <Badge status={b.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
