// src/modules/reports/pages/ReportsDashboard.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardBody, StatCard, Badge, Btn } from "@/components/TmsUI";
import { usePagination, PaginationBar } from "@/hooks/usePagination";
import { fmtMoney } from "@/lib/utils";
import AlertsPanel from "@/components/dashboard/AlertsPanel";
import InsightCard from "@/components/dashboard/InsightCard";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useNavigate } from "react-router-dom";

type Period = "week" | "month" | "quarter" | "year";

type KPI = {
  total_bookings: number;
  approved_bookings: number;
  rejected_bookings: number;
  completed_bookings: number;
  total_fuel_requests: number;
  total_fuel_amount: number;
  total_fuel_liters: number;
  total_maintenance: number;
  active_vehicles: number;
  active_drivers: number;
};

type BookingRow = {
  status: string;
  booking_type: string;
  trip_date: string;
  purpose: string;
  created_at: string;
};

type FuelRow = {
  status: string;
  amount: number | null;
  liters: number | null;
  vendor: string | null;
  request_date: string;
  vehicles: { plate_number: string; fuel_type: string | null } | null;
};

type MaintRow = {
  status: string;
  issue_type: string | null;
  created_at: string;
  vehicles: { plate_number: string } | null;
};

type VehicleUtil = {
  plate_number: string;
  trip_count: number;
  total_km: number | null;
};

