// src/modules/fuel/pages/FuelRecordQueue.tsx
// Transport supervisor: approved requests → record actual litres/amount dispensed
// RPC: record_fuel_request(p_fuel_request_id, p_actual_liters?, p_actual_amount?, p_vendor?, p_notes?)
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { recordFuelRequest } from "../services/fuel.service";
import { fmtDate, fmtMoney } from "@/lib/utils";
import type { FuelRequest } from "../services/fuel.service";

type Enriched = FuelRequest & { plate_number: string; driver_name: string };
type RecordForm = { liters: string; amount: string; vendor: string; notes: string; acting: boolean };

export default function FuelRecordQueue() {
  const [rows,    setRows]    = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [forms,   setForms]   = useState<Record<string, RecordForm>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fuel_requests")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(200);

    const raw = (data ?? []) as FuelRequest[];
    const vehicleIds = [...new Set(raw.map(r => r.vehicle_id).filter(Boolean))];
    const driverIds  = [...new Set(raw.map(r => r.driver_id).filter(Boolean))] as string[];

    const [{ data: vehicles }, { data: drivers }] = await Promise.all([
      vehicleIds.length
        ? supabase.from("vehicles").select("id,plate_number").in("id", vehicleIds)
        : Promise.resolve({ data: [] }),
      driverIds.length
        ? supabase.from("drivers").select("id,full_name,license_number").in("id", driverIds)
        : Promise.resolve({ data: [] }),
    ]);

    const vMap = Object.fromEntries((vehicles ?? []).map((v: any) => [v.id, v.plate_number]));
    const dMap = Object.fromEntries((drivers  ?? []).map((d: any) => [d.id, d.full_name || d.license_number]));

    const enriched = raw.map(r => ({
      ...r,
      plate_number: vMap[r.vehicle_id] ?? "—",
      driver_name:  r.driver_id ? dMap[r.driver_id] ?? "—" : "—",
    }));
    setRows(enriched);

    // Pre-fill forms with estimated values from the request
    const initForms: Record<string, RecordForm> = {};
    enriched.forEach(r => {
      initForms[r.id] = {
        liters:  r.liters  != null ? String(r.liters)  : "",
        amount:  r.amount  != null ? String(r.amount)  : "",
        vendor:  r.vendor  ?? "",
        notes:   "",
        acting:  false,
      };
    });
    setForms(initForms);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patchForm = (id: string, patch: Partial<RecordForm>) =>
    setForms(m => ({ ...m, [id]: { ...m[id], ...patch } }));

  const record = async (id: string) => {
    const f = forms[id];
    patchForm(id, { acting: true });
    try {
      await recordFuelRequest(id, {
        actualLiters: f.liters ? parseFloat(f.liters) : null,
        actualAmount: f.amount ? parseFloat(f.amount) : null,
        vendor:       f.vendor.trim() || null,
        notes:        f.notes.trim()  || null,
      });
      await load();
    } catch (e: any) {
      alert(e.message ?? "Recording failed");
      patchForm(id, { acting: false });
    }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">Fuel Recording Queue</h1>
        <p className="page-sub">Record actual fuel dispensed for approved requests</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⛽</div>
          <p>No approved requests awaiting recording</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              background: "var(--green-dim)", color: "var(--green)",
              borderRadius: 9999, padding: "2px 10px", fontSize: 12, fontWeight: 600,
            }}>
              {rows.length}
            </span>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
              approved request{rows.length !== 1 ? "s" : ""} ready to record
            </span>
          </div>

          {/* Mobile cards */}
          <div className="block md:hidden space-y-3">
            {rows.map(r => {
              const f = forms[r.id] ?? { liters: "", amount: "", vendor: "", notes: "", acting: false };
              return (
                <div key={r.id} className="card" style={{ overflow: "hidden" }}>
                  <button
                    className="w-full text-left"
                    style={{ padding: "12px 16px", background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{r.purpose || "Fuel Request"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                          {r.plate_number} · {r.driver_name !== "—" ? r.driver_name : "No driver"} · {fmtDate(r.request_date)}
                        </div>
                      </div>
                      <span className="badge badge-approved">Approved</span>
                    </div>
                  </button>

                  {expanded === r.id && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }} className="space-y-3">
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Requested: {r.liters != null ? `${r.liters} L` : "—"} · Est. {r.amount != null ? fmtMoney(r.amount) : "—"} · {r.vendor || "No vendor"}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="form-label">Actual Litres</label>
                          <input className="tms-input" type="number" min="0" step="0.5"
                            value={f.liters} onChange={e => patchForm(r.id, { liters: e.target.value })} />
                        </div>
                        <div>
                          <label className="form-label">Actual Amount (GHS)</label>
                          <input className="tms-input" type="number" min="0" step="0.01"
                            value={f.amount} onChange={e => patchForm(r.id, { amount: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="form-label">Vendor / Station</label>
                        <input className="tms-input" placeholder="e.g. Shell, Total"
                          value={f.vendor} onChange={e => patchForm(r.id, { vendor: e.target.value })} />
                      </div>
                      <div>
                        <label className="form-label">Notes</label>
                        <textarea className="tms-textarea" rows={2} placeholder="Any remarks…"
                          value={f.notes} onChange={e => patchForm(r.id, { notes: e.target.value })} />
                      </div>
                      <button
                        className="btn btn-primary w-full"
                        disabled={f.acting}
                        onClick={() => record(r.id)}
                      >
                        {f.acting ? "Recording…" : "Mark as Recorded ✓"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block tms-table-wrap">
            <table className="tms-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Purpose</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Req. Litres</th>
                  <th>Actual Litres</th>
                  <th>Actual Amount</th>
                  <th>Vendor</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const f = forms[r.id] ?? { liters: "", amount: "", vendor: "", notes: "", acting: false };
                  return (
                    <tr key={r.id}>
                      <td>{fmtDate(r.request_date)}</td>
                      <td>{r.purpose || "—"}</td>
                      <td>{r.plate_number}</td>
                      <td>{r.driver_name}</td>
                      <td>{r.liters != null ? `${r.liters} L` : "—"}</td>
                      <td>
                        <input className="tms-input" type="number" min="0" step="0.5" style={{ width: 90 }}
                          value={f.liters} onChange={e => patchForm(r.id, { liters: e.target.value })} />
                      </td>
                      <td>
                        <input className="tms-input" type="number" min="0" step="0.01" style={{ width: 110 }}
                          value={f.amount} onChange={e => patchForm(r.id, { amount: e.target.value })} />
                      </td>
                      <td>
                        <input className="tms-input" style={{ width: 130 }} placeholder="Vendor"
                          value={f.vendor} onChange={e => patchForm(r.id, { vendor: e.target.value })} />
                      </td>
                      <td>
                        <input className="tms-input" style={{ width: 150 }} placeholder="Notes"
                          value={f.notes} onChange={e => patchForm(r.id, { notes: e.target.value })} />
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-success"
                          disabled={f.acting}
                          onClick={() => record(r.id)}
                        >
                          {f.acting ? "…" : "Record ✓"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}