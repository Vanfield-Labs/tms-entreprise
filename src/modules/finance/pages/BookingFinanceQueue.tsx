import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Badge,
  Btn,
  Card,
  CountPill,
  EmptyState,
  PageSpinner,
} from "@/components/TmsUI";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";

type Booking = {
  id: string;
  purpose: string;
  trip_date: string;
  trip_time: string | null;
  pickup_location: string;
  dropoff_location: string;
  booking_type: string | null;
  num_passengers: number | null;
  created_by: string;
  created_at: string;
  status: string;
  requester_name: string;
  requester_position: string | null;
  requester_division: string | null;
  requester_unit: string | null;
};

export default function BookingFinanceQueue() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,purpose,trip_date,trip_time,pickup_location,dropoff_location,booking_type,num_passengers,created_by,created_at,status"
      )
      .eq("status", "finance_pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("BookingFinanceQueue load:", error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const bookings = (data as any[]) || [];

    if (bookings.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    let profileMap: Record<
      string,
      {
        name: string;
        position: string | null;
        division: string | null;
        unit: string | null;
      }
    > = {};

    try {
      const creatorIds = [
        ...new Set(bookings.map((row: any) => row.created_by).filter(Boolean)),
      ];

      const { data: profilesRaw } = await supabase
        .from("profiles")
        .select("user_id,full_name,position_title,division_id,unit_id")
        .in("user_id", creatorIds);

      const profiles = (profilesRaw as any[]) || [];
      const divisionIds = [
        ...new Set(profiles.map((row: any) => row.division_id).filter(Boolean)),
      ];
      const unitIds = [
        ...new Set(profiles.map((row: any) => row.unit_id).filter(Boolean)),
      ];

      const [{ data: divisionsRaw }, { data: unitsRaw }] = await Promise.all([
        divisionIds.length
          ? supabase.from("divisions").select("id,name").in("id", divisionIds)
          : Promise.resolve({ data: [] }),
        unitIds.length
          ? supabase.from("units").select("id,name").in("id", unitIds)
          : Promise.resolve({ data: [] }),
      ]);

      const divisionMap = Object.fromEntries(
        (((divisionsRaw as any[]) || []).map((row: any) => [row.id, row.name]))
      );
      const unitMap = Object.fromEntries(
        (((unitsRaw as any[]) || []).map((row: any) => [row.id, row.name]))
      );

      profiles.forEach((row: any) => {
        profileMap[row.user_id] = {
          name: row.full_name ?? "Unknown",
          position: row.position_title ?? null,
          division: row.division_id ? divisionMap[row.division_id] ?? null : null,
          unit: row.unit_id ? unitMap[row.unit_id] ?? null : null,
        };
      });
    } catch (profileError) {
      console.error("BookingFinanceQueue profile map:", profileError);
    }

    setItems(
      bookings.map((row: any) => {
        const profile = profileMap[row.created_by] ?? {
          name: "Unknown",
          position: null,
          division: null,
          unit: null,
        };

        return {
          ...row,
          requester_name: profile.name,
          requester_position: profile.position,
          requester_division: profile.division,
          requester_unit: profile.unit,
        };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const debouncedReload = useMemo(() => debounce(() => void load(), 350), [load]);

  useRealtimeTable({
    table: "bookings",
    event: "*",
    onChange: debouncedReload,
  });

  const act = async (id: string, nextStatus: "submitted" | "rejected") => {
    setActing((prev) => ({ ...prev, [id]: true }));

    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: nextStatus })
        .eq("id", id);

      if (error) throw error;
      await load();
    } catch (actionError: any) {
      alert(`Finance action failed: ${actionError.message}`);
    } finally {
      setActing((prev) => ({ ...prev, [id]: false }));
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState
          title="All caught up"
          subtitle="No bookings are waiting for finance review"
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <CountPill n={items.length} color="amber" />
            <span className="text-sm text-[color:var(--text-muted)]">
              booking{items.length !== 1 ? "s" : ""} awaiting finance approval
            </span>
          </div>

          <div className="space-y-3">
            {items.map((booking) => (
              <Card key={booking.id}>
                <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--amber-dim)]/30">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-[color:var(--text)]">
                      {booking.purpose}
                    </h3>
                    <Badge status="finance_pending" label="Finance Review" />
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

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "var(--amber)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {booking.requester_name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                        {booking.requester_name}
                      </p>
                      {booking.requester_position && (
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                          {booking.requester_position}
                        </p>
                      )}
                      {(booking.requester_division || booking.requester_unit) && (
                        <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "2px 0 0" }}>
                          {[booking.requester_division, booking.requester_unit]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>
                    Submitted {fmtDateTime(booking.created_at)}
                  </p>
                </div>

                <div className="px-4 py-3 space-y-2 border-b border-[color:var(--border)]">
                  <p className="text-xs text-[color:var(--text-muted)]">
                    <span className="font-medium">{fmtDate(booking.trip_date)}</span>
                    {booking.trip_time ? ` at ${booking.trip_time}` : ""}
                  </p>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    {booking.pickup_location} → {booking.dropoff_location}
                  </p>
                  {booking.booking_type && (
                    <p className="text-xs text-[color:var(--text-dim)] capitalize">
                      Type: {booking.booking_type.replace(/_/g, " ")}
                    </p>
                  )}
                  {booking.num_passengers != null && (
                    <p className="text-xs text-[color:var(--text-dim)]">
                      Passengers: {booking.num_passengers}
                    </p>
                  )}
                </div>

                <div className="p-4 grid grid-cols-2 gap-3">
                  <Btn
                    variant="danger"
                    onClick={() => act(booking.id, "rejected")}
                    loading={acting[booking.id]}
                  >
                    Reject
                  </Btn>
                  <Btn
                    variant="success"
                    onClick={() => act(booking.id, "submitted")}
                    loading={acting[booking.id]}
                  >
                    Send to Corporate
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
