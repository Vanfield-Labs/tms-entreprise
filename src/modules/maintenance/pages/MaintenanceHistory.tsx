// src/modules/maintenance/pages/MaintenanceHistory.tsx
// Shows maintenance history per vehicle with drill-in details
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { PageSpinner } from "@/components/TmsUI";

type Vehicle = { id: string; plate_number: string; make?: string; model?: string };
type Request = {
  id: string;
  vehicle_id: string;
  issue_type: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  closed_at?: string;
  notes?: string;
};

const STATUS_STYLES: Record<string, Record<string, string>> = {
  reported: { background: "var(--amber-dim)", color: "var(--amber)" },
  finance_pending: {
    background: "color-mix(in srgb, var(--accent-dim) 65%, var(--surface))",
    color: "var(--accent)",
  },
  finance_rejected: { background: "var(--red-dim)", color: "var(--red)" },
  approved: {
    background: "color-mix(in srgb, var(--accent-dim) 80%, var(--surface))",
    color: "var(--accent)",
  },
  in_progress: {
    background: "color-mix(in srgb, var(--purple) 16%, var(--surface))",
    color: "var(--purple)",
  },
  completed: { background: "var(--green-dim)", color: "var(--green)" },
  closed: { background: "var(--surface-2)", color: "var(--text-muted)" },
  rejected: { background: "var(--red-dim)", color: "var(--red)" },
};

const PRIORITY_STYLES: Record<string, Record<string, string>> = {
  low: {
    background: "color-mix(in srgb, var(--green-dim) 70%, var(--surface))",
    color: "var(--green)",
    borderColor: "color-mix(in srgb, var(--green) 30%, var(--border))",
  },
  medium: {
    background: "var(--amber-dim)",
    color: "var(--amber)",
    borderColor: "color-mix(in srgb, var(--amber) 35%, var(--border))",
  },
  high: {
    background: "color-mix(in srgb, var(--amber-dim) 85%, var(--surface))",
    color: "var(--amber)",
    borderColor: "color-mix(in srgb, var(--amber) 45%, var(--border))",
  },
  critical: {
    background: "var(--red-dim)",
    color: "var(--red)",
    borderColor: "color-mix(in srgb, var(--red) 35%, var(--border))",
  },
};

export default function MaintenanceHistory() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: v }, { data: r }] = await Promise.all([
        supabase.from("vehicles").select("id,plate_number,make,model").order("plate_number"),
        supabase
          .from("maintenance_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(400),
      ]);
      setVehicles((v as Vehicle[]) || []);
      setRequests((r as Request[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = requests.filter((r) => {
    const matchVehicle = selectedVehicle === "all" || r.vehicle_id === selectedVehicle;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchSearch = !search || [r.issue_type, r.description, r.status].join(" ").toLowerCase().includes(search.toLowerCase());
    return matchVehicle && matchStatus && matchSearch;
  });

  const vehicleMap: Record<string, Vehicle> = {};
  vehicles.forEach((v) => { vehicleMap[v.id] = v; });

  // Stats for selected vehicle
  const vehicleRequests = selectedVehicle === "all" ? requests : requests.filter((r) => r.vehicle_id === selectedVehicle);
  const stats = {
    total: vehicleRequests.length,
    open: vehicleRequests.filter((r) => !["closed", "finance_rejected", "rejected"].includes(r.status)).length,
    closed: vehicleRequests.filter((r) => r.status === "closed").length,
    critical: vehicleRequests.filter((r) => r.priority === "critical").length,
  };

  if (loading) return <PageSpinner variant="table" rows={8} cols={6} />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">Maintenance History</h1>
        <p className="page-sub">Full maintenance record per vehicle</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "var(--text)" },
          { label: "Open", value: stats.open, color: "var(--amber)" },
          { label: "Closed", value: stats.closed, color: "var(--green)" },
          { label: "Critical", value: stats.critical, color: "var(--red)" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border px-4 py-3 text-center"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="tms-select"
          style={{ maxWidth: 220 }}
          value={selectedVehicle}
          onChange={(e) => setSelectedVehicle(e.target.value)}
        >
          <option value="all">All Vehicles</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate_number}{v.make ? ` — ${v.make} ${v.model || ""}`.trim() : ""}
            </option>
          ))}
        </select>
        <select
          className="tms-select"
          style={{ maxWidth: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          {["reported", "finance_pending", "finance_rejected", "approved", "in_progress", "completed", "closed", "rejected"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <input
          className="tms-input"
          style={{ maxWidth: 200 }}
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs font-mono ml-auto" style={{ color: "var(--text-dim)" }}>{filtered.length} records</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-dim)" }}>
          <div className="text-3xl mb-2">🔧</div>
          <p className="text-sm">No maintenance records found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const vehicle = vehicleMap[r.vehicle_id];
            const isOpen = expanded === r.id;
            const priorityStyle = PRIORITY_STYLES[r.priority] ?? {
              background: "var(--surface-2)",
              color: "var(--text-muted)",
              borderColor: "var(--border)",
            };
            const statusStyle = STATUS_STYLES[r.status] ?? {
              background: "var(--surface-2)",
              color: "var(--text-muted)",
            };
            return (
              <div
                key={r.id}
                className="rounded-2xl border overflow-hidden"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div
                  className="px-4 py-3 flex items-start justify-between gap-2 cursor-pointer transition-colors"
                  style={{ background: isOpen ? "color-mix(in srgb, var(--surface-2) 85%, transparent)" : "transparent" }}
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{r.issue_type || "Issue"}</span>
                      {vehicle && (
                        <span
                          className="font-mono text-xs px-1.5 py-0.5 rounded-md"
                          style={{ color: "var(--text-dim)", background: "var(--surface-2)" }}
                        >
                          {vehicle.plate_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{r.description}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className="inline-flex px-2 py-0.5 rounded-md border text-xs font-medium capitalize"
                      style={priorityStyle}
                    >
                      {r.priority}
                    </span>
                    <span
                      className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize"
                      style={statusStyle}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
                      style={{ color: "var(--text-dim)" }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </div>
                {isOpen && (
                  <div
                    className="px-4 pb-4 border-t space-y-2 pt-3"
                    style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface-2) 70%, transparent)" }}
                  >
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="block" style={{ color: "var(--text-dim)" }}>Reported</span>
                        <span className="font-medium" style={{ color: "var(--text)" }}>{fmtDateTime(r.created_at)}</span>
                      </div>
                      {r.closed_at && (
                        <div>
                          <span className="block" style={{ color: "var(--text-dim)" }}>Closed</span>
                          <span className="font-medium" style={{ color: "var(--text)" }}>{fmtDateTime(r.closed_at)}</span>
                        </div>
                      )}
                    </div>
                    {r.description && (
                      <div className="text-xs">
                        <span className="block mb-1" style={{ color: "var(--text-dim)" }}>Full Description</span>
                        <p
                          className="rounded-xl px-3 py-2 leading-relaxed"
                          style={{ color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)" }}
                        >
                          {r.description}
                        </p>
                      </div>
                    )}
                    {r.notes && (
                      <div className="text-xs">
                        <span className="block mb-1" style={{ color: "var(--text-dim)" }}>Resolution Notes</span>
                        <p
                          className="rounded-xl px-3 py-2 leading-relaxed"
                          style={{ color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)" }}
                        >
                          {r.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
