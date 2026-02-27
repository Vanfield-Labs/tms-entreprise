// src/modules/shifts/pages/ShiftAdmin.tsx — with real driver names
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DriverProfile = { id: string; user_id: string; license_number: string; full_name: string };
type Shift = { driver_id: string; shift_date: string; effective_shift_code: string; base_shift_code: string; override_shift_code: string | null; full_name?: string };

const SHIFT_CODES = ["A", "B", "C", "D", "OFF", "REST"];

export default function ShiftAdmin() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [driverId, setDriverId] = useState("");
  const [date, setDate] = useState("");
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterDriver, setFilterDriver] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: s }] = await Promise.all([
      supabase.from("drivers").select("id, user_id, license_number, profiles(full_name)").order("license_number"),
      supabase.from("v_driver_shifts").select("driver_id,shift_date,effective_shift_code,base_shift_code,override_shift_code").order("shift_date", { ascending: false }).limit(100),
    ]);

    const driverList: DriverProfile[] = ((d as any[]) || []).map((dr) => ({
      id: dr.id,
      user_id: dr.user_id,
      license_number: dr.license_number,
      full_name: dr.profiles?.full_name ?? `Driver ${dr.license_number}`,
    }));
    setDrivers(driverList);

    // Enrich shifts with names
    const nameMap = Object.fromEntries(driverList.map((dr) => [dr.id, dr.full_name]));
    const enriched: Shift[] = ((s as any[]) || []).map((sh) => ({ ...sh, full_name: nameMap[sh.driver_id] ?? "Unknown Driver" }));
    setShifts(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const override = async () => {
    if (!driverId || !date || !code) return;
    setSaving(true);
    try {
      await supabase.rpc("override_shift", {
        p_driver_id: driverId, p_shift_date: date,
        p_new_shift_code: code, p_reason: reason || null,
      });
      setCode(""); setReason("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const filteredShifts = filterDriver
    ? shifts.filter((s) => s.driver_id === filterDriver)
    : shifts;

  const grouped: Record<string, Shift[]> = {};
  filteredShifts.forEach((s) => {
    if (!grouped[s.shift_date]) grouped[s.shift_date] = [];
    grouped[s.shift_date].push(s);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {/* Override form */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Override Shift</h3>
          <p className="text-xs text-gray-400 mt-0.5">Manually set a driver's shift for a specific date</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Driver *</label>
              <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className={selectCls}>
                <option value="">Select driver…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name} · {d.license_number}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">New Shift Code *</label>
              <select value={code} onChange={(e) => setCode(e.target.value)} className={selectCls}>
                <option value="">Select code…</option>
                {SHIFT_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Reason (optional)</label>
              <input placeholder="e.g. Emergency cover" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={override}
              disabled={!driverId || !date || !code || saving}
              className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Apply Override"}
            </button>
          </div>
        </div>
      </div>

      {/* Shift view */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Shift Schedule</h3>
            <p className="text-xs text-gray-400 mt-0.5">Recent shifts (last 100 entries)</p>
          </div>
          <select value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none w-full sm:w-auto">
            <option value="">All drivers</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">No shifts found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedDates.map((date) => (
              <div key={date} className="px-5 py-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">{new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</p>
                <div className="space-y-1.5">
                  {grouped[date].map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-700">{s.full_name}</span>
                      <div className="flex items-center gap-2">
                        {s.override_shift_code && (
                          <span className="text-xs text-gray-400 line-through">{s.base_shift_code}</span>
                        )}
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          s.effective_shift_code === "OFF" || s.effective_shift_code === "REST"
                            ? "bg-gray-100 text-gray-500"
                            : s.override_shift_code
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                        }`}>
                          {s.effective_shift_code}
                          {s.override_shift_code && " ✎"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const selectCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10";
const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10";