function getPeriodRange(period: Period): { from: string; to: string; label: string } {
  const now = new Date();
  let from = new Date();
  let to = new Date();

  if (period === "week") {
    const dow = now.getDay();
    from = new Date(now);
    from.setDate(now.getDate() - dow);
    from.setHours(0, 0, 0, 0);

    to = new Date(from);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
  } else if (period === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    from = new Date(now.getFullYear(), q * 3, 1);
    to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
  } else {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const labels: Record<Period, string> = {
    week: `Week of ${monthNames[from.getMonth()]} ${from.getDate()}`,
    month: `${monthNames[from.getMonth()]} ${from.getFullYear()}`,
    quarter: `Q${Math.floor(from.getMonth() / 3) + 1} ${from.getFullYear()}`,
    year: `${from.getFullYear()}`,
  };

  return { from: fmt(from), to: fmt(to), label: labels[period] };
}

function exportToCSV(period: Period, kpi: KPI, bookings: BookingRow[], fuel: FuelRow[], maint: MaintRow[]) {
  const { label } = getPeriodRange(period);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const sections: string[][] = [];

  sections.push([esc(`TMS REPORT — ${label}`), "", "", "", ""]);
  sections.push([esc(`Generated: ${new Date().toLocaleString()}`), "", "", "", ""]);
  sections.push(["", "", "", "", ""]);

  sections.push([esc("SUMMARY"), "", "", "", ""]);
  [
    ["Total Bookings", kpi.total_bookings],
    ["Completed Trips", kpi.completed_bookings],
    ["Approved Bookings", kpi.approved_bookings],
    ["Rejected Bookings", kpi.rejected_bookings],
    ["Total Fuel Requests", kpi.total_fuel_requests],
    ["Total Fuel Spend", fmtMoney(kpi.total_fuel_amount)],
    ["Total Fuel Litres", `${kpi.total_fuel_liters.toFixed(1)} L`],
    ["Maintenance Issues", kpi.total_maintenance],
  ].forEach(([k, v]) => sections.push([esc(k), esc(v), "", "", ""]));

  sections.push(["", "", "", "", ""]);

  sections.push([esc("BOOKINGS"), esc("Purpose"), esc("Type"), esc("Status"), esc("Date")]);
  bookings.forEach((b) =>
    sections.push(["", esc(b.purpose), esc(b.booking_type), esc(b.status), esc(b.trip_date)])
  );
  sections.push(["", "", "", "", ""]);

  sections.push([
    esc("FUEL REQUESTS"),
    esc("Vehicle"),
    esc("Fuel Type"),
    esc("Litres"),
    esc("Amount"),
    esc("Vendor"),
    esc("Date"),
  ]);
  fuel.forEach((f) =>
    sections.push([
      "",
      esc(f.vehicles?.plate_number),
      esc(f.vehicles?.fuel_type),
      esc(f.liters != null ? `${f.liters} L` : "—"),
      esc(f.amount != null ? fmtMoney(f.amount) : "—"),
      esc(f.vendor),
      esc(f.request_date),
    ])
  );
  sections.push(["", "", "", "", "", "", ""]);

  sections.push([esc("MAINTENANCE"), esc("Vehicle"), esc("Issue Type"), esc("Status"), esc("Date")]);
  maint.forEach((m) =>
    sections.push([
      "",
      esc(m.vehicles?.plate_number),
      esc(m.issue_type),
      esc(m.status),
      esc(m.created_at.slice(0, 10)),
    ])
  );

  const csv = sections.map((r) => r.join(",")).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `TMS_Report_${label.replace(/\s+/g, "_")}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span>{label}</span>
        <span className="font-semibold" style={{ color: "var(--text)" }}>
          {value}
        </span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>
        No data
      </div>
    );
  }

  let offset = 0;
  const radius = 40;
  const circ = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0">
        {data
          .filter((d) => d.value > 0)
          .map((d, i) => {
            const pct = d.value / total;
            const dash = pct * circ;

            const seg = (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth="18"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
              />
            );

            offset += dash;
            return seg;
          })}
        <text
          x="50"
          y="54"
          textAnchor="middle"
          fontSize="14"
          fontWeight="bold"
          fill="var(--text)"
        >
          {total}
        </text>
      </svg>

      <div className="space-y-1.5 w-full">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {d.label}
            </span>
            <span
              className="text-xs font-semibold ml-auto pl-4"
              style={{ color: "var(--text)" }}
            >
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportConfirm({
  open,
  label,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>📊</div>
        <h3
          className="text-base font-bold mb-2 text-center"
          style={{ color: "var(--text)" }}
        >
          Export Report
        </h3>
        <p className="text-sm mb-1 text-center" style={{ color: "var(--text-muted)" }}>
          Download <strong>{label}</strong> as a CSV file?
        </p>
        <p className="text-xs mb-5 text-center" style={{ color: "var(--text-dim)" }}>
          Opens correctly in Microsoft Excel and Google Sheets.
        </p>
        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary flex-1" onClick={onConfirm}>
            ⬇ Download
          </button>
        </div>
      </div>
    </div>
  );
}

function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    let startTime: number | null = null;
    const startValue = display;
    const delta = value - startValue;

    const tick = (ts: number) => {
      if (startTime == null) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const next = Math.round(startValue + delta * progress);
      setDisplay(next);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}

function AnimatedStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "accent" | "green" | "amber" | "red";
}) {
  const animated = useCountUp(value);

  return (
    <div className="stat-card" style={{ overflow: "hidden" }}>
      <div className="stat-label">{label}</div>
      <div
        style={{
          fontSize: "clamp(20px, 4vw, 36px)",
          fontWeight: 700,
          lineHeight: 1,
          fontFamily: "'IBM Plex Mono', monospace",
          color: {
            accent: "var(--accent)",
            green: "var(--green)",
            amber: "var(--amber)",
            red: "var(--red)",
          }[accent],
          marginTop: 6,
        }}
      >
        {animated}
      </div>
    </div>
  );
}

export default function ReportsDashboard() {
  const navigate = useNavigate();

  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [fuel, setFuel] = useState<FuelRow[]>([]);
  const [maint, setMaint] = useState<MaintRow[]>([]);
  const [utilization, setUtilization] = useState<VehicleUtil[]>([]);
  const [showExport, setShowExport] = useState(false);

  const maintPg = usePagination(maint);
  const utilPg = usePagination(utilization);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getPeriodRange(period);

    const [{ data: b }, { data: f }, { data: m }, { data: v }] = await Promise.all([
      supabase
        .from("bookings")
        .select("status,booking_type,trip_date,purpose,created_at")
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59")
        .limit(1000),

      supabase
        .from("fuel_requests")
        .select("status,amount,liters,vendor,request_date,vehicles(plate_number,fuel_type)")
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59")
        .limit(1000),

      supabase
        .from("maintenance_requests")
        .select("status,issue_type,created_at,vehicles(plate_number)")
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59")
        .limit(1000),

      supabase.from("v_vehicle_utilization_30d").select("*").limit(50),
    ]);

    const bRows = (b as BookingRow[]) || [];
    const fRows = (f as unknown as FuelRow[]) || [];
    const mRows = (m as unknown as MaintRow[]) || [];
    const vRows = (v as unknown as VehicleUtil[]) || [];

    setBookings(bRows);
    setFuel(fRows);
    setMaint(mRows);
    setUtilization(vRows);

    setKpi({
      total_bookings: bRows.length,
      approved_bookings: bRows.filter((r) =>
        ["approved", "dispatched", "in_progress", "completed", "closed"].includes(r.status)
      ).length,
      rejected_bookings: bRows.filter((r) => r.status === "rejected").length,
      completed_bookings: bRows.filter((r) => ["completed", "closed"].includes(r.status)).length,
      total_fuel_requests: fRows.length,
      total_fuel_amount: fRows.reduce((s, r) => s + (r.amount ?? 0), 0),
      total_fuel_liters: fRows.reduce((s, r) => s + (r.liters ?? 0), 0),
      total_maintenance: mRows.length,
      active_vehicles: vRows.length,
      active_drivers: 0,
    });

    setLoading(false);
  }, [period]);

  const { label } = getPeriodRange(period);

  const topInsight = (() => {
    if (!kpi) return "";

    if (kpi.rejected_bookings > 0) {
      return `${kpi.rejected_bookings} bookings were rejected`;
    }

    if (kpi.total_fuel_amount > 0) {
      return `Fuel spend is ${fmtMoney(kpi.total_fuel_amount)}`;
    }

    if (kpi.completed_bookings > 0) {
      return `${kpi.completed_bookings} trips completed`;
    }

    return "System running normally";
  })();

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    channel: "reports_dashboard_realtime",
    tables: ["bookings", "fuel_requests", "maintenance_requests"],
    onRefresh: load,
  });

  const bookingStatusData = [
    {
      label: "Completed",
      value: kpi?.completed_bookings ?? 0,
      color: "var(--green)",
    },
    {
      label: "Approved",
      value: bookings.filter((b) => b.status === "approved").length,
      color: "var(--accent)",
    },
    {
      label: "Rejected",
      value: kpi?.rejected_bookings ?? 0,
      color: "var(--red)",
    },
    {
      label: "Pending",
      value: bookings.filter((b) => ["draft", "submitted"].includes(b.status)).length,
      color: "var(--amber)",
    },
  ];

  const typeCount: Record<string, number> = {};
  for (const b of bookings) {
    typeCount[b.booking_type] = (typeCount[b.booking_type] ?? 0) + 1;
  }

  const maxType = Math.max(...Object.values(typeCount), 1);

  const maintStatusData = [
    {
      label: "Reported",
      value: maint.filter((m) => m.status === "reported").length,
      color: "var(--amber)",
    },
    {
      label: "In Progress",
      value: maint.filter((m) => m.status === "in_progress").length,
      color: "var(--accent)",
    },
    {
      label: "Completed",
      value: maint.filter((m) => ["completed", "closed"].includes(m.status)).length,
      color: "var(--green)",
    },
  ];

  const periods: { value: Period; label: string }[] = [
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="skeleton h-5 w-32" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton h-9 w-24 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card space-y-2">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-6 w-16" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="stat-card space-y-2">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-5 w-20" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>

        <div className="card p-4 space-y-3">
          <div className="skeleton h-4 w-40" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ExportConfirm
        open={showExport}
        label={label}
        onConfirm={() => {
          if (kpi) exportToCSV(period, kpi, bookings, fuel, maint);
          setShowExport(false);
        }}
        onCancel={() => setShowExport(false)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {label}
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-2">
          <div
            className="flex rounded-xl overflow-hidden border min-h-[36px]"
            style={{ borderColor: "var(--border)" }}
          >
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className="px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  background: period === p.value ? "var(--accent)" : "var(--surface)",
                  color: period === p.value ? "#fff" : "var(--text-muted)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate("/reports/kpi")}
            className="px-3 py-2 text-xs font-medium rounded-xl border min-h-[36px] transition-colors"
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              borderColor: "var(--border)",
            }}
          >
            KPI Dashboard
          </button>

          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="px-3 py-2 text-xs font-medium rounded-xl border min-h-[36px] transition-colors"
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              borderColor: "var(--border)",
            }}
          >
            ⬇ Export
          </button>
        </div>
      </div>

      <AlertsPanel bookings={bookings} maint={maint} kpi={kpi} label={label} />
      <InsightCard text={topInsight} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Bookings", value: kpi?.total_bookings ?? 0, accent: "accent" as const },
          { label: "Completed Trips", value: kpi?.completed_bookings ?? 0, accent: "green" as const },
          { label: "Fuel Requests", value: kpi?.total_fuel_requests ?? 0, accent: "amber" as const },
          { label: "Maintenance", value: kpi?.total_maintenance ?? 0, accent: "red" as const },
        ].map((s) => (
          <AnimatedStat
            key={s.label}
            label={s.label}
            value={s.value}
            accent={s.accent}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Fuel Spend" value={fmtMoney(kpi?.total_fuel_amount ?? 0)} accent="accent" />
        <StatCard
          label="Litres Dispensed"
          value={`${(kpi?.total_fuel_liters ?? 0).toLocaleString()} L`}
        />
        <StatCard label="Rejected Bookings" value={kpi?.rejected_bookings ?? 0} accent="red" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Booking Status" />
          <CardBody>
            <DonutChart data={bookingStatusData} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Maintenance Status" />
          <CardBody>
            <DonutChart data={maintStatusData} />
          </CardBody>
        </Card>
      </div>

      {Object.keys(typeCount).length > 0 && (
        <Card>
          <CardHeader title="Bookings by Type" />
          <CardBody className="space-y-3">
            {Object.entries(typeCount)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <Bar
                  key={type}
                  label={type.charAt(0).toUpperCase() + type.slice(1)}
                  value={count}
                  max={maxType}
                  color="var(--accent)"
                />
              ))}
          </CardBody>
        </Card>
      )}

      {fuel.length > 0 && (
        <Card>
          <CardHeader title="Fuel Summary by Vehicle" />
          <CardBody>
            {(() => {
              const byV: Record<string, { liters: number; amount: number }> = {};

              for (const f of fuel) {
                const p = f.vehicles?.plate_number ?? "Unknown";
                if (!byV[p]) byV[p] = { liters: 0, amount: 0 };
                byV[p].liters += f.liters ?? 0;
                byV[p].amount += f.amount ?? 0;
              }

              const maxL = Math.max(...Object.values(byV).map((v) => v.liters), 1);

              return (
                <div className="space-y-3">
                  {Object.entries(byV)
                    .sort((a, b) => b[1].amount - a[1].amount)
                    .map(([plate, v]) => (
                      <div key={plate}>
                        <div
                          className="flex justify-between text-xs mb-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span>{plate}</span>
                          <span className="font-semibold" style={{ color: "var(--text)" }}>
                            {v.liters.toFixed(1)}L · {fmtMoney(v.amount)}
                          </span>
                        </div>
                        <div
                          className="w-full h-2 rounded-full"
                          style={{ background: "var(--surface-2)" }}
                        >
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.round((v.liters / maxL) * 100)}%`,
                              background: "var(--amber)",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              );
            })()}
          </CardBody>
        </Card>
      )}

      {utilization.length > 0 && (
        <Card>
          <CardHeader title="Vehicle Utilization (30 days)" />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Trips</th>
                    <th>Total KM</th>
                  </tr>
                </thead>
                <tbody>
                  {utilPg.slice
                    .sort((a, b) => b.trip_count - a.trip_count)
                    .map((v) => (
                      <tr key={v.plate_number}>
                        <td className="font-medium">{v.plate_number}</td>
                        <td>{v.trip_count}</td>
                        <td>{v.total_km != null ? `${v.total_km.toLocaleString()} km` : "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <PaginationBar {...utilPg} />
          </CardBody>
        </Card>
      )}

      {maint.length > 0 && (
        <Card>
          <CardHeader title="Maintenance Issues" />
          <CardBody>
            <div className="sm:hidden space-y-2">
              {maintPg.slice.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      {m.vehicles?.plate_number ?? "—"}
                    </p>
                    <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                      {m.issue_type ?? "—"}
                    </p>
                  </div>
                  <Badge status={m.status} />
                </div>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Issue</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {maintPg.slice.map((m, i) => (
                    <tr key={i}>
                      <td>{m.vehicles?.plate_number ?? "—"}</td>
                      <td className="capitalize">{m.issue_type ?? "—"}</td>
                      <td>
                        <Badge status={m.status} />
                      </td>
                      <td
                        className="text-xs whitespace-nowrap"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {m.created_at.slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationBar {...maintPg} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}