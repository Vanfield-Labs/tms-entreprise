// src/modules/shifts/pages/ShiftAdmin.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, Card, CardHeader, CardBody, Field, Select, Input, Btn, Badge } from "@/components/TmsUI";

type DriverProfile = { id: string; license_number: string; full_name: string };
type Shift = { driver_id: string; shift_date: string; effective_shift_code: string; base_shift_code: string; override_shift_code: string | null; full_name?: string };

const SHIFT_CODES = ["A","B","C","D","OFF","REST"];

export default function ShiftAdmin() {
  const [drivers,      setDrivers]      = useState<DriverProfile[]>([]);
  const [shifts,       setShifts]       = useState<Shift[]>([]);
  const [driverId,     setDriverId]     = useState("");
  const [date,         setDate]         = useState("");
  const [code,         setCode]         = useState("");
  const [reason,       setReason]       = useState("");
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [filterDriver, setFilterDriver] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: s }] = await Promise.all([
      supabase.from("drivers").select("id,license_number,profiles(full_name)").order("license_number"),
      supabase.from("v_driver_shifts").select("driver_id,shift_date,effective_shift_code,base_shift_code,override_shift_code").order("shift_date", { ascending: false }).limit(100),
    ]);
    const driverList: DriverProfile[] = ((d as any[]) || []).map(dr => ({
      id: dr.id, license_number: dr.license_number,
      full_name: dr.profiles?.full_name ?? `Driver ${dr.license_number}`,
    }));
    setDrivers(driverList);
    const nameMap = Object.fromEntries(driverList.map(dr => [dr.id, dr.full_name]));
    setShifts(((s as any[]) || []).map(sh => ({ ...sh, full_name: nameMap[sh.driver_id] ?? "Unknown" })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const override = async () => {
    if (!driverId || !date || !code) return;
    setSaving(true);
    try {
      await supabase.rpc("override_shift", { p_driver_id: driverId, p_shift_date: date, p_new_shift_code: code, p_reason: reason || null });
      setCode(""); setReason("");
      await load();
    } finally { setSaving(false); }
  };

  const filtered = filterDriver ? shifts.filter(s => s.driver_id === filterDriver) : shifts;
  const grouped: Record<string, Shift[]> = {};
  filtered.forEach(s => { (grouped[s.shift_date] ||= []).push(s); });
  const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {/* Override form */}
      <Card>
        <CardHeader title="Override Shift" subtitle="Manually set a driver's shift for a specific date" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Driver" required>
              <Select value={driverId} onChange={e => setDriverId(e.target.value)}>
                <option value="">Select driver…</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name} · {d.license_number}</option>)}
              </Select>
            </Field>
            <Field label="Date" required>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="New Shift Code" required>
              <Select value={code} onChange={e => setCode(e.target.value)}>
                <option value="">Select code…</option>
                {SHIFT_CODES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Reason (optional)">
              <Input placeholder="e.g. Emergency cover" value={reason} onChange={e => setReason(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Btn variant="primary" onClick={override} loading={saving} disabled={!driverId || !date || !code}>
              Apply Override
            </Btn>
          </div>
        </CardBody>
      </Card>

      {/* Shift schedule */}
      <Card>
        <div className="card-header flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="card-title">Shift Schedule</div>
            <p className="text-xs text-[color:var(--text-muted)] mt-0.5">Recent 100 entries</p>
          </div>
          <Select value={filterDriver} onChange={e => setFilterDriver(e.target.value)} className="sm:w-48">
            <option value="">All drivers</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-[color:var(--text)] border-t-transparent rounded-full animate-spin"/></div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-12 text-sm text-[color:var(--text-muted)]">No shifts found</div>
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {sortedDates.map(d => (
              <div key={d} className="px-5 py-3">
                <p className="text-xs font-semibold text-[color:var(--text-muted)] mb-2">
                  {new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                </p>
                <div className="space-y-1.5">
                  {grouped[d].map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-[color:var(--text)]">{s.full_name}</span>
                      <div className="flex items-center gap-2">
                        {s.override_shift_code && (
                          <span className="text-xs text-[color:var(--text-dim)] line-through">{s.base_shift_code}</span>
                        )}
                        <span className={`badge ${
                          s.effective_shift_code === "OFF" || s.effective_shift_code === "REST"
                            ? "badge-inactive"
                            : s.override_shift_code
                              ? "badge-amber"
                              : "badge-active"
                        }`}>{s.effective_shift_code}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}