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
  finance_approved_at?: string | null;
  finance_approved_by?: string | null;
  finance_notes?: string | null;
  finance_actor_name?: string | null;
};

export default function BookingFinanceQueue() {
  const [items, setItems] = useState<Booking[]>([]);
  const [historyItems, setHistoryItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [focusedBookingId, setFocusedBookingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,purpose,trip_date,trip_time,pickup_location,dropoff_location,booking_type,num_passengers,created_by,created_at,status,finance_approved_at,finance_approved_by,finance_notes"
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

    const { data: historyData, error: historyError } = await supabase
      .from("bookings")
      .select(
        "id,purpose,trip_date,trip_time,pickup_location,dropoff_location,booking_type,num_passengers,created_by,created_at,status,finance_approved_at,finance_approved_by,finance_notes"
      )
      .not("finance_approved_at", "is", null)
      .neq("status", "finance_pending")
      .order("finance_approved_at", { ascending: false })
      .limit(12);

    if (historyError) {
      console.error("BookingFinanceQueue history:", historyError.message);
    }

    const historyBookings = (historyData as any[]) || [];

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
        ...new Set(
          [...bookings, ...historyBookings]
            .map((row: any) => row.created_by)
            .filter(Boolean)
        ),
      ];
      const financeActorIds = [
        ...new Set(historyBookings.map((row: any) => row.finance_approved_by).filter(Boolean)),
      ];
      const profileIds = [...new Set([...creatorIds, ...financeActorIds])];

      const { data: profilesRaw } = await supabase
        .from("profiles")
        .select("user_id,full_name,position_title,division_id,unit_id")
        .in("user_id", profileIds);

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

    const mapBookingRow = (row: any) => {
      const profile = profileMap[row.created_by] ?? {
        name: "Unknown",
        position: null,
        division: null,
        unit: null,
      };
      const financeActor = row.finance_approved_by ? profileMap[row.finance_approved_by] : null;

      return {
        ...row,
        requester_name: profile.name,
        requester_position: profile.position,
        requester_division: profile.division,
        requester_unit: profile.unit,
        finance_actor_name: financeActor?.name ?? null,
      };
    };

    setItems(bookings.map(mapBookingRow));
    setHistoryItems(historyBookings.map(mapBookingRow));
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

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ entityType?: string; entityId?: string | null }>
      ).detail;

      if (detail?.entityType !== "booking" || !detail.entityId) return;

      setFocusedBookingId(detail.entityId);
      setExpanded(detail.entityId);

      window.setTimeout(() => {
        document
          .getElementById(`booking-finance-${detail.entityId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);

      window.setTimeout(() => {
        setFocusedBookingId((current) =>
          current === detail.entityId ? null : current
        );
      }, 4500);
    };

    window.addEventListener("tms:entity-focus", handler);
    return () => window.removeEventListener("tms:entity-focus", handler);
  }, []);

  const act = async (id: string, nextStatus: "submitted" | "rejected") => {
    setActing((prev) => ({ ...prev, [id]: true }));

    try {
      const { error } = await supabase.rpc("finance_review_booking", {
        p_booking_id: id,
        p_action: nextStatus === "submitted" ? "approved" : "rejected",
        p_comment: null,
      });

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
            {items.map((booking) => {
              const isOpen = expanded === booking.id;
              const isFocused = focusedBookingId === booking.id;

              return (
              <div key={booking.id} id={`booking-finance-${booking.id}`}>
              <Card>
                <div
                  className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--amber-dim)]/30"
                  style={{
                    boxShadow: isFocused
                      ? "0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent), 0 18px 40px rgba(0,0,0,0.12)"
                      : undefined,
                    transition: "all 0.3s ease",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-[color:var(--text)]">
                        {booking.purpose}
                      </h3>
                      <p className="text-[11px] mt-1 text-[color:var(--text-dim)]">
                        {fmtDate(booking.trip_date)}
                        {booking.trip_time ? ` at ${booking.trip_time}` : ""}
                      </p>
                    </div>
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

                <button
                  type="button"
                  className="w-full px-4 py-3 text-left border-b border-[color:var(--border)]"
                  onClick={() => setExpanded((current) => (current === booking.id ? null : booking.id))}
                >
                  <p className="text-xs text-[color:var(--text-muted)]">
                    {booking.pickup_location} → {booking.dropoff_location}
                  </p>
                  <p className="text-[11px] mt-1 text-[color:var(--accent)] font-medium">
                    {isOpen ? "Hide details" : "View details"}
                  </p>
                </button>

                {isOpen && (
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
                    <p className="text-xs text-[color:var(--text-dim)]">
                      Approval path: Finance → Corporate → Transport
                    </p>
                  </div>
                )}

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
              </div>
            );
            })}
          </div>
        </>
      )}

      <div className="pt-2">
        <div className="flex items-center gap-2 mb-3">
          <CountPill n={historyItems.length} color="green" />
          <span className="text-sm text-[color:var(--text-muted)]">
            recent finance history
          </span>
        </div>

        {historyItems.length === 0 ? (
          <Card>
            <div className="p-4 text-sm text-[color:var(--text-muted)]">
              Reviewed bookings will appear here after finance forwards or rejects them.
            </div>
          </Card>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr>
                    <th>Purpose</th>
                    <th>Requester</th>
                    <th>Finance Decision</th>
                    <th>Current Status</th>
                    <th>Reviewed</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((booking) => (
                    <tr key={`history-${booking.id}`}>
                      <td>
                        <div className="min-w-[180px]">
                          <p className="font-medium text-[color:var(--text)]">{booking.purpose}</p>
                          <p className="text-xs text-[color:var(--text-muted)]">
                            {fmtDate(booking.trip_date)}
                            {booking.trip_time ? ` at ${booking.trip_time}` : ""}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="min-w-[150px]">
                          <p className="font-medium text-[color:var(--text)]">{booking.requester_name}</p>
                          {(booking.requester_division || booking.requester_unit) && (
                            <p className="text-xs text-[color:var(--text-muted)]">
                              {[booking.requester_division, booking.requester_unit].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="min-w-[190px]">
                          <p className="text-sm text-[color:var(--text)]">
                            {booking.status === "rejected" ? "Rejected by Finance" : "Forwarded to Corporate"}
                          </p>
                          {booking.finance_actor_name && (
                            <p className="text-xs text-[color:var(--text-muted)]">
                              by {booking.finance_actor_name}
                            </p>
                          )}
                          {booking.finance_notes && (
                            <p className="text-xs text-[color:var(--text-dim)] mt-1">
                              {booking.finance_notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge status={booking.status} />
                      </td>
                      <td className="whitespace-nowrap text-[color:var(--text-muted)]">
                        {booking.finance_approved_at ? fmtDateTime(booking.finance_approved_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
