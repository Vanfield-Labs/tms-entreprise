import { useEffect, useState } from "react";
import { listMyFuelRequests } from "../services/fuel.service";
import { fmtDateTime, statusBadge } from "@/lib/utils";

export default function FuelRequests() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyFuelRequests().then(d => { setRows(d); setLoading(false); });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-header">
        <h1 className="page-title">My Fuel Requests</h1>
        <p className="page-sub">Track your submitted requests</p>
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
                <th>Purpose</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                  <td style={{ textTransform: "capitalize" }}>{r.fuel_type || "—"}</td>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{r.liters ?? "—"}</td>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                    {r.estimated_cost ? `GHS ${Number(r.estimated_cost).toLocaleString()}` : "—"}
                  </td>
                  <td style={{ fontSize: 12 }}>{r.purpose || "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {fmtDateTime(r.created_at)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state-icon">⛽</div>
                    <div>No fuel requests yet</div>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
