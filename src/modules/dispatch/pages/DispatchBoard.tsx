// src/modules/dispatch/pages/DispatchBoard.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, StatCard, Field, Select, Input, Btn } from "@/components/TmsUI";
import { fmtDate, fmtDateTime } from "@/lib/utils";

type Booking = {
  id: string;
  purpose: string;
  trip_date: string;
  trip_time: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_digital_address: string | null;
  dropoff_digital_address: string | null;
  booking_type: string | null;
  num_passengers: number | null;
  trip_notes: string | null;
  status: string;
  created_by: string;
  created_at: string;
  requester_name: string;
  requester_position: string | null;
  requester_division: string | null;
  requester_unit: string | null;
};

type Vehicle = {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  fuel_type: string | null;
};

type Driver = {
  driver_id: string;
  full_name: string;
  license_number: string;
  phone: string | null;
};

export default function DispatchBoard() {
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [vehicles,    setVehicles]    = useState<Vehicle[]>([]);
  const [drivers,     setDrivers]     = useState<Driver[]>([]);
  const [selVehicle,  setSelVehicle]  = useState<Record<string, string>>({});
  const [selDriver,   setSelDriver]   = useState<Record<string, string>>({});
  const [notes,       setNotes]       = useState<Record<string, string>>({});
  const [dispatching, setDispatching] = useState<Record<string, boolean>>({});
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);

    // ── Approved bookings ──────────────────────────────────────────────────
    const { data: bookingsRaw } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,pickup_digital_address,dropoff_digital_address,booking_type,num_passengers,trip_notes,status,created_by,created_at")
      .eq("status", "approved")
      .order("trip_date", { ascending: true });

    const bookings = (bookingsRaw as any[]) || [];

    // ── Active vehicles ────────────────────────────────────────────────────
    const { data: vehiclesRaw } = await supabase
      .from("vehicles")
      .select("id,plate_number,make,model,fuel_type")
      .eq("status", "active")
      .order("plate_number");
    setVehicles((vehiclesRaw as Vehicle[]) || []);

    // ── Active drivers — split query ────────────────────────────────────────
    const { data: driversRaw } = await supabase
      .from("drivers")
      .select("id,full_name,license_number,phone,user_id")
      .eq("employment_status", "active")
      .order("full_name");

    const driverRows = (driversRaw as any[]) || [];

    // Resolve names from profiles for drivers missing full_name
    const missingIds = driverRows.filter((d: any) => !d.full_name && d.user_id).map((d: any) => d.user_id);
    let nameMap: Record<string, string> = {};
    if (missingIds.length > 0) {
      const { data: pd } = await supabase
        .from("profiles")
        .select("user_id,full_name")
        .in("user_id", missingIds);
      nameMap = Object.fromEntries(((pd as any[]) || []).map((p: any) => [p.user_id, p.full_name]));
    }

    setDrivers(driverRows.map((d: any) => ({
      driver_id:      d.id,
      license_number: d.license_number,
      phone:          d.phone ?? null,
      full_name:      d.full_name ?? (d.user_id ? (nameMap[d.user_id] ?? `Driver ${d.license_number}`) : `Driver ${d.license_number}`),
    })));

    // ── Resolve requester profiles ─────────────────────────────────────────
    let profileMap: Record<string, { name: string; position: string | null; division: string | null; unit: string | null }> = {};
    if (bookings.length > 0) {
      try {
        const creatorIds = [...new Set(bookings.map((b: any) => b.created_by).filter(Boolean))];
        const { data: profilesRaw } = await supabase
          .from("profiles")
          .select("user_id,full_name,position_title,division_id,unit_id")
          .in("user_id", creatorIds);
        const profiles = (profilesRaw as any[]) || [];

        const divIds  = [...new Set(profiles.map((p: any) => p.division_id).filter(Boolean))];
        const unitIds = [...new Set(profiles.map((p: any) => p.unit_id).filter(Boolean))];
        const [{ data: divsRaw }, { data: unitsRaw }] = await Promise.all([
          divIds.length  ? supabase.from("divisions").select("id,name").in("id", divIds)  : Promise.resolve({ data: [] }),
          unitIds.length ? supabase.from("units").select("id,name").in("id", unitIds)      : Promise.resolve({ data: [] }),
        ]);
        const divMap  = Object.fromEntries(((divsRaw  as any[]) || []).map((d: any) => [d.id, d.name]));
        const unitMap = Object.fromEntries(((unitsRaw as any[]) || []).map((u: any) => [u.id, u.name]));
        profiles.forEach((p: any) => {
          profileMap[p.user_id] = {
            name:     p.full_name      ?? "—",
            position: p.position_title ?? null,
            division: p.division_id ? (divMap[p.division_id] ?? null) : null,
            unit:     p.unit_id     ? (unitMap[p.unit_id]    ?? null) : null,
          };
        });
      } catch (_) {}
    }

    setBookings(bookings.map((b: any) => {
      const prof = profileMap[b.created_by] ?? { name: "—", position: null, division: null, unit: null };
      return { ...b, requester_name: prof.name, requester_position: prof.position, requester_division: prof.division, requester_unit: prof.unit };
    }));

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const dispatch = async (bookingId: string) => {
    const vehicleId = selVehicle[bookingId];
    const driverId  = selDriver[bookingId];
    if (!vehicleId || !driverId) return;
    setDispatching(m => ({ ...m, [bookingId]: true }));
    setError(m => ({ ...m, [bookingId]: "" }));
    try {
      const { error: rpcErr } = await supabase.rpc("dispatch_booking", {
        p_booking_id: bookingId,
        p_vehicle_id: vehicleId,
        p_driver_id:  driverId,
        p_notes:      notes[bookingId] || null,
      });
      if (rpcErr) throw rpcErr;
      await load();
    } catch (e: any) {
      setError(m => ({ ...m, [bookingId]: e.message ?? "Dispatch failed." }));
    } finally {
      setDispatching(m => ({ ...m, [bookingId]: false }));
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="To Dispatch" value={bookings.length} accent="accent" />
        <StatCard label="Vehicles"    value={vehicles.length} accent="green"  />
        <StatCard label="Drivers"     value={drivers.length}  accent="purple" />
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          title="Nothing to dispatch"
          subtitle="No approved bookings awaiting assignment"
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>}
        />
      ) : (
        <div className="space-y-4">
          {bookings.map(b => {
            const ready          = !!(selVehicle[b.id] && selDriver[b.id]);
            const selectedDriver = drivers.find(d => d.driver_id === selDriver[b.id]);

            return (
              <Card key={b.id}>

                {/* ── Header ── */}
                <div
                  className="px-4 py-3 border-b border-[color:var(--border)]"
                  style={{ background: "color-mix(in srgb, var(--green-dim) 60%, var(--surface))" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-[color:var(--text)]">{b.purpose}</p>
                      <p className="text-xs text-[color:var(--text-muted)] mt-0.5 capitalize">
                        {b.booking_type ?? "booking"}
                      </p>
                    </div>
                    <Badge status="approved" />
                  </div>
                </div>

                {/* ── Requester info ── */}
                <div
                  className="px-4 py-3 border-b border-[color:var(--border)]"
                  style={{ background: "var(--surface-2)" }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                    Requested By
                  </p>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: "var(--accent)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
                    }}>
                      {b.requester_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
                        {b.requester_name}
                      </p>
                      {b.requester_position && (
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.3 }}>
                          {b.requester_position}
                        </p>
                      )}
                      {(b.requester_division || b.requester_unit) && (
                        <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "2px 0 0", lineHeight: 1.3 }}>
                          {[b.requester_division, b.requester_unit].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>
                    Submitted {fmtDateTime(b.created_at)}
                  </p>
                </div>

                {/* ── Trip details ── */}
                <div className="px-4 py-3 border-b border-[color:var(--border)] space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                    Trip Details
                  </p>

                  {/* Date & time */}
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{fmtDate(b.trip_date)}</span> at {b.trip_time}
                    </span>
                  </div>

                  {/* Route */}
                  <div style={{ display: "flex", alignItems: "stretch", gap: 12, padding: "4px 0" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingTop: 2, flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid var(--accent)", background: "var(--surface)", flexShrink: 0 }} />
                      <div style={{ width: 1, flex: 1, minHeight: 14, background: "var(--border-bright)" }} />
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--text)", flexShrink: 0 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", margin: 0 }}>{b.pickup_location}</p>
                        {b.pickup_digital_address && (
                          <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "1px 0 0" }}>{b.pickup_digital_address}</p>
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", margin: 0 }}>{b.dropoff_location}</p>
                        {b.dropoff_digital_address && (
                          <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "1px 0 0" }}>{b.dropoff_digital_address}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {b.num_passengers != null && b.num_passengers > 0 && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      👥 {b.num_passengers} passenger{b.num_passengers !== 1 ? "s" : ""}
                    </p>
                  )}

                  {b.trip_notes && (
                    <div
                      className="rounded-lg px-3 py-2 text-xs"
                      style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>Notes: </span>{b.trip_notes}
                    </div>
                  )}
                </div>

                {/* ── Assign vehicle + driver ── */}
                <div className="p-4 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Assign Resources
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Vehicle */}
                    <Field label="Vehicle *">
                      <Select
                        value={selVehicle[b.id] || ""}
                        onChange={e => setSelVehicle(m => ({ ...m, [b.id]: e.target.value }))}
                      >
                        <option value="">— Select vehicle —</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.plate_number}{v.make ? ` · ${v.make}` : ""}{v.model ? ` ${v.model}` : ""}{v.fuel_type ? ` (${v.fuel_type})` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    {/* Driver */}
                    <Field label="Driver *">
                      <Select
                        value={selDriver[b.id] || ""}
                        onChange={e => setSelDriver(m => ({ ...m, [b.id]: e.target.value }))}
                      >
                        <option value="">— Select driver —</option>
                        {drivers.map(d => (
                          <option key={d.driver_id} value={d.driver_id}>
                            {d.full_name}{d.phone ? ` · ${d.phone}` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  {/* Selected driver confirmation pill */}
                  {selectedDriver && (
                    <div
                      className="rounded-lg px-3 py-2 flex items-center gap-2"
                      style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)" }}
                    >
                      <span>🧑‍✈️</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{selectedDriver.full_name}</span>
                      <span style={{ color: "var(--text-dim)" }}>·</span>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-muted)" }}>{selectedDriver.license_number}</span>
                      {selectedDriver.phone && (
                        <>
                          <span style={{ color: "var(--text-dim)" }}>·</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedDriver.phone}</span>
                        </>
                      )}
                    </div>
                  )}

                  <Field label="Notes (optional)">
                    <Input
                      placeholder="Special instructions for the driver…"
                      value={notes[b.id] || ""}
                      onChange={e => setNotes(m => ({ ...m, [b.id]: e.target.value }))}
                    />
                  </Field>

                  {error[b.id] && (
                    <p style={{ fontSize: 12, color: "var(--red)" }}>{error[b.id]}</p>
                  )}

                  <Btn
                    variant="primary"
                    className="w-full"
                    disabled={!ready}
                    loading={dispatching[b.id]}
                    onClick={() => dispatch(b.id)}
                  >
                    Dispatch →
                  </Btn>
                </div>

              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}