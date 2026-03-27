// src/modules/dispatch/pages/DispatchBoard.tsx

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase, cachedFetch } from "@/lib/supabase";
import {
  EmptyState,
  Badge,
  Card,
  StatCard,
  Field,
  Select,
  Input,
  Btn,
} from "@/components/TmsUI";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";

type Booking = {
  id: string;
  purpose: string;
  trip_date: string;
  trip_time: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_digital_address: string | null;
  dropoff_digital_address: string | null;
  booking_type: string | null;
  num_passengers: number | null;
  trip_notes: string | null;
  status: string;
  created_by: string;
  created_at: string;
  requester_name: string;
  requester_position: string | null;
  requester_division: string | null;
  requester_unit: string | null;
};

type Vehicle = {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  fuel_type: string | null;
};

type Driver = {
  driver_id: string;
  full_name: string;
  license_number: string;
  phone: string | null;
};

function DispatchBoardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
          >
            <div className="h-3 w-20 rounded bg-[color:var(--surface-2)]" />
            <div className="mt-3 h-8 w-12 rounded bg-[color:var(--surface-2)]" />
          </div>
        ))}
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]"
        >
          <div className="px-4 py-3 border-b border-[color:var(--border)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-40 rounded bg-[color:var(--surface-2)]" />
                <div className="mt-2 h-3 w-28 rounded bg-[color:var(--surface-2)]" />
              </div>
              <div className="h-6 w-20 rounded-full bg-[color:var(--surface-2)]" />
            </div>
          </div>

          <div className="px-4 py-3 border-b border-[color:var(--border)] space-y-3">
            <div className="h-3 w-24 rounded bg-[color:var(--surface-2)]" />
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-[color:var(--surface-2)] shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-32 rounded bg-[color:var(--surface-2)]" />
                <div className="h-3 w-28 rounded bg-[color:var(--surface-2)]" />
                <div className="h-3 w-40 rounded bg-[color:var(--surface-2)]" />
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-[color:var(--border)] space-y-3">
            <div className="h-3 w-20 rounded bg-[color:var(--surface-2)]" />
            <div className="h-3 w-36 rounded bg-[color:var(--surface-2)]" />
            <div className="space-y-3">
              <div className="h-4 w-48 rounded bg-[color:var(--surface-2)]" />
              <div className="h-4 w-52 rounded bg-[color:var(--surface-2)]" />
            </div>
            <div className="h-3 w-24 rounded bg-[color:var(--surface-2)]" />
          </div>

          <div className="p-4 space-y-3">
            <div className="h-3 w-28 rounded bg-[color:var(--surface-2)]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="h-3 w-16 rounded bg-[color:var(--surface-2)]" />
                <div className="h-10 w-full rounded-xl bg-[color:var(--surface-2)]" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-16 rounded bg-[color:var(--surface-2)]" />
                <div className="h-10 w-full rounded-xl bg-[color:var(--surface-2)]" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-[color:var(--surface-2)]" />
              <div className="h-10 w-full rounded-xl bg-[color:var(--surface-2)]" />
            </div>
            <div className="h-10 w-full rounded-xl bg-[color:var(--surface-2)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DispatchBoard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selVehicle, setSelVehicle] = useState<Record<string, string>>({});
  const [selDriver, setSelDriver] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dispatching, setDispatching] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Record<string, string>>({});
  const [focusedBookingId, setFocusedBookingId] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);

    try {
      const { data: bookingsRaw } = await supabase
        .from("bookings")
        .select(
          "id,purpose,trip_date,trip_time,pickup_location,dropoff_location,pickup_digital_address,dropoff_digital_address,booking_type,num_passengers,trip_notes,status,created_by,created_at"
        )
        .eq("status", "approved")
        .order("trip_date", { ascending: true });

      const bookingRows = (bookingsRaw as any[]) || [];

      const vehiclesData = await cachedFetch<Vehicle[]>(
        "dispatch_active_vehicles",
        async () => {
          const { data } = await supabase
            .from("vehicles")
            .select("id,plate_number,make,model,fuel_type")
            .eq("status", "active")
            .order("plate_number");

          return (data as Vehicle[]) || [];
        },
        force
      );

      setVehicles(vehiclesData);

      const rawDrivers = await cachedFetch<any[]>(
        "dispatch_active_drivers_raw",
        async () => {
          const { data } = await supabase
            .from("drivers")
            .select("id,full_name,license_number,phone,user_id")
            .eq("employment_status", "active")
            .order("full_name");

          return (data as any[]) || [];
        },
        force
      );

      const missingDriverProfileIds = rawDrivers
        .filter((d) => !d.full_name && d.user_id)
        .map((d) => d.user_id);

      let driverNameMap: Record<string, string> = {};

      if (missingDriverProfileIds.length > 0) {
        const profileKey = `dispatch_driver_name_map:${missingDriverProfileIds
          .slice()
          .sort()
          .join(",")}`;

        driverNameMap = await cachedFetch<Record<string, string>>(
          profileKey,
          async () => {
            const { data } = await supabase
              .from("profiles")
              .select("user_id,full_name")
              .in("user_id", missingDriverProfileIds);

            return Object.fromEntries(
              ((data as any[]) || []).map((p) => [p.user_id, p.full_name])
            );
          },
          force
        );
      }

      setDrivers(
        rawDrivers.map((d) => ({
          driver_id: d.id,
          license_number: d.license_number,
          phone: d.phone ?? null,
          full_name:
            d.full_name ??
            (d.user_id
              ? driverNameMap[d.user_id] ?? `Driver ${d.license_number}`
              : `Driver ${d.license_number}`),
        }))
      );

      let requesterMap: Record<
        string,
        {
          name: string;
          position: string | null;
          division: string | null;
          unit: string | null;
        }
      > = {};

      if (bookingRows.length > 0) {
        const creatorIds = [...new Set(bookingRows.map((b) => b.created_by).filter(Boolean))];
        const requesterKey = `dispatch_requester_map:${creatorIds.slice().sort().join(",")}`;

        requesterMap = await cachedFetch(
          requesterKey,
          async () => {
            const { data: profilesRaw } = await supabase
              .from("profiles")
              .select("user_id,full_name,position_title,division_id,unit_id")
              .in("user_id", creatorIds);

            const profiles = (profilesRaw as any[]) || [];

            const divisionIds = [
              ...new Set(profiles.map((p) => p.division_id).filter(Boolean)),
            ];
            const unitIds = [
              ...new Set(profiles.map((p) => p.unit_id).filter(Boolean)),
            ];

            const [{ data: divsRaw }, { data: unitsRaw }] = await Promise.all([
              divisionIds.length
                ? supabase.from("divisions").select("id,name").in("id", divisionIds)
                : Promise.resolve({ data: [] as any[] }),
              unitIds.length
                ? supabase.from("units").select("id,name").in("id", unitIds)
                : Promise.resolve({ data: [] as any[] }),
            ]);

            const divMap = Object.fromEntries(
              ((divsRaw as any[]) || []).map((d) => [d.id, d.name])
            );
            const unitMap = Object.fromEntries(
              ((unitsRaw as any[]) || []).map((u) => [u.id, u.name])
            );

            const map: Record<
              string,
              {
                name: string;
                position: string | null;
                division: string | null;
                unit: string | null;
              }
            > = {};

            profiles.forEach((p) => {
              map[p.user_id] = {
                name: p.full_name ?? "—",
                position: p.position_title ?? null,
                division: p.division_id ? divMap[p.division_id] ?? null : null,
                unit: p.unit_id ? unitMap[p.unit_id] ?? null : null,
              };
            });

            return map;
          },
          force
        );
      }

      setBookings(
        bookingRows.map((b) => {
          const prof = requesterMap[b.created_by] ?? {
            name: "—",
            position: null,
            division: null,
            unit: null,
          };

          return {
            ...b,
            requester_name: prof.name,
            requester_position: prof.position,
            requester_division: prof.division,
            requester_unit: prof.unit,
          };
        })
      );
    } catch (e) {
      console.error("DispatchBoard load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const debouncedReload = useMemo(
    () => debounce(() => void load(true), 500),
    [load]
  );

  useRealtimeTable({
    table: "bookings",
    event: "*",
    onChange: debouncedReload,
  });

  useRealtimeTable({
    table: "dispatch_assignments",
    event: "*",
    onChange: debouncedReload,
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ entityType?: string; entityId?: string | null }>).detail;
      if (!detail?.entityId) return;
      if (detail.entityType !== "booking") return;

      setFocusedBookingId(detail.entityId);

      window.setTimeout(() => {
        document
          .getElementById(`dispatch-booking-${detail.entityId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);

      window.setTimeout(() => {
        setFocusedBookingId((prev) => (prev === detail.entityId ? null : prev));
      }, 4500);
    };

    window.addEventListener("tms:entity-focus", handler);
    return () => window.removeEventListener("tms:entity-focus", handler);
  }, []);

  const dispatch = async (bookingId: string) => {
    const vehicleId = selVehicle[bookingId];
    const driverId = selDriver[bookingId];

    if (!vehicleId || !driverId) return;

    setDispatching((m) => ({ ...m, [bookingId]: true }));
    setError((m) => ({ ...m, [bookingId]: "" }));

    try {
      const { error: rpcErr } = await supabase.rpc("dispatch_booking", {
        p_booking_id: bookingId,
        p_vehicle_id: vehicleId,
        p_driver_id: driverId,
        p_notes: notes[bookingId] || null,
      });

      if (rpcErr) throw rpcErr;

      await load(true);
    } catch (e: any) {
      setError((m) => ({
        ...m,
        [bookingId]: e.message ?? "Dispatch failed.",
      }));
    } finally {
      setDispatching((m) => ({ ...m, [bookingId]: false }));
    }
  };

  if (loading) return <DispatchBoardSkeleton />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="To Dispatch" value={bookings.length} />
        <StatCard label="Vehicles" value={vehicles.length} />
        <StatCard label="Drivers" value={drivers.length} />
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          title="Nothing to dispatch"
          subtitle="No approved bookings awaiting assignment"
        />
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const ready = !!(selVehicle[b.id] && selDriver[b.id]);
            const selectedDriver = drivers.find((d) => d.driver_id === selDriver[b.id]);
            const requesterInitials = b.requester_name
              .split(" ")
              .map((n) => n[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();

            const isFocused = focusedBookingId === b.id;

            return (
              <div key={b.id} id={`dispatch-booking-${b.id}`}>
                <Card className={isFocused ? "transition-all duration-300" : undefined}>
                  <div
                    className="overflow-hidden rounded-2xl"
                    style={{
                      boxShadow: isFocused
                        ? "0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent), 0 18px 40px rgba(0,0,0,0.12)"
                        : undefined,
                      transition: "all 0.3s ease",
                    }}
                  >
                    <div
                      className="px-4 py-3 border-b border-[color:var(--border)]"
                      style={{
                        background: isFocused
                          ? "color-mix(in srgb, var(--accent-dim) 45%, var(--surface))"
                          : "color-mix(in srgb, var(--green-dim) 60%, var(--surface))",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-[color:var(--text)]">
                            {b.purpose}
                          </p>
                          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
                            Submitted {fmtDateTime(b.created_at)}
                          </p>
                        </div>
                        <Badge status="approved" />
                      </div>
                    </div>

                    <div
                      className="px-4 py-3 border-b border-[color:var(--border)]"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <p
                        className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Requested By
                      </p>

                      <div className="flex items-start gap-3">
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: "var(--accent)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#fff",
                            flexShrink: 0,
                          }}
                        >
                          {requesterInitials || "—"}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "var(--text)",
                              margin: 0,
                              lineHeight: 1.3,
                            }}
                          >
                            {b.requester_name}
                          </p>

                          {b.requester_position && (
                            <p
                              style={{
                                fontSize: 12,
                                color: "var(--text-muted)",
                                margin: "2px 0 0",
                                lineHeight: 1.3,
                              }}
                            >
                              {b.requester_position}
                            </p>
                          )}

                          {(b.requester_division || b.requester_unit) && (
                            <p
                              style={{
                                fontSize: 11,
                                color: "var(--text-dim)",
                                margin: "2px 0 0",
                                lineHeight: 1.3,
                              }}
                            >
                              {[b.requester_division, b.requester_unit]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-4 py-3 border-b border-[color:var(--border)] space-y-3">
                      <p
                        className="text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Trip Details
                      </p>

                      <div
                        className="flex items-center gap-2 text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>
                            {fmtDate(b.trip_date)}
                          </span>{" "}
                          at {b.trip_time}
                        </span>
                      </div>

                      <div
                        className="rounded-xl border px-3 py-3"
                        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 4,
                              paddingTop: 2,
                              flexShrink: 0,
                            }}
                          >
                            <div
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                border: "2px solid var(--accent)",
                                background: "var(--surface)",
                              }}
                            />
                            <div
                              style={{
                                width: 1,
                                flex: 1,
                                minHeight: 18,
                                background: "var(--border-bright)",
                              }}
                            />
                            <div
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: "var(--text)",
                              }}
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-3">
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                                {b.pickup_location}
                              </p>
                              {b.pickup_digital_address && (
                                <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "2px 0 0" }}>
                                  {b.pickup_digital_address}
                                </p>
                              )}
                            </div>

                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                                {b.dropoff_location}
                              </p>
                              {b.dropoff_digital_address && (
                                <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "2px 0 0" }}>
                                  {b.dropoff_digital_address}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {b.booking_type && (
                          <span
                            className="text-xs px-2 py-1 rounded-full"
                            style={{
                              background: "var(--surface-2)",
                              color: "var(--text)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {b.booking_type}
                          </span>
                        )}

                        {b.num_passengers != null && b.num_passengers > 0 && (
                          <span
                            className="text-xs px-2 py-1 rounded-full"
                            style={{
                              background: "var(--surface-2)",
                              color: "var(--text)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            👥 {b.num_passengers} passenger{b.num_passengers !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {b.trip_notes && (
                        <div
                          className="rounded-lg px-3 py-2 text-xs"
                          style={{
                            background: "var(--surface-2)",
                            color: "var(--text-muted)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>Notes: </span>
                          {b.trip_notes}
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      <p
                        className="text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Assign Resources
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Vehicle *">
                          <Select
                            value={selVehicle[b.id] || ""}
                            onChange={(e) =>
                              setSelVehicle((m) => ({
                                ...m,
                                [b.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">— Select vehicle —</option>
                            {vehicles.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.plate_number}
                                {v.make ? ` · ${v.make}` : ""}
                                {v.model ? ` ${v.model}` : ""}
                                {v.fuel_type ? ` (${v.fuel_type})` : ""}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Driver *">
                          <Select
                            value={selDriver[b.id] || ""}
                            onChange={(e) =>
                              setSelDriver((m) => ({
                                ...m,
                                [b.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">— Select driver —</option>
                            {drivers.map((d) => (
                              <option key={d.driver_id} value={d.driver_id}>
                                {d.full_name}
                                {d.phone ? ` · ${d.phone}` : ""}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>

                      {selectedDriver && (
                        <div
                          className="rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap"
                          style={{
                            background: "var(--accent-dim)",
                            border: "1px solid var(--accent)",
                          }}
                        >
                          <span>🧑‍✈️</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                            {selectedDriver.full_name}
                          </span>
                          <span style={{ color: "var(--text-dim)" }}>·</span>
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: "monospace",
                              color: "var(--text-muted)",
                            }}
                          >
                            {selectedDriver.license_number}
                          </span>
                          {selectedDriver.phone && (
                            <>
                              <span style={{ color: "var(--text-dim)" }}>·</span>
                              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                {selectedDriver.phone}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      <Field label="Notes (optional)">
                        <Input
                          placeholder="Special instructions for the driver…"
                          value={notes[b.id] || ""}
                          onChange={(e) =>
                            setNotes((m) => ({
                              ...m,
                              [b.id]: e.target.value,
                            }))
                          }
                        />
                      </Field>

                      {error[b.id] && (
                        <p style={{ fontSize: 12, color: "var(--red)" }}>
                          {error[b.id]}
                        </p>
                      )}

                      <Btn
                        variant="primary"
                        className="w-full"
                        disabled={!ready}
                        loading={dispatching[b.id]}
                        onClick={() => dispatch(b.id)}
                      >
                        Dispatch
                      </Btn>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}