// src/modules/shifts/pages/MyShifts.tsx — filtered to current driver
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Row = { driver_id: string; shift_date: string; effective_shift_code: string; base_shift_code: string; override_shift_code: string | null };

const SHIFT_BADGE: Record<string, string> = {
  OFF: "bg-gray-100 text-gray-500",
  REST: "bg-gray-100 text-gray-500",
};

function shiftBadge(code: string) {
  return SHIFT_BADGE[code] ?? "bg-blue-50 text-blue-700";
}

export default function MyShifts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      // Get driver record for this user
      const { data: dr } = await supabase.from("drivers").select("id").eq("user_id", user.id).single();
      if (!dr) { setLoading(false); return; }
      setDriverId(dr.id);

      const { data } = await supabase
        .from("v_driver_shifts")
        .select("driver_id,shift_date,effective_shift_code,base_shift_code,override_shift_code")
        .eq("driver_id", dr.id)
        .order("shift_date", { ascending: true });
      setRows((data as Row[]) || []);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) return <LoadingSpinner />;

  if (!driverId) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">No driver profile linked to your account.</p>
        <p className="text-xs mt-1">Contact your transport supervisor.</p>
      </div>
    );
  }

  // Group by week
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rows.filter((r) => r.shift_date >= today);
  const past = rows.filter((r) => r.shift_date < today);

  return (
    <div className="space-y-6">
      {/* Today highlight */}
      {(() => {
        const todayShift = rows.find((r) => r.shift_date === today);
        return (
          <div className={`rounded-2xl p-5 ${todayShift ? "bg-black text-white" : "bg-white border border-gray-200"}`}>
            <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${todayShift ? "text-gray-400" : "text-gray-400"}`}>Today</p>
            {todayShift ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{todayShift.effective_shift_code}</p>
                  <p className="text-sm text-gray-400 mt-1">{new Date(today + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long" })}</p>
                  {todayShift.override_shift_code && (
                    <p className="text-xs text-amber-400 mt-1">⚠ Override applied (was {todayShift.base_shift_code})</p>
                  )}
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No shift data for today</p>
            )}
          </div>
        );
      })()}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <ShiftSection title="Upcoming" rows={upcoming.filter((r) => r.shift_date !== today)} />
      )}

      {/* Past */}
      {past.length > 0 && (
        <ShiftSection title="Past" rows={[...past].reverse()} muted />
      )}
    </div>
  );
}

function ShiftSection({ title, rows, muted }: { title: string; rows: Row[]; muted?: boolean }) {
  const [expanded, setExpanded] = useState(!muted);
  if (rows.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <h3 className="font-semibold text-gray-900 text-sm">{title} <span className="text-gray-400 font-normal">({rows.length})</span></h3>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {expanded && (
        <div className="divide-y divide-gray-50">
          {rows.map((r, i) => (
            <div key={i} className={`flex items-center justify-between px-5 py-3 ${muted ? "opacity-60" : ""}`}>
              <div>
                <p className="text-sm text-gray-900">
                  {new Date(r.shift_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}
                </p>
                {r.override_shift_code && (
                  <p className="text-[10px] text-amber-600 mt-0.5">Override applied</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {r.override_shift_code && (
                  <span className="text-xs text-gray-300 line-through">{r.base_shift_code}</span>
                )}
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${shiftBadge(r.effective_shift_code)}`}>
                  {r.effective_shift_code}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>;
}