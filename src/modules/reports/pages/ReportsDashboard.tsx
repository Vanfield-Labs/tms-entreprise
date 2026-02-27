// src/modules/reports/pages/ReportsDashboard.tsx — mobile-first
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type StatusCount = { status: string; total: number };
type DailyCount = { trip_date: string; total: number };
type FuelMonthly = { month: string; requests: number; total_liters: number; total_amount: number };
type MaintMonthly = { month: string; requests: number; closed_count: number };
type UtilRow = { vehicle_id: string; plate_number: string; trips: number };

export default function ReportsDashboard() {
  const [kpis, setKpis] = useState<any>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [fuelMonthly, setFuelMonthly] = useState<FuelMonthly[]>([]);
  const [maintMonthly, setMaintMonthly] = useState<MaintMonthly[]>([]);
  const [util, setUtil] = useState<UtilRow[]>([]);
  const [loading, setLoading] = useState(true);

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
      setKpis(k);
      setStatusCounts((s as any) || []);
      setDailyCounts((d as any) || []);
      setFuelMonthly((f as any) || []);
      setMaintMonthly((m as any) || []);
      setUtil((u as any) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;

  const kpiCards = kpis ? [
    { label: "Bookings (30d)", value: kpis.bookings_30d, color: "bg-sky-50 text-sky-700", icon: "📋" },
    { label: "Pending Approvals", value: kpis.pending_approvals, color: "bg-amber-50 text-amber-700", icon: "⏳" },
    { label: "Approved (undispatched)", value: kpis.approved_not_dispatched, color: "bg-violet-50 text-violet-700", icon: "✅" },
    { label: "Active Trips", value: kpis.active_trips, color: "bg-green-50 text-green-700", icon: "🚗" },
    { label: "Fuel Submitted", value: kpis.fuel_submitted, color: "bg-orange-50 text-orange-700", icon: "⛽" },
    { label: "Maintenance Open", value: kpis.maintenance_open, color: "bg-red-50 text-red-700", icon: "🔧" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {kpiCards.map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold text-gray-900">{card.value ?? "—"}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-snug">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Data sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Booking Status (90 days)">
          {statusCounts.map((r, i) => (
            <DataRow key={i} label={<span className="capitalize">{r.status}</span>} value={r.total} />
          ))}
          {statusCounts.length === 0 && <Empty />}
        </Section>

        <Section title="Bookings per Day (30 days)">
          {dailyCounts.slice(0, 10).map((r, i) => (
            <DataRow key={i} label={r.trip_date} value={r.total} />
          ))}
          {dailyCounts.length === 0 && <Empty />}
          {dailyCounts.length > 10 && <p className="text-xs text-gray-400 mt-2">+{dailyCounts.length - 10} more days</p>}
        </Section>

        <Section title="Fuel Monthly (12 months)">
          {fuelMonthly.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
              <span className="text-gray-600">{r.month}</span>
              <div className="text-right text-xs text-gray-500 space-y-0.5">
                <div>{r.requests} req · {r.total_liters}L</div>
                <div className="font-medium text-gray-900">GHS {r.total_amount}</div>
              </div>
            </div>
          ))}
          {fuelMonthly.length === 0 && <Empty />}
        </Section>

        <Section title="Maintenance Monthly (12 months)">
          {maintMonthly.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
              <span className="text-gray-600">{r.month}</span>
              <div className="text-right text-xs text-gray-500 space-y-0.5">
                <div>{r.requests} reported</div>
                <div className="font-medium text-gray-900">{r.closed_count} closed</div>
              </div>
            </div>
          ))}
          {maintMonthly.length === 0 && <Empty />}
        </Section>

        <div className="md:col-span-2">
          <Section title="Vehicle Utilization (30 days)">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {util.map((r, i) => (
                <div key={i} className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-lg font-bold text-gray-900">{r.trips}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{r.plate_number}</div>
                  <div className="text-[10px] text-gray-400">trips</div>
                </div>
              ))}
              {util.length === 0 && <div className="col-span-full"><Empty /></div>}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DataRow({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-gray-400 py-2 text-center">No data available</p>;
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>;
}
