// src/modules/bookings/pages/MyBookings.tsx — current-user filtered
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Booking = {
  id: string;
  purpose: string;
  trip_date: string;
  trip_time: string;
  pickup_location: string;
  dropoff_location: string;
  status: string;
  booking_type: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-50 text-blue-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  dispatched: "bg-purple-50 text-purple-700",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  closed: "bg-gray-100 text-gray-500",
};

const STATUS_ORDER = ["draft", "submitted", "approved", "dispatched", "in_progress", "completed", "closed", "rejected"];

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status,booking_type,created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setBookings((data as Booking[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const filtered = useMemo(() => {
    let rows = bookings;
    if (filter !== "all") rows = rows.filter((r) => r.status === filter);
    const s = q.trim().toLowerCase();
    if (s) rows = rows.filter((r) => [r.purpose, r.pickup_location, r.dropoff_location, r.booking_type].join(" ").toLowerCase().includes(s));
    return rows;
  }, [bookings, filter, q]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b) => { counts[b.status] = (counts[b.status] || 0) + 1; });
    return counts;
  }, [bookings]);

  const submit = async (id: string) => {
    await supabase.rpc("submit_booking", { p_booking_id: id });
    await load();
  };

  const activeStatuses = Object.keys(statusCounts).sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b));

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      {!loading && bookings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Total", value: bookings.length, key: "all" },
            { label: "Pending", value: (statusCounts.draft || 0) + (statusCounts.submitted || 0), key: "submitted" },
            { label: "Active", value: (statusCounts.approved || 0) + (statusCounts.dispatched || 0) + (statusCounts.in_progress || 0), key: "in_progress" },
            { label: "Completed", value: (statusCounts.completed || 0) + (statusCounts.closed || 0), key: "completed" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(filter === s.key ? "all" : s.key)}
              className={`text-left p-3 rounded-xl border transition-all ${filter === s.key ? "bg-black text-white border-black" : "bg-white border-gray-200 hover:border-gray-300"}`}
            >
              <div className={`text-xl font-bold ${filter === s.key ? "text-white" : "text-gray-900"}`}>{s.value}</div>
              <div className={`text-xs mt-0.5 ${filter === s.key ? "text-gray-300" : "text-gray-500"}`}>{s.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            placeholder="Search my bookings…" value={q} onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        <select
          value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none"
        >
          <option value="all">All statuses</option>
          {activeStatuses.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)} ({statusCounts[s]})</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : bookings.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No bookings match your filter.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{b.purpose}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{b.booking_type}</p>
                </div>
                <span className={`shrink-0 inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {b.status.replace("_", " ")}
                </span>
              </div>
              <div className="px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  {b.trip_date} at {b.trip_time}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                  <span className="truncate">{b.pickup_location} → {b.dropoff_location}</span>
                </div>
              </div>
              {b.status === "draft" && (
                <div className="px-4 pb-3">
                  <button onClick={() => submit(b.id)} className="w-full py-2 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors">
                    Submit for Approval →
                  </button>
                </div>
              )}
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

function EmptyState() {
  return (
    <div className="text-center py-16 text-gray-400">
      <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <p className="text-sm font-medium">No bookings yet</p>
      <p className="text-xs mt-1">Create your first booking using "New Booking"</p>
    </div>
  );
}