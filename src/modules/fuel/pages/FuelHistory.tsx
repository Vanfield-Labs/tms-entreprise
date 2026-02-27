import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime, statusBadge } from "@/lib/utils";

const STATUS_FILTERS = ["all", "draft", "submitted", "approved", "rejected", "recorded"];

export default function FuelHistory() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("fuel_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search && !JSON.stringify(r).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-header">
        <h1 className="page-title">Fuel History</h1>
        <p className="page-sub">Complete log of all fuel requests</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="tms-input"
          style={{ maxWidth: 240 }}
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setStatusFilter(s)}>
              {s}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
          {filtered.length} records
        </span>
      </div>

      <div className="card">
        {loading ? <div className="loading-row">Loading...</div> : (
          <table className="tms-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Fuel</th>
                <th>Liters</th>
                <th>Est. Cost</th>
                <th>Actual Cost</th>
                <th>Purpose</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                  <td style={{ textTransform: "capitalize", fontSize: 12 }}>{r.fuel_type || "—"}</td>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{r.liters ?? "—"}</td>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                    {r.estimated_cost ? `GHS ${Number(r.estimated_cost).toLocaleString()}` : "—"}
                  </td>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: r.actual_cost ? "var(--green)" : "var(--text-dim)" }}>
                    {r.actual_cost ? `GHS ${Number(r.actual_cost).toLocaleString()}` : "—"}
                  </td>
                  <td style={{ fontSize: 12, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.purpose || "—"}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                    {fmtDateTime(r.created_at)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">No records found</div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
