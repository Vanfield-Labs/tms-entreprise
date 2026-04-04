// src/modules/bookings/pages/BookingsTable.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, SearchInput } from "@/components/TmsUI";
import { usePagination, PaginationBar } from "@/hooks/usePagination";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useFlashHighlight } from "@/hooks/useFlashHighlight";

type Booking = {
  id: string; purpose: string; trip_date: string; trip_time: string;
  pickup_location: string; dropoff_location: string;
  status: string; created_at: string; booking_type: string;
};

const STATUS_OPTS = ["all", "draft", "finance_pending", "submitted", "approved", "rejected", "dispatched", "completed", "closed"];

export default function BookingsTable() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status,created_at,booking_type")
      .order("created_at", { ascending: false })
      .limit(500);

    setRows((data as Booking[]) || []);
    setLoading(false);
  };
const { flashIds, flash } = useFlashHighlight();
  const [rtMessage, setRtMessage] = useState<string | null>(null);
  
  function showRealtimeMessage(message: string) {
    setRtMessage(message);
    window.clearTimeout((showRealtimeMessage as any)._t);
    (showRealtimeMessage as any)._t = window.setTimeout(() => {
      setRtMessage(null);
    }, 2500);
  }


  useEffect(() => {
    load();
  }, []);

  useRealtimeRefresh({
    channel: "bookings_realtime_ui",
    tables: ["bookings"],
    onRefresh: load,
  });

  const filtered = rows.filter(r => {
    const matchQ = !q || [r.purpose, r.pickup_location, r.dropoff_location].join(" ").toLowerCase().includes(q.toLowerCase());
    const matchS = status === "all" || r.status === status;
    return matchQ && matchS;
  });

  const pg = usePagination(filtered);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {rtMessage && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className="rounded-2xl border px-4 py-3 shadow-lg text-sm"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text)",
              minWidth: 220,
            }}
          >
            {rtMessage}
          </div>
        </div>
      )}
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput value={q} onChange={setQ} placeholder="Search purpose or location\u2026" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="tms-select sm:w-40">
            {STATUS_OPTS.map(s => (
              <option key={s} value={s}>
                {s === "all"
                  ? "All statuses"
                  : s.replace(/_/g, " ").charAt(0).toUpperCase() + s.replace(/_/g, " ").slice(1)}
              </option>
            ))}
        </select>
      </div>

      <p className="text-xs text-[color:var(--text-muted)]">{filtered.length} booking{filtered.length !== 1 ? "s" : ""}</p>

      {filtered.length === 0 ? (
        <EmptyState title="No bookings found" subtitle="Try adjusting your filters" />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {pg.slice.map(b => (
              <Card key={b.id}>
                <div
                  className="p-4 space-y-2 rounded-[inherit]"
                  style={{
                    transition: "all 0.4s ease",
                    boxShadow: flashIds[b.id]
                      ? "0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent)"
                      : undefined,
                    background: flashIds[b.id]
                      ? "color-mix(in srgb, var(--accent) 8%, var(--surface))"
                      : undefined,
                  }}
                >
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[color:var(--text)] flex-1">{b.purpose}</p>
                      <Badge status={b.status} />
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)]">{fmtDate(b.trip_date)} at {b.trip_time}</p>
                    <p className="text-xs text-[color:var(--text-muted)] truncate">{b.pickup_location} \u2192 {b.dropoff_location}</p>
                    <p className="text-xs text-[color:var(--text-dim)]">{fmtDateTime(b.created_at)}</p>
                  </div>
                </div>
              </Card>
            ))}
            <PaginationBar {...pg} />
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr>
                    {["Purpose", "Date", "Route", "Type", "Status", "Created"].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pg.slice.map(b => (
                    <tr
                      key={b.id}
                      style={{
                        transition: "all 0.4s ease",
                        background: flashIds[b.id]
                          ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                          : undefined,
                      }}
                    >
                      <td className="font-medium max-w-[200px] truncate">{b.purpose}</td>
                      <td className="whitespace-nowrap">{fmtDate(b.trip_date)} {b.trip_time}</td>
                      <td className="max-w-[180px]">
                        <p className="truncate text-xs text-[color:var(--text-muted)]">{b.pickup_location}</p>
                        <p className="truncate text-xs font-medium">{b.dropoff_location}</p>
                      </td>
                      <td className="capitalize text-[color:var(--text-muted)]">{b.booking_type}</td>
                      <td><Badge status={b.status} /></td>
                      <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDateTime(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar {...pg} />
          </div>
        </>
      )}
    </div>
  );
}
