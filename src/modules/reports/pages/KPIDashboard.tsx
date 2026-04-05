// src/modules/reports/pages/KPIDashboard.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, cachedFetch } from "@/lib/supabase";
import { Card, EmptyState, PageSpinner, StatCard } from "@/components/TmsUI";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";
import { fmtMoney } from "@/lib/utils";

type BookingLite = {
  id: string;
  status: string | null;
  created_at: string;
};

type FuelLite = {
  id: string;
  status: string | null;
  created_at: string;
  estimated_cost: number | null;
};

type MaintenanceLite = {
  id: string;
  status: string | null;
  created_at: string;
  estimated_cost: number | null;
};

type VehicleLite = {
  id: string;
  status: string | null;
};

type TrendRow = {
  label: string;
  bookings: number;
  fuel: number;
  maintenance: number;
};

type StatusRow = {
  label: string;
  value: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return `${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}

function buildLastSixMonths() {
  const now = new Date();
  const result: { key: string; label: string }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ key: monthKey(d), label: monthLabel(d) });
  }

  return result;
}

function normalizeLabel(value: string) {
  return value.split("_").join(" ");
}

function kpiCardTone(index: number): "accent" | "green" | "amber" | "purple" {
  return (["accent", "green", "amber", "purple"] as const)[index % 4];
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function MiniLegend({
  items,
}: {
  items: { label: string; colorVar: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: `var(${item.colorVar})` }}
          />
          <span style={{ color: "var(--text-muted)" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function StatusDonut({
  title,
  rows,
}: {
  title: string;
  rows: StatusRow[];
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  const colors = [
    "var(--accent)",
    "var(--green)",
    "var(--amber)",
    "var(--purple)",
    "var(--red)",
    "var(--text-dim)",
  ];

  let running = 0;
  const gradient = rows
    .filter((r) => r.value > 0)
    .map((row, i) => {
      const start = total > 0 ? (running / total) * 100 : 0;
      running += row.value;
      const end = total > 0 ? (running / total) * 100 : 0;
      return `${colors[i % colors.length]} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <Card>
      <div className="p-4 space-y-4">
        <SectionTitle title={title} subtitle="Live distribution" />

        <div className="flex items-center gap-4">
          <div
            className="relative w-28 h-28 rounded-full shrink-0"
            style={{
              background:
                total > 0
                  ? `conic-gradient(${gradient})`
                  : "var(--surface-2)",
            }}
          >
            <div
              className="absolute inset-4 rounded-full flex flex-col items-center justify-center"
              style={{ background: "var(--surface)" }}
            >
              <span
                className="text-2xl font-bold"
                style={{ color: "var(--text)" }}
              >
                {total}
              </span>
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: "var(--text-dim)" }}
              >
                total
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            {rows.map((row, i) => {
              const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;

              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: colors[i % colors.length] }}
                      />
                      <span
                        className="truncate capitalize"
                        style={{ color: "var(--text)" }}
                      >
                        {normalizeLabel(row.label)}
                      </span>
                    </div>
                    <span style={{ color: "var(--text-muted)" }}>
                      {row.value} · {pct}%
                    </span>
                  </div>

                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: colors[i % colors.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function TrendChart({
  rows,
}: {
  rows: TrendRow[];
}) {
  const max = Math.max(
    1,
    ...rows.flatMap((r) => [r.bookings, r.fuel, r.maintenance])
  );

  return (
    <Card>
      <div className="p-4 space-y-4">
        <SectionTitle
          title="6-Month Operational Trend"
          subtitle="Bookings, fuel requests, and maintenance activity"
        />

        <MiniLegend
          items={[
            { label: "Bookings", colorVar: "--accent" },
            { label: "Fuel", colorVar: "--green" },
            { label: "Maintenance", colorVar: "--amber" },
          ]}
        />

        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="h-64 flex items-end gap-4">
              {rows.map((row) => (
                <div key={row.label} className="flex-1 min-w-[90px]">
                  <div className="h-56 flex items-end justify-center gap-2">
                    <div className="flex flex-col items-center justify-end gap-2 h-full w-5">
                      <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                        {row.bookings}
                      </span>
                      <div
                        className="w-5 rounded-t-lg"
                        style={{
                          height: `${(row.bookings / max) * 180}px`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>

                    <div className="flex flex-col items-center justify-end gap-2 h-full w-5">
                      <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                        {row.fuel}
                      </span>
                      <div
                        className="w-5 rounded-t-lg"
                        style={{
                          height: `${(row.fuel / max) * 180}px`,
                          background: "var(--green)",
                        }}
                      />
                    </div>

                    <div className="flex flex-col items-center justify-end gap-2 h-full w-5">
                      <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                        {row.maintenance}
                      </span>
                      <div
                        className="w-5 rounded-t-lg"
                        style={{
                          height: `${(row.maintenance / max) * 180}px`,
                          background: "var(--amber)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-3 text-center text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    {row.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function HorizontalCompare({
  title,
  subtitle,
  rows,
  color = "var(--accent)",
}: {
  title: string;
  subtitle?: string;
  rows: StatusRow[];
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <Card>
      <div className="p-4 space-y-4">
        <SectionTitle title={title} subtitle={subtitle} />

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="capitalize" style={{ color: "var(--text)" }}>
                  {normalizeLabel(row.label)}
                </span>
                <span style={{ color: "var(--text-muted)" }}>{row.value}</span>
              </div>

              <div
                className="h-2.5 rounded-full overflow-hidden"
                style={{ background: "var(--surface-2)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(row.value / max) * 100}%`,
                    background: color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function KPIDashboard() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingLite[]>([]);
  const [fuel, setFuel] = useState<FuelLite[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceLite[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLite[]>([]);

  const load = useCallback(async (force = false) => {
    setLoading(true);

    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);
      const since = sixMonthsAgo.toISOString();

      const data = await cachedFetch(
        "kpi_dashboard_6m",
        async () => {
          const [
            { data: bookingsData, error: bookingsError },
            { data: fuelData, error: fuelError },
            { data: maintenanceData, error: maintenanceError },
            { data: vehiclesData, error: vehiclesError },
          ] = await Promise.all([
            supabase
              .from("bookings")
              .select("id,status,created_at")
              .gte("created_at", since),
            supabase
              .from("fuel_requests")
              .select("id,status,created_at,estimated_cost")
              .gte("created_at", since),
            supabase
              .from("maintenance_requests")
              .select("id,status,created_at,estimated_cost")
              .gte("created_at", since),
            supabase.from("vehicles").select("id,status"),
          ]);

          if (bookingsError) console.error("KPI bookings load:", bookingsError.message);
          if (fuelError) console.error("KPI fuel load:", fuelError.message);
          if (maintenanceError) console.error("KPI maintenance load:", maintenanceError.message);
          if (vehiclesError) console.error("KPI vehicles load:", vehiclesError.message);

          return {
            bookings: (bookingsData as BookingLite[]) || [],
            fuel: (fuelData as FuelLite[]) || [],
            maintenance: (maintenanceData as MaintenanceLite[]) || [],
            vehicles: (vehiclesData as VehicleLite[]) || [],
          };
        },
        force
      );

      setBookings(data.bookings);
      setFuel(data.fuel);
      setMaintenance(data.maintenance);
      setVehicles(data.vehicles);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const debouncedReload = useMemo(
    () => debounce(() => void load(true), 450),
    [load]
  );

  useRealtimeTable({
    table: "bookings",
    event: "*",
    onChange: debouncedReload,
  });

  useRealtimeTable({
    table: "fuel_requests",
    event: "*",
    onChange: debouncedReload,
  });

  useRealtimeTable({
    table: "maintenance_requests",
    event: "*",
    onChange: debouncedReload,
  });

  useRealtimeTable({
    table: "vehicles",
    event: "*",
    onChange: debouncedReload,
  });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const isThisMonth = (iso: string) => {
    const d = new Date(iso);
    return d >= monthStart && d <= monthEnd;
  };

  const bookingStatusRows = useMemo<StatusRow[]>(() => {
    const map = new Map<string, number>();

    for (const row of bookings) {
      const key = row.status || "unknown";
      map.set(key, (map.get(key) || 0) + 1);
    }

    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [bookings]);

  const vehicleStatusRows = useMemo<StatusRow[]>(() => {
    const map = new Map<string, number>();

    for (const row of vehicles) {
      const key = row.status || "unknown";
      map.set(key, (map.get(key) || 0) + 1);
    }

    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [vehicles]);

  const trendRows = useMemo<TrendRow[]>(() => {
    const months = buildLastSixMonths();
    const map = new Map<string, TrendRow>();

    months.forEach((m) => {
      map.set(m.key, {
        label: m.label,
        bookings: 0,
        fuel: 0,
        maintenance: 0,
      });
    });

    bookings.forEach((row) => {
      const d = new Date(row.created_at);
      const key = monthKey(d);
      const target = map.get(key);
      if (target) target.bookings += 1;
    });

    fuel.forEach((row) => {
      const d = new Date(row.created_at);
      const key = monthKey(d);
      const target = map.get(key);
      if (target) target.fuel += 1;
    });

    maintenance.forEach((row) => {
      const d = new Date(row.created_at);
      const key = monthKey(d);
      const target = map.get(key);
      if (target) target.maintenance += 1;
    });

    return months.map((m) => map.get(m.key)!);
  }, [bookings, fuel, maintenance]);

  const totalPendingBookings = bookings.filter(
    (r) => (r.status || "").toLowerCase() === "pending"
  ).length;

  const totalApprovedBookings = bookings.filter(
    (r) => (r.status || "").toLowerCase() === "approved"
  ).length;

  const totalSubmittedFuel = fuel.filter(
    (r) => (r.status || "").toLowerCase() === "submitted"
  ).length;

  const totalRecordedFuel = fuel.filter(
    (r) => (r.status || "").toLowerCase() === "recorded"
  ).length;

  const totalReportedMaintenance = maintenance.filter(
    (r) => (r.status || "").toLowerCase() === "reported"
  ).length;

  const totalApprovedMaintenance = maintenance.filter(
    (r) => (r.status || "").toLowerCase() === "approved"
  ).length;

  const activeVehicles = vehicles.filter(
    (r) => (r.status || "").toLowerCase() === "active"
  ).length;

  const thisMonthBookings = bookings.filter((r) => isThisMonth(r.created_at)).length;
  const thisMonthFuel = fuel.filter((r) => isThisMonth(r.created_at)).length;
  const thisMonthMaintenance = maintenance.filter((r) => isThisMonth(r.created_at)).length;

  const thisMonthFuelCost = fuel
    .filter((r) => isThisMonth(r.created_at))
    .reduce((sum, row) => sum + Number(row.estimated_cost || 0), 0);

  const thisMonthMaintenanceCost = maintenance
    .filter((r) => isThisMonth(r.created_at))
    .reduce((sum, row) => sum + Number(row.estimated_cost || 0), 0);

  const summaryCards = [
    { label: "Pending Bookings", value: totalPendingBookings },
    { label: "Approved / Awaiting Dispatch", value: totalApprovedBookings },
    { label: "Fuel Pending Approval", value: totalSubmittedFuel },
    { label: "Maintenance Pending Approval", value: totalReportedMaintenance },
    { label: "Active Vehicles", value: activeVehicles },
    { label: "Fuel Recorded", value: totalRecordedFuel },
    { label: "Maintenance Approved", value: totalApprovedMaintenance },
    { label: "This Month Bookings", value: thisMonthBookings },
  ];

  if (loading) return <PageSpinner variant="dashboard" />;

  const noData =
    bookings.length === 0 &&
    fuel.length === 0 &&
    maintenance.length === 0 &&
    vehicles.length === 0;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">KPI Dashboard</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Live operational overview for bookings, fuel, maintenance, and fleet
          </p>
        </div>
      </div>

      {noData ? (
        <EmptyState
          title="No KPI data yet"
          subtitle="Once operations begin, charts and stats will appear here"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {summaryCards.map((card, i) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                accent={kpiCardTone(i)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card>
              <div className="p-4 space-y-3">
                <SectionTitle
                  title="This Month Snapshot"
                  subtitle={`${MONTHS[now.getMonth()]} ${now.getFullYear()}`}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    className="rounded-2xl p-4 border"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                      Bookings
                    </p>
                    <p className="text-2xl font-bold mt-1" style={{ color: "var(--text)" }}>
                      {thisMonthBookings}
                    </p>
                  </div>

                  <div
                    className="rounded-2xl p-4 border"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                      Fuel Requests
                    </p>
                    <p className="text-2xl font-bold mt-1" style={{ color: "var(--text)" }}>
                      {thisMonthFuel}
                    </p>
                  </div>

                  <div
                    className="rounded-2xl p-4 border"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                      Maintenance
                    </p>
                    <p className="text-2xl font-bold mt-1" style={{ color: "var(--text)" }}>
                      {thisMonthMaintenance}
                    </p>
                  </div>

                  <div
                    className="rounded-2xl p-4 border"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                      Monthly Cost
                    </p>
                    <p className="text-xl font-bold mt-1" style={{ color: "var(--text)" }}>
                      {fmtMoney(thisMonthFuelCost + thisMonthMaintenanceCost)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div
                    className="rounded-xl px-3 py-2"
                    style={{ background: "var(--green-dim)" }}
                  >
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Fuel Cost
                    </p>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>
                      {fmtMoney(thisMonthFuelCost)}
                    </p>
                  </div>

                  <div
                    className="rounded-xl px-3 py-2"
                    style={{ background: "var(--amber-dim)" }}
                  >
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Maintenance Cost
                    </p>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>
                      {fmtMoney(thisMonthMaintenanceCost)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <StatusDonut
              title="Booking Status Mix"
              rows={bookingStatusRows.length ? bookingStatusRows : [{ label: "none", value: 0 }]}
            />

            <HorizontalCompare
              title="Vehicle Status"
              subtitle="Current fleet condition"
              rows={vehicleStatusRows.length ? vehicleStatusRows : [{ label: "none", value: 0 }]}
              color="var(--purple)"
            />
          </div>

          <TrendChart rows={trendRows} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <HorizontalCompare
              title="Booking Pipeline"
              subtitle="Current queue pressure by status"
              rows={bookingStatusRows.length ? bookingStatusRows : [{ label: "none", value: 0 }]}
              color="var(--accent)"
            />

            <Card>
              <div className="p-4 space-y-4">
                <SectionTitle
                  title="Operations Summary"
                  subtitle="Fast executive read"
                />

                <div className="space-y-3">
                  <div
                    className="rounded-xl px-3 py-3 border"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                      Dispatch Pressure
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--text)" }}>
                      {totalApprovedBookings} approved booking{totalApprovedBookings !== 1 ? "s" : ""} currently waiting for dispatch.
                    </p>
                  </div>

                  <div
                    className="rounded-xl px-3 py-3 border"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                      Approval Load
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--text)" }}>
                      {totalSubmittedFuel + totalReportedMaintenance} approval item
                      {totalSubmittedFuel + totalReportedMaintenance !== 1 ? "s" : ""} pending across fuel and maintenance.
                    </p>
                  </div>

                  <div
                    className="rounded-xl px-3 py-3 border"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                      Fleet Readiness
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--text)" }}>
                      {activeVehicles} vehicle{activeVehicles !== 1 ? "s" : ""} currently marked active in the fleet register.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
