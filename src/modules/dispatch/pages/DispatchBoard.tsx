// src/modules/dispatch/pages/DispatchBoard.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, StatCard, Field, Select, Input, Btn } from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";

type Booking = {
  id: string; purpose: string; trip_date: string; trip_time: string;
  pickup_location: string; dropoff_location: string; status: string;
};
type Vehicle = { id: string; plate_number: string };
type Driver  = { driver_id: string; full_name: string; license_number: string };

export default function DispatchBoard() {
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [drivers,  setDrivers]    = useState<Driver[]>([]);
  const [selVehicle, setSelVehicle] = useState<Record<string, string>>({});
  const [selDriver,  setSelDriver]  = useState<Record<string, string>>({});
  const [notes,      setNotes]      = useState<Record<string, string>>({});
  const [dispatching, setDispatching] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: b }, { data: v }, { data: d }] = await Promise.all([
      supabase.from("bookings").select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status").eq("status", "approved").order("trip_date"),
      supabase.from("vehicles").select("id,plate_number").eq("status", "active"),
      supabase.from("drivers").select("id,license_number,profiles(full_name)").eq("employment_status", "active"),
    ]);
    setBookings((b as Booking[]) || []);
    setVehicles((v as Vehicle[]) || []);
    setDrivers(((d as any[]) || []).map(dr => ({
      driver_id: dr.id,
      license_number: dr.license_number,
      full_name: dr.profiles?.full_name ?? `Driver ${dr.license_number}`,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const dispatch = async (bookingId: string) => {
    const vehicleId = selVehicle[bookingId];
    const driverId  = selDriver[bookingId];
    if (!vehicleId || !driverId) return;
    setDispatching(m => ({ ...m, [bookingId]: true }));
    try {
      await supabase.rpc("dispatch_booking", {
        p_booking_id: bookingId, p_vehicle_id: vehicleId,
        p_driver_id: driverId, p_notes: notes[bookingId] || null,
      });
      await load();
    } finally { setDispatching(m => ({ ...m, [bookingId]: false })); }
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
        <div className="space-y-3">
          {bookings.map(b => {
            const ready = !!(selVehicle[b.id] && selDriver[b.id]);
            return (
              <Card key={b.id}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--green)]/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[color:var(--text)]">{b.purpose}</p>
                      <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{fmtDate(b.trip_date)} at {b.trip_time}</p>
                    </div>
                    <Badge status="approved" />
                  </div>
                </div>

                {/* Route */}
                <div className="px-4 py-3 border-b border-[color:var(--border)]">
                  <div className="flex items-stretch gap-3">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <div className="w-2 h-2 rounded-full border-2 border-[color:var(--border-bright)] bg-[color:var(--surface)]"/>
                      <div className="w-px flex-1 bg-[color:var(--border)] min-h-[16px]"/>
                      <div className="w-2 h-2 rounded-full bg-[color:var(--text)]"/>
                    </div>
                    <div className="flex flex-col justify-between gap-1.5 min-w-0">
                      <p className="text-xs text-[color:var(--text-muted)] truncate">{b.pickup_location}</p>
                      <p className="text-xs font-medium text-[color:var(--text)] truncate">{b.dropoff_location}</p>
                    </div>
                  </div>
                </div>

                {/* Form */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Vehicle *">
                      <Select value={selVehicle[b.id] || ""} onChange={e => setSelVehicle(m => ({ ...m, [b.id]: e.target.value }))}>
                        <option value="">Select vehicle…</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                      </Select>
                    </Field>
                    <Field label="Driver *">
                      <Select value={selDriver[b.id] || ""} onChange={e => setSelDriver(m => ({ ...m, [b.id]: e.target.value }))}>
                        <option value="">Select driver…</option>
                        {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.full_name} · {d.license_number}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <Field label="Notes (optional)">
                    <Input placeholder="Special instructions…" value={notes[b.id] || ""} onChange={e => setNotes(m => ({ ...m, [b.id]: e.target.value }))} />
                  </Field>
                  <Btn variant="primary" className="w-full" disabled={!ready} loading={dispatching[b.id]} onClick={() => dispatch(b.id)}>
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