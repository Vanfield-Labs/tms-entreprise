// src/modules/trips/pages/DriverTrips.tsx — mobile-first
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Trip = { id: string; purpose: string; trip_date: string; trip_time: string; pickup_location: string; dropoff_location: string; status: string };

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  dispatched: { label: "Dispatched", color: "bg-violet-50 text-violet-700", dot: "bg-violet-400" },
  in_progress: { label: "In Progress", color: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  completed: { label: "Completed", color: "bg-green-50 text-green-700", dot: "bg-green-400" },
};

export default function DriverTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status")
      .in("status", ["dispatched", "in_progress", "completed"])
      .order("trip_date", { ascending: true });
    setTrips((data as Trip[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (bookingId: string, newStatus: "in_progress" | "completed") => {
    setActing((m) => ({ ...m, [bookingId]: true }));
    try {
      await supabase.rpc("update_trip_status", { p_booking_id: bookingId, p_new_status: newStatus });
      await load();
    } finally {
      setActing((m) => ({ ...m, [bookingId]: false }));
    }
  };

  if (loading) return <LoadingSpinner />;

  const active = trips.filter((t) => t.status !== "completed");
  const completed = trips.filter((t) => t.status === "completed");

  return (
    <div className="space-y-6">
      {trips.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
          </svg>
          <p className="text-sm font-medium">No trips assigned yet</p>
          <p className="text-xs mt-1">Your dispatched trips will appear here</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Trips</h2>
              {active.map((t) => <TripCard key={t.id} trip={t} onAction={setStatus} loading={acting[t.id]} />)}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed</h2>
              {completed.map((t) => <TripCard key={t.id} trip={t} onAction={setStatus} loading={acting[t.id]} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TripCard({ trip: t, onAction, loading }: {
  trip: Trip;
  onAction: (id: string, status: "in_progress" | "completed") => void;
  loading?: boolean;
}) {
  const sc = STATUS_CONFIG[t.status] || { label: t.status, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  const isCompleted = t.status === "completed";

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${isCompleted ? "border-gray-100 opacity-75" : "border-gray-200"}`}>
      {/* Status bar */}
      <div className={`h-1 ${sc.dot}`} />

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm text-gray-900">{t.purpose}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{t.trip_date} at {t.trip_time}</p>
          </div>
          <span className={`shrink-0 inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
        </div>

        {/* Route visualization */}
        <div className="flex items-stretch gap-3 py-1">
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-400 bg-white" />
            <div className="w-0.5 flex-1 bg-gray-200 min-h-[24px]" />
            <div className="w-2.5 h-2.5 rounded-full bg-black" />
          </div>
          <div className="flex-1 flex flex-col justify-between py-0.5">
            <p className="text-xs text-gray-500">{t.pickup_location}</p>
            <p className="text-xs font-medium text-gray-900">{t.dropoff_location}</p>
          </div>
        </div>

        {/* Action */}
        {!isCompleted && (
          t.status === "dispatched" ? (
            <button
              onClick={() => onAction(t.id, "in_progress")}
              disabled={loading}
              className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
              {loading ? "…" : "Start Trip →"}
            </button>
          ) : t.status === "in_progress" ? (
            <button
              onClick={() => onAction(t.id, "completed")}
              disabled={loading}
              className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40"
            >
              {loading ? "…" : "Complete Trip ✓"}
            </button>
          ) : null
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>;
}
