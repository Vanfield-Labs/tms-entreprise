// src/modules/fuel/pages/FuelMileageLog.tsx
// Reads from: fuel_mileage_log (vehicle_id, fuel_request_id, mileage_at_fueling, recorded_by, recorded_at)
// Joins: vehicles (plate_number, make, model, current_mileage), fuel_requests (purpose, liters, amount)
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/utils";
import { PageSpinner, SearchInput, Badge } from "@/components/TmsUI";

// ── Types ─────────────────────────────────────────────────────────────────────
type MileageEntry = {
  id: string;
  vehicle_id: string | null;
  fuel_request_id: string | null;
  mileage_at_fueling: number;
  recorded_by: string | null;
  recorded_at: string | null;
  // joined
  plate_number?: string | null;
  vehicle_label?: string | null;
  current_mileage?: number | null;
  purpose?: string | null;
  liters?: number | null;
  amount?: number | null;
  recorder_name?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtKm(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString() + " km";
}

function fmtGhs(n: number | null | undefined) {
  if (n == null) return "—";
  return "GHS " + Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function efficiencyBadge(mpkm: number | null) {
  if (mpkm == null) return null;
  if (mpkm < 5)  return { label: "Low",    cls: "bg-red-100 text-red-700"    };
  if (mpkm < 10) return { label: "Normal", cls: "bg-amber-100 text-amber-700" };
  return                 { label: "Good",  cls: "bg-emerald-100 text-emerald-700" };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FuelMileageLog() {
  const [entries,   setEntries]   = useState<MileageEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [vehicles,  setVehicles]  = useState<{ id: string; plate_number: string; label: string }[]>([]);
  const [expanded,  setExpanded]  = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    // Load log
    const { data: logData } = await supabase
      .from("fuel_mileage_log")
      .select("id,vehicle_id,fuel_request_id,mileage_at_fueling,recorded_by,recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(300);

    if (!logData || logData.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const log = logData as MileageEntry[];

    // Collect unique IDs
    const vehicleIds   = [...new Set(log.map(e => e.vehicle_id).filter(Boolean))] as string[];
    const fuelReqIds   = [...new Set(log.map(e => e.fuel_request_id).filter(Boolean))] as string[];
    const recorderIds  = [...new Set(log.map(e => e.recorded_by).filter(Boolean))] as string[];

    // Parallel fetches
    const [{ data: vData }, { data: fData }, { data: pData }] = await Promise.all([
      vehicleIds.length
        ? supabase.from("vehicles").select("id,plate_number,make,model,current_mileage").in("id", vehicleIds)
        : Promise.resolve({ data: [] }),
      fuelReqIds.length
        ? supabase.from("fuel_requests").select("id,purpose,liters,amount").in("id", fuelReqIds)
        : Promise.resolve({ data: [] }),
      recorderIds.length
        ? supabase.from("profiles").select("user_id,full_name").in("user_id", recorderIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Build lookup maps
    const vehicleMap: Record<string, { plate_number: string; label: string; current_mileage: number | null }> = {};
    ((vData ?? []) as any[]).forEach(v => {
      vehicleMap[v.id] = {
        plate_number:    v.plate_number,
        label:           [v.plate_number, v.make, v.model].filter(Boolean).join(" · "),
        current_mileage: v.current_mileage,
      };
    });

    const fuelMap: Record<string, { purpose: string | null; liters: number | null; amount: number | null }> = {};
    ((fData ?? []) as any[]).forEach(f => {
      fuelMap[f.id] = { purpose: f.purpose, liters: f.liters, amount: f.amount };
    });

    const profileMap: Record<string, string> = {};
    ((pData ?? []) as any[]).forEach(p => { profileMap[p.user_id] = p.full_name; });

    // Enrich entries
    const enriched: MileageEntry[] = log.map(e => ({
      ...e,
      plate_number:    e.vehicle_id ? vehicleMap[e.vehicle_id]?.plate_number ?? null : null,
      vehicle_label:   e.vehicle_id ? vehicleMap[e.vehicle_id]?.label ?? null : null,
      current_mileage: e.vehicle_id ? vehicleMap[e.vehicle_id]?.current_mileage ?? null : null,
      purpose:         e.fuel_request_id ? fuelMap[e.fuel_request_id]?.purpose ?? null : null,
      liters:          e.fuel_request_id ? fuelMap[e.fuel_request_id]?.liters ?? null : null,
      amount:          e.fuel_request_id ? fuelMap[e.fuel_request_id]?.amount ?? null : null,
      recorder_name:   e.recorded_by ? profileMap[e.recorded_by] ?? null : null,
    }));

    setEntries(enriched);

    // Build vehicle list for filter
    const uniqueVehicles = vehicleIds.map(id => ({
      id,
      plate_number: vehicleMap[id]?.plate_number ?? id,
      label:        vehicleMap[id]?.label ?? id,
    })).sort((a, b) => a.plate_number.localeCompare(b.plate_number));
    setVehicles(uniqueVehicles);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = entries.filter(e => {
    const matchVehicle = vehicleFilter === "all" || e.vehicle_id === vehicleFilter;
    const matchSearch  = !search || [e.plate_number, e.purpose, e.recorder_name]
      .join(" ").toLowerCase().includes(search.toLowerCase());
    return matchVehicle && matchSearch;
  });

  // Stats
  const totalEntries = filtered.length;
  const totalLiters  = filtered.reduce((s, e) => s + (e.liters ?? 0), 0);
  const totalSpend   = filtered.reduce((s, e) => s + (e.amount ?? 0), 0);

  // Per-vehicle summary for selected filter
  const selectedVehicle = vehicles.find(v => v.id === vehicleFilter);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Fuel & Mileage Log</h1>
        <p className="page-sub">Track mileage recorded at each fueling event</p>
      </div>

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="stat-card">
            <div className="stat-label">Entries</div>
            <div className="stat-value">{totalEntries}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Litres</div>
            <div className="stat-value" style={{ color: "var(--accent)" }}>
              {totalLiters > 0 ? totalLiters.toFixed(1) + "L" : "—"}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Spend</div>
            <div className="stat-value" style={{ color: "var(--green)" }}>
              {totalSpend > 0 ? fmtGhs(totalSpend) : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search plate, purpose, recorder…"
        />
        <select
          className="tms-select sm:w-56"
          value={vehicleFilter}
          onChange={e => setVehicleFilter(e.target.value)}
        >
          <option value="all">All Vehicles</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.plate_number}</option>
          ))}
        </select>
        {entries.length > 0 && (
          <span className="text-xs self-center font-mono px-2 py-1 rounded-lg"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
            {filtered.length} records
          </span>
        )}
      </div>

      {/* Vehicle mileage summary (when filtered to one vehicle) */}
      {vehicleFilter !== "all" && selectedVehicle && !loading && (
        <div className="card px-5 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                {vehicles.find(v => v.id === vehicleFilter)?.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {filtered.length} fueling events
              </p>
            </div>
            {filtered.length > 0 && (
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>First recorded</div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {fmtKm(filtered[filtered.length - 1].mileage_at_fueling)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>Latest recorded</div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {fmtKm(filtered[0].mileage_at_fueling)}
                  </div>
                </div>
                {filtered.length >= 2 && (
                  <div className="text-center">
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Distance spanned</div>
                    <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                      {fmtKm(filtered[0].mileage_at_fueling - filtered[filtered.length - 1].mileage_at_fueling)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <PageSpinner variant="table" rows={6} cols={6} />
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">⛽</div>
            <div>{entries.length === 0 ? "No mileage logs yet" : "No records match this filter"}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              Mileage is logged when fuel is recorded by transport supervisor
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map(e => {
              const isExpanded = expanded === e.id;
              // Compute efficiency: km/L based on adjacent entries
              return (
                <div
                  key={e.id}
                  className="card overflow-hidden cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : e.id)}
                >
                  <div className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                        {e.plate_number ?? "Unknown Vehicle"}
                      </p>
                      <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--accent)" }}>
                        📍 {fmtKm(e.mileage_at_fueling)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {fmtDateTime(e.recorded_at ?? "")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {e.liters != null && (
                        <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{e.liters}L</div>
                      )}
                      {e.amount != null && (
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtGhs(e.amount)}</div>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-1.5 border-t" style={{ borderColor: "var(--border)" }}>
                      {e.purpose && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          <span className="font-semibold">Purpose:</span> {e.purpose}
                        </p>
                      )}
                      {e.recorder_name && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          <span className="font-semibold">Recorded by:</span> {e.recorder_name}
                        </p>
                      )}
                      {e.current_mileage != null && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          <span className="font-semibold">Vehicle current mileage:</span> {fmtKm(e.current_mileage)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="card hidden sm:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Mileage at Fueling</th>
                    <th>Litres</th>
                    <th>Amount</th>
                    <th>Purpose</th>
                    <th>Recorded By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id}>
                      <td>
                        <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                          {e.plate_number ?? "—"}
                        </div>
                        {e.vehicle_label && e.vehicle_label !== e.plate_number && (
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{e.vehicle_label}</div>
                        )}
                      </td>
                      <td>
                        <span className="font-mono font-semibold text-sm" style={{ color: "var(--accent)" }}>
                          {fmtKm(e.mileage_at_fueling)}
                        </span>
                      </td>
                      <td>{e.liters != null ? `${e.liters}L` : "—"}</td>
                      <td>{fmtGhs(e.amount)}</td>
                      <td className="max-w-[160px] truncate text-xs" style={{ color: "var(--text-muted)" }}>
                        {e.purpose ?? "—"}
                      </td>
                      <td className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {e.recorder_name ?? "—"}
                      </td>
                      <td className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {fmtDateTime(e.recorded_at ?? "")}
                      </td>
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
