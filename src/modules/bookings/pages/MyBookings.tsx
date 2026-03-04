// src/modules/bookings/pages/MyBookings.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageSpinner, EmptyState, Badge, Card, Btn, TabBar } from "@/components/TmsUI";
import { fmtDate, fmtDateTime } from "@/lib/utils";

type Booking = {
  id: string; purpose: string; trip_date: string; trip_time: string;
  pickup_location: string; dropoff_location: string;
  status: string; created_at: string;
};

type Tab = "active" | "all";

export default function MyBookings() {
  const { user }   = useAuth();
  const [rows,     setRows]    = useState<Booking[]>([]);
  const [loading,  setLoading] = useState(true);
  const [tab,      setTab]     = useState<Tab>("active");
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status,created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as Booking[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const submitBooking = async (id: string) => {
    setSubmitting(m => ({ ...m, [id]: true }));
    try {
      await supabase.rpc("submit_booking", { p_booking_id: id });
      await load();
    } finally { setSubmitting(m => ({ ...m, [id]: false })); }
  };

  const ACTIVE_STATUSES = ["draft", "submitted", "approved", "dispatched"];
  const visible = tab === "active"
    ? rows.filter(r => ACTIVE_STATUSES.includes(r.status))
    : rows;

  const tabs: { value: Tab; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "all",    label: "All"    },
  ];

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <TabBar
        tabs={tabs}
        active={tab}
        onChange={setTab}
        counts={{ active: rows.filter(r => ACTIVE_STATUSES.includes(r.status)).length, all: rows.length }}
      />

      {visible.length === 0 ? (
        <EmptyState title={tab === "active" ? "No active bookings" : "No bookings yet"} subtitle="Your requests will appear here" />
      ) : (
        <div className="space-y-3">
          {visible.map(b => (
            <Card key={b.id}>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[color:var(--text)] flex-1">{b.purpose}</h3>
                  <Badge status={b.status} />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-[color:var(--text-muted)]">
                    <span className="font-medium">{fmtDate(b.trip_date)}</span> at {b.trip_time}
                  </p>
                  <p className="text-xs text-[color:var(--text-muted)] truncate">
                    {b.pickup_location} → {b.dropoff_location}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[color:var(--text-dim)]">{fmtDateTime(b.created_at)}</span>
                  {b.status === "draft" && (
                    <Btn variant="primary" size="sm" loading={submitting[b.id]} onClick={() => submitBooking(b.id)}>
                      Submit
                    </Btn>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}