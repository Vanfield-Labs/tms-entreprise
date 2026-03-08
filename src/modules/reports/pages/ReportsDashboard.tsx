// src/modules/reports/pages/ReportsDashboard.tsx
// Wires kpi_snapshots as a fallback/trend source.
// kpi_snapshots: { id, snapshot_date, metrics (jsonb), created_at }
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, Card, CardHeader, StatCard, Badge } from "@/components/TmsUI";
import { fmtMoney } from "@/lib/utils";

type StatusCount  = { status: string; total: number };
type DailyCount   = { trip_date: string; total: number };
type FuelMonthly  = { month: string; requests: number; total_liters: number; total_amount: number };
type MaintMonthly = { month: string; requests: number; closed_count: number };
type UtilRow      = { vehicle_id: string; plate_number: string; trips: number };
type KpiSnapshot  = { id: string; snapshot_date: string; metrics: Record<string, number> };

export default function ReportsDashboard() {
  const [kpis,         setKpis]         = useState<Record<string, number> | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [dailyCounts,  setDailyCounts]  = useState<DailyCount[]>([]);
  const [fuelMonthly,  setFuelMonthly]  = useState<FuelMonthly[]>([]);
  const [maintMonthly, setMaintMonthly] = useState<MaintMonthly[]>([]);
  const [util,         setUtil]         = useState<UtilRow[]>([]);
  const [snapshots,    setSnapshots]    = useState<KpiSnapshot[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { data: k },
        { data: s },
        { data: d },
        { data: f },
        { data: m },
        { data: u },
        { data: snaps },
      ] = await Promise.all([
        supabase.rpc("report_kpis"),
        supabase.from("v_booking_status_counts").select("*"),
        supabase.from("v_booking_daily_counts").select("*"),
        supabase.from("v_fuel_monthly_totals").select("*"),
        supabase.from("v_maintenance_monthly_totals").select("*"),
        supabase.from("v_vehicle_utilization_30d").select("*"),
        supabase
          .from("kpi_snapshots")
          .select("id,snapshot_date,metrics")
          .order("snapshot_date", { ascending: false })
          .limit(30),
      ]);

      // report_kpis may return an array with one object
      const kpiObj = Array.isArray(k) ? k[0] : k;
      setKpis(kpiObj ?? null);

      setStatusCounts((s as any) || []);
      setDailyCounts((d as any) || []);
      setFuelMonthly((f as any) || []);
      setMaintMonthly((m as any) || []);
      setUtil((u as any) || []);
      setSnapshots(((snaps as any) || []).reverse()); // oldest first for chart
      setLoading(false);
    })();
  }, []);

  if (loading) return <PageSpinner />;

  // ── KPI config ─────────────────────────────────────────────────────────────
  const KPI_CONFIG = kpis ? [
    { label: "Bookings (30d)",          value: kpis.bookings_30d,            accent: "accent"  as const, icon: "📋" },
    { label: "Pending Approvals",       value: kpis.pending_approvals,       accent: "amber"   as const, icon: "⏳" },
    { label: "Approved (not dispatched)", value: kpis.approved_not_dispatched, accent: "purple" as const, icon: "✅" },
    { label: "Active Trips",            value: kpis.active_trips,            accent: "green"   as const, icon: "🚗" },
    { label: "Fuel Submitted",          value: kpis.fuel_submitted,          accent: "amber"   as const, icon: "⛽" },
    { label: "Maintenance Open",        value: kpis.maintenance_open,        accent: "red"     as const, icon: "🔧" },
  ] : [];

  // ── Snapshot trend for a given metric ──────────────────────────────────────
  function SnapshotSparkline({ metric, label }: { metric: string; label: string }) {
    const pts = snapshots.filter(s => s.metrics?.[metric] != null);
    if (pts.length < 2) return null;
    const vals   = pts.map(s => s.metrics[metric]);
    const maxVal = Math.max(...vals, 1);
    const W = 200, H = 40;
    const polyline = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * W;
      const y = H - (v / maxVal) * H;
      return `${x},${y}`;
    }).join(" ");
    const latest = vals[vals.length - 1];
    const prev   = vals[vals.length - 2];
    const trend  = latest > prev ? "↑" : latest < prev ? "↓" : "→";
    const trendColor = latest > prev ? "var(--green)" : latest < prev ? "var(--red)" : "var(--text-muted)";

    return (
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
          <svg viewBox={`0 0 ${W} ${H + 2}`} style={{ width: "100%", height: 36 }} preserveAspectRatio="none">
            <polyline points={polyline} fill="none" stroke="var(--accent)"
              strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold" style={{ color: "var(--text)" }}>{latest}</div>
          <div className="text-xs font-semibold" style={{ color: trendColor }}>{trend}</div>
        </div>
      </div>
    );
  }

  function Empty() {
    return (
      <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        No data yet
      </div>
    );
  }

  // ── Sparkline from daily booking counts ────────────────────────────────────
  const sparkMax = Math.max(...dailyCounts.map(d => d.total), 1);
  const sparkW = 300, sparkH = 52;
  const pts = dailyCounts.slice(-30);
  const polyline = pts.map((d, i) => {
    const x = (i / Math.max(pts.length - 1, 1)) * sparkW;
    const y = sparkH - (d.total / sparkMax) * sparkH;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {KPI_CONFIG.map(c => (
            <StatCard key={c.label} label={c.label} value={c.value ?? "—"} accent={c.accent} />
          ))}
        </div>
      )}

      {/* Booking sparkline */}
      {pts.length > 1 && (
        <Card>
          <CardHeader title="Bookings — Last 30 Days" />
          <div className="px-4 py-3 overflow-x-auto">
            <svg width="100%" viewBox={`0 0 ${sparkW} ${sparkH + 8}`}
              preserveAspectRatio="none" style={{ height: 60 }}>
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.15"/>
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <polyline
                points={[...pts.map((d, i) => {
                  const x = (i / Math.max(pts.length - 1, 1)) * sparkW;
                  const y = sparkH - (d.total / sparkMax) * sparkH;
                  return `${x},${y}`;
                }), `${sparkW},${sparkH + 8}`, `0,${sparkH + 8}`].join(" ")}
                fill="url(#sparkGrad)"
              />
              <polyline
                points={polyline}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </Card>
      )}

      {/* KPI Snapshot trends */}
      {snapshots.length >= 2 && (
        <Card>
          <CardHeader
            title="KPI Trends"
            subtitle={`Based on ${snapshots.length} daily snapshots`}
          />
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SnapshotSparkline metric="bookings_30d"          label="Bookings (30d)" />
            <SnapshotSparkline metric="active_trips"          label="Active Trips" />
            <SnapshotSparkline metric="pending_approvals"     label="Pending Approvals" />
            <SnapshotSparkline metric="maintenance_open"      label="Open Maintenance" />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Booking status */}
        <Card>
          <CardHeader title="Booking Status Breakdown" />
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {statusCounts.length === 0 ? (
              <Empty />
            ) : statusCounts.map(s => (
              <div key={s.status} className="px-5 py-3 flex items-center justify-between gap-2">
                <Badge status={s.status} />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{s.total}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Vehicle utilisation */}
        <Card>
          <CardHeader title="Vehicle Utilisation (30d)" />
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {util.length === 0 ? (
              <div className="col-span-full"><Empty /></div>
            ) : util.map(r => (
              <div key={r.vehicle_id}
                className="rounded-xl p-3 text-center border"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{r.plate_number}</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: "var(--accent)" }}>{r.trips}</p>
                <p style={{ fontSize: 10, color: "var(--text-dim)" }}>trips</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Fuel monthly */}
        <Card>
          <CardHeader title="Fuel — Monthly Summary" />
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {fuelMonthly.length === 0 ? <Empty /> : fuelMonthly.slice(-6).map(r => (
              <div key={r.month} className="px-5 py-3 flex items-center justify-between gap-2 text-sm">
                <span style={{ color: "var(--text-muted)" }}>{r.month}</span>
                <div className="flex gap-4 text-right">
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Requests</p>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>{r.requests}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Litres</p>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>{r.total_liters ?? "—"}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Cost</p>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>{fmtMoney(r.total_amount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Maintenance monthly */}
        <Card>
          <CardHeader title="Maintenance — Monthly" />
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {maintMonthly.length === 0 ? <Empty /> : maintMonthly.slice(-6).map(r => (
              <div key={r.month} className="px-5 py-3 flex items-center justify-between gap-2 text-sm">
                <span style={{ color: "var(--text-muted)" }}>{r.month}</span>
                <div className="flex gap-4 text-right">
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Reported</p>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>{r.requests}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Closed</p>
                    <p className="font-semibold" style={{ color: "var(--green)" }}>{r.closed_count}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Open</p>
                    <p className="font-semibold" style={{ color: r.requests - r.closed_count > 0 ? "var(--amber)" : "var(--text-dim)" }}>
                      {r.requests - r.closed_count}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}