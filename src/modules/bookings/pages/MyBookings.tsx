// src/modules/bookings/pages/MyBookings.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageSpinner, EmptyState, Badge, Card, Btn, TabBar } from "@/components/TmsUI";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import BookingDetailView from "@/modules/bookings/pages/BookingDetailView";

type Booking = {
  id: string;
  purpose: string;
  trip_date: string;
  trip_time: string;
  pickup_location: string;
  dropoff_location: string;
  status: string;
  created_at: string;
  driver_name: string | null;
  driver_phone: string | null;
  driver_team: string | null;
  driver_team_role: string | null;
  team_leader_name: string | null;
  team_leader_phone: string | null;
  vehicle_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  needs_finance_approval?: boolean | null;
  expires_at?: string | null;
  expired_at?: string | null;
};

type Tab = "active" | "all";
const ACTIVE_STATUSES = ["draft", "rejected", "finance_pending", "submitted", "approved", "dispatched"];
const EDIT_BOOKING_STORAGE_KEY = "tms-edit-booking-id";

export default function MyBookings() {
  const { user, loading: authLoading } = useAuth();
  const [rows,       setRows]      = useState<Booking[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [tab,        setTab]       = useState<Tab>("active");
  const [submitting, setSubmitting]= useState<Record<string, boolean>>({});
  const [amending,   setAmending]  = useState<Record<string, boolean>>({});
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // 1. Fetch user's bookings
      const { data: bookingsRaw, error: bookingsErr } = await supabase
        .from("bookings")
        .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status,created_at,needs_finance_approval,expires_at,expired_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (bookingsErr) {
        console.error("MyBookings: bookings fetch error", bookingsErr.message);
        setRows([]);
        return;
      }

      const bookings = (bookingsRaw as any[]) || [];

      if (bookings.length === 0) {
        setRows([]);
        return;
      }

      // 2. Fetch dispatch assignments
      const bookingIds = bookings.map((b: any) => b.id);
      const { data: assignmentsRaw } = await supabase
        .from("dispatch_assignments")
        .select("booking_id,driver_id,vehicle_id")
        .in("booking_id", bookingIds);

      const assignments = (assignmentsRaw as any[]) || [];

      if (assignments.length === 0) {
        setRows(bookings.map((b: any) => ({
          ...b,
          driver_name: null, driver_phone: null,
          driver_team: null, driver_team_role: null,
          team_leader_name: null, team_leader_phone: null,
          vehicle_plate: null, vehicle_make: null, vehicle_model: null,
        })));
        return;
      }

      // 3. Fetch driver + vehicle details
      const driverIds  = [...new Set(assignments.map((a: any) => a.driver_id).filter(Boolean))] as string[];
      const vehicleIds = [...new Set(assignments.map((a: any) => a.vehicle_id).filter(Boolean))] as string[];

      const [{ data: driversRaw }, { data: vehiclesRaw }] = await Promise.all([
        driverIds.length
          ? supabase.from("drivers").select("id,full_name,phone,team_id,team_role").in("id", driverIds)
          : Promise.resolve({ data: [] }),
        vehicleIds.length
          ? supabase.from("vehicles").select("id,plate_number,make,model").in("id", vehicleIds)
          : Promise.resolve({ data: [] }),
      ]);

      const drivers  = (driversRaw  as any[]) || [];
      const vehicles = (vehiclesRaw as any[]) || [];

      // 4. Fetch team info + leaders
      const teamIds = [...new Set(drivers.map((d: any) => d.team_id).filter(Boolean))] as string[];

      const [{ data: teamsRaw }, { data: leadersRaw }] = await Promise.all([
        teamIds.length
          ? supabase.from("driver_teams").select("id,name").in("id", teamIds)
          : Promise.resolve({ data: [] }),
        teamIds.length
          ? supabase.from("drivers")
              .select("id,full_name,phone,team_id")
              .eq("team_role", "leader")
              .in("team_id", teamIds)
          : Promise.resolve({ data: [] }),
      ]);

      const teams   = (teamsRaw   as any[]) || [];
      const leaders = (leadersRaw as any[]) || [];

      // 5. Build lookup maps
      const driverMap:  Record<string, any> = Object.fromEntries(drivers.map((d: any)  => [d.id, d]));
      const vehicleMap: Record<string, any> = Object.fromEntries(vehicles.map((v: any) => [v.id, v]));
      const teamMap:    Record<string, any> = Object.fromEntries(teams.map((t: any)    => [t.id, t]));
      const leaderMap:  Record<string, any> = Object.fromEntries(leaders.map((l: any)  => [l.team_id, l]));
      const assignMap:  Record<string, any> = Object.fromEntries(assignments.map((a: any) => [a.booking_id, a]));

      // 6. Merge everything
      setRows(bookings.map((b: any) => {
        const assign  = assignMap[b.id];
        if (!assign) {
          return {
            ...b,
            driver_name: null, driver_phone: null,
            driver_team: null, driver_team_role: null,
            team_leader_name: null, team_leader_phone: null,
            vehicle_plate: null, vehicle_make: null, vehicle_model: null,
          };
        }
        const driver  = driverMap[assign.driver_id]  ?? null;
        const vehicle = vehicleMap[assign.vehicle_id] ?? null;
        const team    = driver?.team_id ? teamMap[driver.team_id]   ?? null : null;
        const leader  = driver?.team_id ? leaderMap[driver.team_id] ?? null : null;

        return {
          ...b,
          driver_name:       driver?.full_name     ?? null,
          driver_phone:      driver?.phone         ?? null,
          driver_team:       team?.name            ?? null,
          driver_team_role:  driver?.team_role     ?? null,
          team_leader_name:  leader?.full_name     ?? null,
          team_leader_phone: leader?.phone         ?? null,
          vehicle_plate:     vehicle?.plate_number ?? null,
          vehicle_make:      vehicle?.make         ?? null,
          vehicle_model:     vehicle?.model        ?? null,
        };
      }));

    } catch (e: any) {
      console.error("MyBookings: unexpected error", e.message);
      setRows([]);
    } finally {
      setLoading(false); // ← always releases spinner
    }
  };

  // Wait for auth to fully resolve before loading
  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, user?.id]);

  const submitBooking = async (id: string) => {
    setSubmitting(m => ({ ...m, [id]: true }));
    try {
      await supabase.rpc("submit_booking", { p_booking_id: id });
      await load();
    } finally {
      setSubmitting(m => ({ ...m, [id]: false }));
    }
  };

  const isBookingExpired = (booking: Booking) => {
    if (booking.expired_at) return true;
    if (!booking.expires_at) return false;
    return new Date(booking.expires_at).getTime() <= Date.now();
  };

  const canAmend = (booking: Booking) => {
    if (["dispatched", "in_progress", "completed", "closed"].includes(booking.status)) return false;
    if (isBookingExpired(booking)) return false;
    return ["draft", "rejected", "finance_pending", "submitted", "approved"].includes(booking.status);
  };

  const amendBooking = async (booking: Booking) => {
    setAmending((current) => ({ ...current, [booking.id]: true }));

    try {
      if (!["draft", "rejected"].includes(booking.status)) {
        const { error } = await supabase.rpc("request_booking_amendment", {
          p_booking_id: booking.id,
        });

        if (error) throw error;
      }

      sessionStorage.setItem(EDIT_BOOKING_STORAGE_KEY, booking.id);
      window.dispatchEvent(
        new CustomEvent("tms:navigate", { detail: { label: "New Booking" } })
      );
    } catch (amendError: any) {
      alert(amendError.message ?? "Failed to reopen booking for amendment.");
      await load();
    } finally {
      setAmending((current) => ({ ...current, [booking.id]: false }));
    }
  };

  const visible = tab === "active"
    ? rows.filter(r => ACTIVE_STATUSES.includes(r.status))
    : rows;

  const tabs: { value: Tab; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "all",    label: "All"    },
  ];

  if (authLoading || loading) return <PageSpinner variant="dashboard" />;

  if (selectedBookingId) {
    return (
      <BookingDetailView
        bookingId={selectedBookingId}
        onBack={() => setSelectedBookingId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <TabBar
        tabs={tabs}
        active={tab}
        onChange={setTab}
        counts={{
          active: rows.filter(r => ACTIVE_STATUSES.includes(r.status)).length,
          all:    rows.length,
        }}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={tab === "active" ? "No active bookings" : "No bookings yet"}
          subtitle="Your requests will appear here"
        />
      ) : (
        <div className="space-y-3">
          {visible.map(b => (
            <Card key={b.id}>
              <div className="p-4 space-y-3">

                {/* Purpose + status */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[color:var(--text)] flex-1">{b.purpose}</h3>
                  <Badge status={b.status} />
                </div>

                {/* Date + route */}
                <div className="space-y-1">
                  <p className="text-xs text-[color:var(--text-muted)]">
                    <span className="font-medium">{fmtDate(b.trip_date)}</span> at {b.trip_time}
                  </p>
                  <p className="text-xs text-[color:var(--text-muted)] truncate">
                    {b.pickup_location} → {b.dropoff_location}
                  </p>
                </div>

                {/* Driver info — only shown after dispatch */}
                {b.status === "dispatched" && b.driver_name && (
                  <div
                    className="rounded-xl p-3 space-y-2"
                    style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)" }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                      Your Driver
                    </p>

                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: "var(--accent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                      }}>
                        {b.driver_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{b.driver_name}</p>
                        {b.driver_phone && (
                          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>📞 {b.driver_phone}</p>
                        )}
                      </div>
                    </div>

                    {b.driver_team && (
                      <div className="rounded-lg px-3 py-2 space-y-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>👥 Team</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{b.driver_team}</span>
                        </div>
                        {b.team_leader_name && (
                          <div className="flex items-center justify-between gap-2">
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>⭐ Group Leader</span>
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{b.team_leader_name}</span>
                              {b.team_leader_phone && (
                                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>📞 {b.team_leader_phone}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {b.vehicle_plate && (
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>🚗 Vehicle</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", fontFamily: "monospace" }}>{b.vehicle_plate}</span>
                        {(b.vehicle_make || b.vehicle_model) && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            · {[b.vehicle_make, b.vehicle_model].filter(Boolean).join(" ")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[color:var(--text-dim)]">{fmtDateTime(b.created_at)}</span>
                  <div className="flex items-center gap-2">
                    <Btn variant="ghost" size="sm" onClick={() => setSelectedBookingId(b.id)}>
                      History
                    </Btn>
                    {canAmend(b) && (
                      <Btn variant="ghost" size="sm" loading={amending[b.id]} onClick={() => amendBooking(b)}>
                        Amend
                      </Btn>
                    )}
                    {(b.status === "draft" || b.status === "rejected") && (
                      <Btn variant="primary" size="sm" loading={submitting[b.id]} onClick={() => submitBooking(b.id)}>
                        {b.status === "rejected" ? "Resubmit" : "Submit"}
                      </Btn>
                    )}
                  </div>
                </div>

              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
