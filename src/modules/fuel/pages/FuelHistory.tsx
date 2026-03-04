// src/modules/fuel/pages/FuelHistory.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, SearchInput } from "@/components/TmsUI";
import { fmtDateTime, fmtMoney } from "@/lib/utils";

const STATUS_OPTS = ["all","draft","submitted","approved","rejected","recorded"];

export default function FuelHistory() {
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState("");
  const [status,  setStatus]  = useState("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("fuel_requests").select("*").order("created_at", { ascending: false }).limit(500);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => {
    const matchQ = !q || (r.purpose ?? "").toLowerCase().includes(q.toLowerCase());
    const matchS = status === "all" || r.status === status;
    return matchQ && matchS;
  });

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput value={q} onChange={setQ} placeholder="Search purpose…" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="tms-select sm:w-40">
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      <p className="text-xs text-[color:var(--text-muted)]">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p>

      {filtered.length === 0 ? (
        <EmptyState title="No records found" subtitle="Try adjusting your filters" />
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {filtered.map(r => (
              <Card key={r.id}>
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[color:var(--text)] flex-1">{r.purpose || "—"}</p>
                    <Badge status={r.status} />
                  </div>
                  <div className="flex gap-4 text-xs text-[color:var(--text-muted)]">
                    <span>{r.fuel_type ?? "—"}</span>
                    <span>{r.liters ?? "—"}L</span>
                    <span>{fmtMoney(r.actual_cost ?? r.estimated_cost)}</span>
                  </div>
                  <p className="text-xs text-[color:var(--text-dim)]">{fmtDateTime(r.created_at)}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr>{["Purpose","Type","Litres","Est.","Actual","Status","Date"].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td className="max-w-[160px] truncate font-medium">{r.purpose || "—"}</td>
                      <td className="capitalize">{r.fuel_type ?? "—"}</td>
                      <td>{r.liters ?? "—"}</td>
                      <td>{fmtMoney(r.estimated_cost)}</td>
                      <td>{fmtMoney(r.actual_cost)}</td>
                      <td><Badge status={r.status} /></td>
                      <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDateTime(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}