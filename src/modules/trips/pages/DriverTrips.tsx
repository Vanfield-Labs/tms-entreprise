// src/modules/trips/pages/DriverTrips.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageSpinner, EmptyState, Badge, Card, Btn, TabBar } from "@/components/TmsUI";
import { fmtDate, fmtDateTime } from "@/lib/utils";

type Trip = {
  id: string; purpose: string; trip_date: string; trip_time: string;
  pickup_location: string; dropoff_location: string; status: string;
  vehicle_plate?: string;
};

type Tab = "active" | "done";

const ACTIVE = ["dispatched", "in_progress"];

export default function DriverTrips() {
  const { user }  = useAuth();
  const [trips,   setTrips]   = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<Record<string, boolean>>({});
  const [tab,     setTab]     = useState<Tab>("active");

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: dr } = await supabase.from("drivers").select("id").eq("user_id", user.id).single();
    if (!dr) { setLoading(false); return; }
    const { data } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status,vehicles(plate_number)")
      .eq("driver_id", (dr as any).id)
      .order("trip_date", { ascending: false })
      .limit(100);
    setTrips(((data as any[]) || []).map(b => ({ ...b, vehicle_plate: b.vehicles?.plate_number ?? null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const updateStatus = async (id: string, newStatus: string) => {
    setActing(m => ({ ...m, [id]: true }));
    try {
      await supabase.rpc("update_trip_status", { p_booking_id: id, p_new_status: newStatus });
      await load();
    } finally { setActing(m => ({ ...m, [id]: false })); }
  };

  const visible = tab === "active" ? trips.filter(t => ACTIVE.includes(t.status)) : trips.filter(t => !ACTIVE.includes(t.status));

  const tabs: { value: Tab; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "done",   label: "History" },
  ];

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <TabBar
        tabs={tabs}
        active={tab}
        onChange={setTab}
        counts={{ active: trips.filter(t => ACTIVE.includes(t.status)).length, done: trips.filter(t => !ACTIVE.includes(t.status)).length }}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={tab === "active" ? "No active trips" : "No trip history"}
          subtitle={tab === "active" ? "You have no dispatched trips assigned" : undefined}
        />
      ) : (
        <div className="space-y-3">
          {visible.map(t => (
            <Card key={t.id}>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[color:var(--text)] flex-1">{t.purpose}</h3>
                  <Badge status={t.status} />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-[color:var(--text-muted)]">{fmtDate(t.trip_date)} at {t.trip_time}</p>
                  <p className="text-xs text-[color:var(--text-muted)] truncate">{t.pickup_location} → {t.dropoff_location}</p>
                  {t.vehicle_plate && (
                    <p className="text-xs text-[color:var(--accent)] font-medium">🚗 {t.vehicle_plate}</p>
                  )}
                </div>

                {t.status === "dispatched" && (
                  <Btn variant="primary" className="w-full" loading={acting[t.id]} onClick={() => updateStatus(t.id, "in_progress")}>
                    Start Trip
                  </Btn>
                )}
                {t.status === "in_progress" && (
                  <Btn variant="success" className="w-full" loading={acting[t.id]} onClick={() => updateStatus(t.id, "completed")}>
                    Complete Trip ✓
                  </Btn>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}