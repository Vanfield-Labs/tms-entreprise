// src/modules/reports/pages/ReportsDashboard.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, Card, CardHeader, StatCard, Badge } from "@/components/TmsUI";
import { fmtMoney } from "@/lib/utils";

type StatusCount  = { status: string; total: number };
type DailyCount   = { trip_date: string; total: number };
type FuelMonthly  = { month: string; requests: number; total_liters: number; total_amount: number };
type MaintMonthly = { month: string; requests: number; closed_count: number };
type UtilRow      = { vehicle_id: string; plate_number: string; trips: number };

export default function ReportsDashboard() {
  const [kpis,        setKpis]        = useState<any>(null);
  const [statusCounts,setStatusCounts]= useState<StatusCount[]>([]);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [fuelMonthly, setFuelMonthly] = useState<FuelMonthly[]>([]);
  const [maintMonthly,setMaintMonthly]= useState<MaintMonthly[]>([]);
  const [util,        setUtil]        = useState<UtilRow[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: k }, { data: s }, { data: d }, { data: f }, { data: m }, { data: u }] = await Promise.all([
        supabase.rpc("report_kpis"),
        supabase.from("v_booking_status_counts").select("*"),
        supabase.from("v_booking_daily_counts").select("*"),
        supabase.from("v_fuel_monthly_totals").select("*"),
        supabase.from("v_maintenance_monthly_totals").select("*"),
        supabase.from("v_vehicle_utilization_30d").select("*"),
      ]);
      setKpis(k); setStatusCounts((s as any)||[]); setDailyCounts((d as any)||[]);
      setFuelMonthly((f as any)||[]); setMaintMonthly((m as any)||[]); setUtil((u as any)||[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <PageSpinner />;

  const KPI_CONFIG = kpis ? [
    { label: "Bookings (30d)",          value: kpis.bookings_30d,             accent: "accent"  as const, icon: "📋" },
    { label: "Pending Approvals",       value: kpis.pending_approvals,        accent: "amber"   as const, icon: "⏳" },
    { label: "Approved (undispatched)", value: kpis.approved_not_dispatched,  accent: "purple"  as const, icon: "✅" },
    { label: "Active Trips",            value: kpis.active_trips,             accent: "green"   as const, icon: "🚗" },
    { label: "Fuel Submitted",          value: kpis.fuel_submitted,           accent: "amber"   as const, icon: "⛽" },
    { label: "Maintenance Open",        value: kpis.maintenance_open,         accent: "red"     as const, icon: "🔧" },
  ] : [];

  // Sparkline SVG from daily counts
  const sparkMax = Math.max(...dailyCounts.map(d => d.total), 1);
  const sparkW   = 280;
  const sparkH   = 48;
  const pts      = dailyCounts.slice(-30);
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
            <div key={c.label} className="stat-card">
              <div className="text-xl mb-1">{c.icon}</div>
              <div className="stat-label">{c.label}</div>
              <div className="stat-value" style={{ color: `var(--${c.accent})` }}>{c.value ?? "—"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sparkline */}
      {pts.length > 1 && (
        <Card>
          <CardHeader title="Bookings — Last 30 Days" />
          <div className="px-4 py-4 overflow-x-auto">
            <svg width="100%" viewBox={`0 0 ${sparkW} ${sparkH + 8}`} preserveAspectRatio="none" style={{ height: 56 }}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Booking status breakdown */}
        <Card>
          <CardHeader title="Booking Status" />
          <div className="divide-y divide-[color:var(--border)]">
            {statusCounts.length === 0 ? (
              <Empty />
            ) : statusCounts.map(s => (
              <div key={s.status} className="px-5 py-3 flex items-center justify-between gap-2">
                <Badge status={s.status} />
                <span className="text-sm font-semibold text-[color:var(--text)]">{s.total}</span>
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
              <div key={r.vehicle_id} className="bg-[color:var(--surface-2)] rounded-xl p-3 text-center border border-[color:var(--border)]">
                <p className="text-sm font-bold text-[color:var(--text)]">{r.plate_number}</p>
                <p className="text-xl font-bold text-[color:var(--accent)] mt-0.5">{r.trips}</p>
                <p className="text-[10px] text-[color:var(--text-dim)]">trips</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Fuel monthly */}
        <Card>
          <CardHeader title="Fuel — Monthly Summary" />
          <div className="divide-y divide-[color:var(--border)]">
            {fuelMonthly.length === 0 ? <Empty /> : fuelMonthly.slice(-6).map(r => (
              <div key={r.month} className="px-5 py-3 flex items-center justify-between gap-2 text-sm">
                <span className="text-[color:var(--text-muted)]">{r.month}</span>
                <div className="flex gap-4 text-right">
                  <div>
                    <p className="text-[10px] text-[color:var(--text-muted)]">Req</p>
                    <p className="font-semibold text-[color:var(--text)]">{r.requests}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[color:var(--text-muted)]">Litres</p>
                    <p className="font-semibold text-[color:var(--text)]">{r.total_liters ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[color:var(--text-muted)]">Cost</p>
                    <p className="font-semibold text-[color:var(--text)]">{fmtMoney(r.total_amount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Maintenance monthly */}
        <Card>
          <CardHeader title="Maintenance — Monthly" />
          <div className="divide-y divide-[color:var(--border)]">
            {maintMonthly.length === 0 ? <Empty /> : maintMonthly.slice(-6).map(r => (
              <div key={r.month} className="px-5 py-3 flex items-center justify-between gap-2 text-sm">
                <span className="text-[color:var(--text-muted)]">{r.month}</span>
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-[color:var(--text-muted)]">Total</p>
                    <p className="font-semibold text-[color:var(--text)]">{r.requests}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-[color:var(--text-muted)]">Closed</p>
                    <p className="font-semibold text-[color:var(--green)]">{r.closed_count}</p>
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

function Empty() {
  return <p className="text-xs text-[color:var(--text-muted)] py-4 text-center px-5">No data available</p>;
}