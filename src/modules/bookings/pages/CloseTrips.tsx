// src/modules/bookings/pages/CloseTrips.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, CountPill, Btn } from "@/components/TmsUI";
import { fmtDate, fmtDateTime } from "@/lib/utils";

type Booking = {
  id: string; purpose: string; trip_date: string; trip_time: string;
  pickup_location: string; dropoff_location: string;
  status: string; created_at: string;
  vehicle_plate?: string; driver_name?: string;
};

export default function CloseTrips() {
  const [trips,   setTrips]   = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status,created_at,vehicles(plate_number),drivers(profiles(full_name))")
      .eq("status", "completed")
      .order("trip_date", { ascending: false })
      .limit(100);
    setTrips(((data as any[]) || []).map(b => ({
      ...b,
      vehicle_plate: b.vehicles?.plate_number ?? null,
      driver_name:   b.drivers?.profiles?.full_name ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const close = async (id: string) => {
    setClosing(m => ({ ...m, [id]: true }));
    try {
      await supabase.rpc("close_booking", { p_booking_id: id });
      await load();
    } finally { setClosing(m => ({ ...m, [id]: false })); }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {trips.length === 0 ? (
        <EmptyState
          title="No completed trips"
          subtitle="Trips marked as completed will appear here for closing"
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7"/></svg>}
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <CountPill n={trips.length} color="green" />
            <span className="text-sm text-[color:var(--text-muted)]">trip{trips.length !== 1 ? "s" : ""} ready to close</span>
          </div>

          <div className="space-y-3">
            {trips.map(t => (
              <Card key={t.id}>
                <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--green)]/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[color:var(--text)]">{t.purpose}</p>
                      <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{fmtDate(t.trip_date)} at {t.trip_time}</p>
                    </div>
                    <Badge status={t.status} />
                  </div>
                </div>

                <div className="px-4 py-3 space-y-1.5 border-b border-[color:var(--border)]">
                  <p className="text-xs text-[color:var(--text-muted)] truncate">{t.pickup_location} → {t.dropoff_location}</p>
                  {t.vehicle_plate && <p className="text-xs text-[color:var(--accent)]">🚗 {t.vehicle_plate}</p>}
                  {t.driver_name && <p className="text-xs text-[color:var(--text-muted)]">👤 {t.driver_name}</p>}
                </div>

                <div className="p-4">
                  <Btn variant="primary" className="w-full" loading={closing[t.id]} onClick={() => close(t.id)}>
                    Close Trip ✓
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}