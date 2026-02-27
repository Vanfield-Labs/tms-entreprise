// src/modules/dispatch/pages/DispatchBoard.tsx — with real names
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Booking = { id: string; purpose: string; trip_date: string; trip_time: string; pickup_location: string; dropoff_location: string; status: string };
type Vehicle = { id: string; plate_number: string; status: string };
type DriverProfile = { driver_id: string; user_id: string; full_name: string; license_number: string };

export default function DispatchBoard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Record<string, string>>({});
  const [selectedDriver, setSelectedDriver] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dispatching, setDispatching] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: b }, { data: v }, { data: d }] = await Promise.all([
      supabase.from("bookings")
        .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status")
        .eq("status", "approved")
        .order("trip_date", { ascending: true }),
      supabase.from("vehicles")
        .select("id,plate_number,status")
        .eq("status", "active")
        .order("plate_number"),
      // Join drivers with profiles to get real names
      supabase.from("drivers")
        .select("id, user_id, license_number, profiles(full_name)")
        .order("license_number"),
    ]);

    setBookings((b as Booking[]) || []);
    setVehicles((v as Vehicle[]) || []);

    // Flatten driver + profile data
    const driverList: DriverProfile[] = ((d as any[]) || []).map((dr) => ({
      driver_id: dr.id,
      user_id: dr.user_id,
      full_name: dr.profiles?.full_name ?? `Driver ${dr.license_number}`,
      license_number: dr.license_number,
    }));
    setDrivers(driverList);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const dispatch = async (bookingId: string) => {
    const vehicleId = selectedVehicle[bookingId];
    const driverId = selectedDriver[bookingId];
    if (!vehicleId || !driverId) return;
    setDispatching((m) => ({ ...m, [bookingId]: true }));
    try {
      await supabase.rpc("dispatch_booking", {
        p_booking_id: bookingId,
        p_vehicle_id: vehicleId,
        p_driver_id: driverId,
        p_notes: notes[bookingId] || null,
      });
      await load();
    } finally {
      setDispatching((m) => ({ ...m, [bookingId]: false }));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="To Dispatch" value={bookings.length} color="text-blue-600" />
        <StatCard label="Vehicles Ready" value={vehicles.length} color="text-green-600" />
        <StatCard label="Drivers" value={drivers.length} color="text-purple-600" />
      </div>

      {bookings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const canDispatch = !!(selectedVehicle[b.id] && selectedDriver[b.id]);
            const isDispatching = dispatching[b.id];
            return (
              <div key={b.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 bg-green-50/60 border-b border-gray-100 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{b.purpose}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{b.trip_date} at {b.trip_time}</p>
                  </div>
                  <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Approved</span>
                </div>

                {/* Route */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-stretch gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <div className="w-2 h-2 rounded-full border-2 border-gray-400 bg-white"/>
                      <div className="w-0.5 flex-1 bg-gray-200 min-h-[20px]"/>
                      <div className="w-2 h-2 rounded-full bg-black"/>
                    </div>
                    <div className="flex flex-col justify-between gap-2">
                      <p className="text-xs text-gray-500">{b.pickup_location}</p>
                      <p className="text-xs font-medium text-gray-900">{b.dropoff_location}</p>
                    </div>
                  </div>
                </div>

                {/* Assignment form */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Vehicle *</label>
                      <select
                        value={selectedVehicle[b.id] || ""}
                        onChange={(e) => setSelectedVehicle((m) => ({ ...m, [b.id]: e.target.value }))}
                        className={selectCls}
                      >
                        <option value="">Select vehicle…</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>{v.plate_number}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Driver *</label>
                      <select
                        value={selectedDriver[b.id] || ""}
                        onChange={(e) => setSelectedDriver((m) => ({ ...m, [b.id]: e.target.value }))}
                        className={selectCls}
                      >
                        <option value="">Select driver…</option>
                        {drivers.map((d) => (
                          <option key={d.driver_id} value={d.driver_id}>
                            {d.full_name} · {d.license_number}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Notes (optional)</label>
                    <input
                      placeholder="Special instructions…"
                      value={notes[b.id] || ""}
                      onChange={(e) => setNotes((m) => ({ ...m, [b.id]: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <button
                    onClick={() => dispatch(b.id)}
                    disabled={!canDispatch || isDispatching}
                    className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isDispatching ? "Dispatching…" : "Dispatch →"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

const selectCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10";
const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10";

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>;
}

function EmptyState() {
  return (
    <div className="text-center py-16 text-gray-400">
      <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
      </svg>
      <p className="text-sm">No approved bookings to dispatch</p>
    </div>
  );
}