import { fmtMoney } from "@/lib/utils";

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
};

type MaintRow = {
  status: string;
};

type AlertTone = "amber" | "red" | "accent";

type AlertItem = {
  tone: AlertTone;
  title: string;
  text: string;
};

export default function AlertsPanel({
  bookings,
  maint,
  kpi,
  label,
}: {
  bookings: BookingRow[];
  maint: MaintRow[];
  kpi: KPI | null;
  label: string;
}) {
  const submittedCount = bookings.filter((b) => b.status === "submitted").length;
  const openMaintenance = maint.filter(
    (m) => !["completed", "closed"].includes(m.status)
  ).length;

  const alerts: AlertItem[] = [
    submittedCount > 0
      ? {
          tone: "amber",
          title: "Pending approvals",
          text: `${submittedCount} booking(s) awaiting approval`,
        }
      : null,

    (kpi?.rejected_bookings ?? 0) > 0
      ? {
          tone: "red",
          title: "Rejected bookings",
          text: `${kpi?.rejected_bookings ?? 0} booking(s) were rejected in this period`,
        }
      : null,

    openMaintenance > 0
      ? {
          tone: "accent",
          title: "Open maintenance",
          text: `${openMaintenance} maintenance issue(s) still open`,
        }
      : null,

    (kpi?.total_fuel_amount ?? 0) >= 10000
      ? {
          tone: "amber",
          title: "High fuel spend",
          text: `Fuel spend has reached ${fmtMoney(kpi?.total_fuel_amount ?? 0)}`,
        }
      : null,

    (kpi?.total_bookings ?? 0) === 0 &&
    (kpi?.total_fuel_requests ?? 0) === 0 &&
    (kpi?.total_maintenance ?? 0) === 0
      ? {
          tone: "accent",
          title: "No activity",
          text: `No operational activity recorded for ${label}`,
        }
      : null,
  ].filter(Boolean) as AlertItem[];

  if (alerts.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {alerts.map((alert, i) => (
        <div
          key={`${alert.title}-${i}`}
          className="rounded-2xl border p-4"
          style={{
            background:
              alert.tone === "red"
                ? "color-mix(in srgb, var(--red) 8%, var(--surface))"
                : alert.tone === "amber"
                ? "color-mix(in srgb, var(--amber) 10%, var(--surface))"
                : "color-mix(in srgb, var(--accent) 8%, var(--surface))",
            borderColor:
              alert.tone === "red"
                ? "color-mix(in srgb, var(--red) 30%, var(--border))"
                : alert.tone === "amber"
                ? "color-mix(in srgb, var(--amber) 30%, var(--border))"
                : "color-mix(in srgb, var(--accent) 30%, var(--border))",
          }}
        >
          <div
            className="text-xs font-semibold uppercase tracking-wide"
            style={{
              color:
                alert.tone === "red"
                  ? "var(--red)"
                  : alert.tone === "amber"
                  ? "var(--amber)"
                  : "var(--accent)",
            }}
          >
            {alert.title}
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>
            {alert.text}
          </p>
        </div>
      ))}
    </div>
  );
}