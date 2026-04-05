// src/modules/shifts/pages/ShiftAdmin.tsx
// Queries shift_schedules directly — shift_code values: morning | evening | off
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, Card, CardHeader, CardBody, Field, Select, Input, Btn, Badge } from "@/components/TmsUI";

type DriverProfile = { id: string; license_number: string; full_name: string };
type ShiftEntry = {
  id: string;
  driver_id: string;
  shift_date: string;
  shift_code: string;
  is_override: boolean;
  override_reason: string | null;
  full_name?: string;
};

const SHIFT_CODES = ["morning", "evening", "off"] as const;
type ShiftCode = typeof SHIFT_CODES[number];

const SHIFT_BADGE_STYLES: Record<string, string> = {
  morning: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  evening: "bg-blue-100  text-blue-700  dark:bg-blue-500/20  dark:text-blue-400",
  off:     "bg-gray-100  text-gray-500  dark:bg-gray-700      dark:text-gray-400",
};

function shiftBadge(code: string) {
  return SHIFT_BADGE_STYLES[code] ?? SHIFT_BADGE_STYLES.off;
}

export default function ShiftAdmin() {
  const [drivers,      setDrivers]      = useState<DriverProfile[]>([]);
  const [shifts,       setShifts]       = useState<ShiftEntry[]>([]);
  const [driverId,     setDriverId]     = useState("");
  const [date,         setDate]         = useState("");
  const [code,         setCode]         = useState<ShiftCode | "">("");
  const [reason,       setReason]       = useState("");
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [filterDriver, setFilterDriver] = useState("");
  const [err,          setErr]          = useState<string | null>(null);
  const [ok,           setOk]           = useState<string | null>(null);

  const flash = (msg: string) => { setOk(msg); setTimeout(() => setOk(null), 3000); };

  const load = async () => {
    setLoading(true);
    // Load drivers (split join to avoid silent failures)
    const [{ data: driverData }, { data: profileData }] = await Promise.all([
      supabase.from("drivers").select("id,license_number,full_name").order("full_name"),
      supabase.from("profiles").select("user_id,full_name"),
    ]);

    const profileMap = Object.fromEntries(
      ((profileData ?? []) as { user_id: string; full_name: string }[]).map(p => [p.user_id, p.full_name])
    );

    const driverList: DriverProfile[] = ((driverData ?? []) as any[]).map(dr => ({
      id: dr.id,
      license_number: dr.license_number,
      full_name: dr.full_name ?? profileMap[dr.user_id] ?? `Driver ${dr.license_number}`,
    }));
    setDrivers(driverList);

    // Load recent shift overrides from shift_schedules where is_override = true
    const { data: shiftData } = await supabase
      .from("shift_schedules")
      .select("id,driver_id,shift_date,shift_code,is_override,override_reason")
      .order("shift_date", { ascending: false })
      .limit(150);

    const nameMap = Object.fromEntries(driverList.map(dr => [dr.id, dr.full_name]));
    setShifts(
      ((shiftData ?? []) as any[]).map(s => ({
        ...s,
        full_name: nameMap[s.driver_id] ?? "Unknown",
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const applyOverride = async () => {
    if (!driverId || !date || !code) return;
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc("override_shift", {
        p_driver_id: driverId,
        p_shift_date: date,
        p_new_shift_code: code,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      setCode("");
      setReason("");
      flash("Override applied successfully.");
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Failed to apply override.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = filterDriver
    ? shifts.filter(s => s.driver_id === filterDriver)
    : shifts;

  // Group by date for display
  const grouped: Record<string, ShiftEntry[]> = {};
  filtered.forEach(s => {
    (grouped[s.shift_date] ||= []).push(s);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const overrideCount = shifts.filter(s => s.is_override).length;

  return (
    <div className="space-y-4">
      {/* Flash messages */}
      {ok && (
        <div className="alert alert-success fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 z-50 shadow-xl">
          ✓ {ok}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Shift Overrides</h1>
        <p className="page-sub">Manually set a driver's shift for a specific date</p>
      </div>

      {/* Override form */}
      <Card>
        <CardHeader
          title="Apply Override"
          subtitle="This will replace the generated schedule entry for that driver & date"
        />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Driver" required>
              <Select value={driverId} onChange={e => setDriverId(e.target.value)}>
                <option value="">Select driver…</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name} · {d.license_number}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date" required>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="New Shift" required>
              <Select value={code} onChange={e => setCode(e.target.value as ShiftCode | "")}>
                <option value="">Select shift…</option>
                {SHIFT_CODES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Reason (optional)">
              <Input
                placeholder="e.g. Emergency cover, schedule swap"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </Field>
          </div>

          {err && (
            <div className="alert alert-error">
              <span>{err}</span>
            </div>
          )}

          <div className="flex justify-end">
            <Btn
              variant="primary"
              onClick={applyOverride}
              loading={saving}
              disabled={!driverId || !date || !code}
            >
              Apply Override
            </Btn>
          </div>
        </CardBody>
      </Card>

      {/* Schedule view */}
      <Card>
        <div className="card-header flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="card-title">Schedule Entries</div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {shifts.length} total · {overrideCount} overridden
            </p>
          </div>
          <Select
            value={filterDriver}
            onChange={e => setFilterDriver(e.target.value)}
            className="sm:w-56"
          >
            <option value="">All drivers</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <PageSpinner variant="table" rows={6} cols={4} />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div>No schedule entries found</div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {sortedDates.map(dateStr => (
              <div key={dateStr}>
                {/* Date heading */}
                <div className="px-5 py-2" style={{ background: "var(--surface-2)" }}>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
                  </span>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y" style={{ borderColor: "var(--border)" }}>
                  {grouped[dateStr].map(s => (
                    <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                          {s.full_name}
                        </p>
                        {s.override_reason && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--amber)" }}>
                            ✏️ {s.override_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.is_override && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                            style={{ background: "var(--amber-bg, rgba(217,119,6,0.12))", color: "var(--amber)" }}>
                            OVERRIDE
                          </span>
                        )}
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${shiftBadge(s.shift_code)}`}>
                          {s.shift_code}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table rows */}
                <div className="hidden sm:block">
                  <table className="tms-table">
                    <tbody>
                      {grouped[dateStr].map(s => (
                        <tr key={s.id}>
                          <td className="font-medium">{s.full_name}</td>
                          <td>
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${shiftBadge(s.shift_code)}`}>
                              {s.shift_code}
                            </span>
                          </td>
                          <td>
                            {s.is_override ? (
                              <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                                style={{ background: "var(--amber-bg, rgba(217,119,6,0.12))", color: "var(--amber)" }}>
                                Override
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--text-dim)" }}>Generated</span>
                            )}
                          </td>
                          <td className="text-xs max-w-xs truncate" style={{ color: "var(--text-muted)" }}>
                            {s.override_reason ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
