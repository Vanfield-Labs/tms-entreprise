// src/modules/bookings/pages/CloseTrips.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  PageSpinner,
  EmptyState,
  Badge,
  Card,
  CountPill,
  Btn,
} from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";

type Booking = {
  id: string;
  purpose: string;
  trip_date: string;
  trip_time: string;
  pickup_location: string;
  dropoff_location: string;
  status: string;
  created_at: string;
  vehicle_plate?: string | null;
  driver_name?: string | null;
};

export default function CloseTrips() {
  const [trips, setTrips] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<Record<string, boolean>>({});
  const [focusedTripId, setFocusedTripId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status,created_at,vehicles(plate_number),drivers(profiles(full_name))"
      )
      .eq("status", "completed")
      .order("trip_date", { ascending: false })
      .limit(100);

    if (error) {
      console.error("CloseTrips load:", error.message);
      setLoading(false);
      return;
    }

    setTrips(
      ((data as any[]) || []).map((b) => ({
        ...b,
        vehicle_plate: b.vehicles?.plate_number ?? null,
        driver_name: b.drivers?.profiles?.full_name ?? null,
      }))
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const debouncedReload = useMemo(() => debounce(() => void load(), 400), [load]);

  useRealtimeTable({
    table: "bookings",
    event: "*",
    onChange: debouncedReload,
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ entityType?: string; entityId?: string | null }>).detail;
      if (!detail?.entityId) return;
      if (detail.entityType !== "trip" && detail.entityType !== "booking") return;

      setFocusedTripId(detail.entityId);

      window.setTimeout(() => {
        document
          .getElementById(`close-trip-${detail.entityId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);

      window.setTimeout(() => {
        setFocusedTripId((prev) => (prev === detail.entityId ? null : prev));
      }, 4500);
    };

    window.addEventListener("tms:entity-focus", handler);
    return () => window.removeEventListener("tms:entity-focus", handler);
  }, []);

  const close = async (id: string) => {
    setClosing((m) => ({ ...m, [id]: true }));
    try {
      const { error } = await supabase.rpc("close_booking", { p_booking_id: id });
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e.message ?? "Failed to close trip.");
    } finally {
      setClosing((m) => ({ ...m, [id]: false }));
    }
  };

  if (loading) return <PageSpinner variant="cards" count={3} />;

  return (
    <div className="space-y-4">
      {trips.length === 0 ? (
        <EmptyState
          title="No completed trips"
          subtitle="Trips marked as completed will appear here for closing"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          }
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <CountPill n={trips.length} color="green" />
            <span className="text-sm text-[color:var(--text-muted)]">
              trip{trips.length !== 1 ? "s" : ""} ready to close
            </span>
          </div>

          <div className="space-y-3">
            {trips.map((t) => {
              const isFocused = focusedTripId === t.id;

              return (
                <div key={t.id} id={`close-trip-${t.id}`}>
                  <Card className={isFocused ? "transition-all duration-300" : undefined}>
                    <div
                      style={{
                        boxShadow: isFocused
                          ? "0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent), 0 18px 40px rgba(0,0,0,0.12)"
                          : undefined,
                        transition: "all 0.3s ease",
                        borderRadius: 16,
                      }}
                    >
                      <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--green)]/10">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm text-[color:var(--text)]">
                              {t.purpose}
                            </p>
                            <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
                              {fmtDate(t.trip_date)} at {t.trip_time}
                            </p>
                          </div>
                          <Badge status={t.status} />
                        </div>
                      </div>

                      <div className="px-4 py-3 space-y-1.5 border-b border-[color:var(--border)]">
                        <p className="text-xs text-[color:var(--text-muted)] truncate">
                          {t.pickup_location} → {t.dropoff_location}
                        </p>
                        {t.vehicle_plate && (
                          <p className="text-xs text-[color:var(--accent)]">🚗 {t.vehicle_plate}</p>
                        )}
                        {t.driver_name && (
                          <p className="text-xs text-[color:var(--text-muted)]">
                            👤 {t.driver_name}
                          </p>
                        )}
                      </div>

                      <div className="p-4">
                        <Btn
                          variant="primary"
                          className="w-full"
                          loading={closing[t.id]}
                          onClick={() => close(t.id)}
                        >
                          Close Trip ✓
                        </Btn>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
