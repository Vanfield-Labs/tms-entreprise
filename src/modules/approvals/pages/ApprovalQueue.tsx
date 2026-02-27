// src/modules/approvals/pages/ApprovalQueue.tsx — mobile-first
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Booking = {
  id: string;
  purpose: string;
  trip_date: string;
  trip_time: string;
  pickup_location: string;
  dropoff_location: string;
  status: string;
  created_by: string;
};

export default function ApprovalQueue() {
  const [items, setItems] = useState<Booking[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status,created_by")
      .eq("status", "submitted")
      .order("created_at", { ascending: false });
    setItems((data as Booking[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const act = async (bookingId: string, action: "approved" | "rejected") => {
    setActing((m) => ({ ...m, [bookingId]: true }));
    try {
      await supabase.rpc("approve_booking", { p_booking_id: bookingId, p_action: action, p_comment: comment[bookingId] || null });
      await load();
    } finally {
      setActing((m) => ({ ...m, [bookingId]: false }));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">{items.length}</span>
            <span className="text-sm text-gray-600">pending approval{items.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-4">
            {items.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-blue-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-gray-900">{b.purpose}</h3>
                    <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">Pending</span>
                  </div>
                </div>

                <div className="px-4 py-3 space-y-2 border-b border-gray-100">
                  <InfoRow icon="calendar" label={`${b.trip_date} at ${b.trip_time}`} />
                  <InfoRow icon="location" label={`${b.pickup_location} → ${b.dropoff_location}`} />
                </div>

                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Comment (optional)</label>
                    <input
                      placeholder="Add a comment…"
                      value={comment[b.id] || ""}
                      onChange={(e) => setComment((m) => ({ ...m, [b.id]: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => act(b.id, "rejected")}
                      disabled={acting[b.id]}
                      className="py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => act(b.id, "approved")}
                      disabled={acting[b.id]}
                      className="py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40"
                    >
                      {acting[b.id] ? "…" : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ icon, label }: { icon: "calendar" | "location"; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      {icon === "calendar" ? (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      ) : (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
      )}
      <span>{label}</span>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>;
}

function EmptyState() {
  return (
    <div className="text-center py-16 text-gray-400">
      <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p className="text-sm">All caught up — no pending approvals</p>
    </div>
  );
}
