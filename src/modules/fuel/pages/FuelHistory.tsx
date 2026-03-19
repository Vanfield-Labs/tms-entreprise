// src/modules/fuel/pages/FuelHistory.tsx
// Full fuel request audit trail — admin, transport_supervisor, corporate_approver
// RLS allows these roles to see all rows.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDate, fmtMoney } from "@/lib/utils";

type FuelStatus = "draft" | "submitted" | "approved" | "rejected" | "recorded";

type FuelRequest = {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  created_by: string | null;
  purpose: string | null;
  liters: number | null;
  amount: number | null;
  vendor: string | null;
  notes: string | null;
  status: FuelStatus;
  request_date: string | null;
  created_at: string;
};

type Enriched = FuelRequest & {
  plate_number: string;
  driver_name: string;
  requester_name: string;
};
const STATUS_BADGE: Record<FuelStatus, string> = {
  draft:     "badge badge-draft",
  submitted: "badge badge-submitted",
  approved:  "badge badge-approved",
  rejected:  "badge badge-rejected",
  recorded:  "badge badge-recorded",
};

const STATUS_OPTS: { value: FuelStatus | "all"; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "approved",  label: "Approved" },
  { value: "rejected",  label: "Rejected" },
  { value: "recorded",  label: "Recorded" },
  { value: "draft",     label: "Draft" },
];

export default function FuelHistory() {
  const [rows,    setRows]    = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState<FuelStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    let q = supabase
      .from("fuel_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (status !== "all") q = q.eq("status", status);

    const { data } = await q;
    const raw = (data ?? []) as FuelRequest[];

    const vehicleIds  = [...new Set(raw.map(r => r.vehicle_id).filter(Boolean))];
    const driverIds   = [...new Set(raw.map(r => r.driver_id).filter(Boolean))] as string[];
    const creatorIds  = [...new Set(raw.map(r => r.created_by).filter(Boolean))];

    const [{ data: vehicles }, { data: drivers }, { data: profiles }] = await Promise.all([
      vehicleIds.length
        ? supabase.from("vehicles").select("id,plate_number").in("id", vehicleIds)
        : Promise.resolve({ data: [] }),
      driverIds.length
        ? supabase.from("drivers").select("id,full_name,license_number").in("id", driverIds)
        : Promise.resolve({ data: [] }),
      creatorIds.length
        ? supabase.from("profiles").select("user_id,full_name").in("user_id", creatorIds)
        : Promise.resolve({ data: [] }),
    ]);

    const vMap = Object.fromEntries((vehicles ?? []).map((v: any) => [v.id, v.plate_number]));
    const dMap = Object.fromEntries((drivers  ?? []).map((d: any) => [d.id, d.full_name || d.license_number]));
    const pMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));

    setRows(raw.map(r => ({
      ...r,
      plate_number:   r.vehicle_id ? (vMap[r.vehicle_id] ?? "—") : "—",
      driver_name:    r.driver_id ? (dMap[r.driver_id] ?? "—") : "—",
      requester_name: r.created_by ? (pMap[r.created_by] ?? "—") : "—",
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [status]);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [r.purpose, r.plate_number, r.driver_name, r.requester_name, r.vendor, r.status]
      .some(f => f?.toLowerCase().includes(s));
  });

  // Summary stats
  const totalRecorded = rows.filter(r => r.status === "recorded");
  const totalLiters   = totalRecorded.reduce((s, r) => s + (r.liters  ?? 0), 0);
  const totalAmount   = totalRecorded.reduce((s, r) => s + (r.amount  ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">Fuel History</h1>
        <p className="page-sub">Complete fuel request audit trail</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Requests",  value: rows.length,                       },
          { label: "Recorded",        value: totalRecorded.length,              },
          { label: "Total Litres",    value: totalLiters > 0 ? `${totalLiters.toFixed(1)} L` : "—" },
          { label: "Total Amount",    value: totalAmount  > 0 ? fmtMoney(totalAmount) : "—"  },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="tms-input"
          style={{ maxWidth: 240 }}
          placeholder="Search purpose, vehicle, driver…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {STATUS_OPTS.map(o => (
            <button
              key={o.value}
              className={`btn btn-sm ${status === o.value ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setStatus(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No fuel records found</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="block md:hidden space-y-2">
            {filtered.map(r => (
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
                        {r.plate_number} · {fmtDate(r.request_date)}
                      </div>
                    </div>
                    <span className={STATUS_BADGE[r.status]}>{r.status}</span>
                  </div>
                </button>
                {expanded === r.id && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
                    <div className="grid grid-cols-2 gap-2" style={{ fontSize: 13 }}>
                      {[
                        ["Requester", r.requester_name],
                        ["Driver",    r.driver_name],
                        ["Litres",    r.liters  != null ? `${r.liters} L`    : "—"],
                        ["Amount",    r.amount  != null ? fmtMoney(r.amount) : "—"],
                        ["Vendor",    r.vendor  || "—"],
                        ["Submitted", fmtDate(r.created_at)],
                      ].map(([lbl, val]) => (
                        <div key={lbl}>
                          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{lbl}</div>
                          <div style={{ color: "var(--text)", fontWeight: 500 }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    {r.notes && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{r.notes}</p>}
                  </div>
                )}
              </div>
            ))}
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
                  <th>Requester</th>
                  <th>Litres</th>
                  <th>Amount</th>
                  <th>Vendor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.request_date)}</td>
                    <td>{r.purpose || "—"}</td>
                    <td>{r.plate_number}</td>
                    <td>{r.driver_name}</td>
                    <td>{r.requester_name}</td>
                    <td>{r.liters  != null ? `${r.liters} L`    : "—"}</td>
                    <td>{r.amount  != null ? fmtMoney(r.amount) : "—"}</td>
                    <td>{r.vendor  || "—"}</td>
                    <td><span className={STATUS_BADGE[r.status]}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}