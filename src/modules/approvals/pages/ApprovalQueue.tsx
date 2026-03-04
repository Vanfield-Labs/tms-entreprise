// src/modules/approvals/pages/ApprovalQueue.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, CountPill, Field, Input, Btn } from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";

type Booking = {
  id: string; purpose: string; trip_date: string; trip_time: string;
  pickup_location: string; dropoff_location: string; status: string; created_by: string;
};

export default function ApprovalQueue() {
  const [items, setItems]   = useState<Booking[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [acting, setActing]   = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,status,created_by")
      .eq("status", "submitted")
      .order("created_at", { ascending: false });
    setItems((data as Booking[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "approved" | "rejected") => {
    setActing(m => ({ ...m, [id]: true }));
    try {
      await supabase.rpc("approve_booking", { p_booking_id: id, p_action: action, p_comment: comment[id] || null });
      await load();
    } finally { setActing(m => ({ ...m, [id]: false })); }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState
          title="All caught up"
          subtitle="No booking approvals pending"
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <CountPill n={items.length} />
            <span className="text-sm text-[color:var(--text-muted)]">
              pending approval{items.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3">
            {items.map(b => (
              <Card key={b.id}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--accent-dim)]/20">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-[color:var(--text)]">{b.purpose}</h3>
                    <Badge status="submitted" label="Pending" />
                  </div>
                </div>

                {/* Details */}
                <div className="px-4 py-3 space-y-2 border-b border-[color:var(--border)]">
                  <Row icon="cal">{fmtDate(b.trip_date)} at {b.trip_time}</Row>
                  <Row icon="pin">{b.pickup_location} → {b.dropoff_location}</Row>
                </div>

                {/* Actions */}
                <div className="p-4 space-y-3">
                  <Field label="Comment (optional)">
                    <Input
                      placeholder="Add a comment…"
                      value={comment[b.id] || ""}
                      onChange={e => setComment(m => ({ ...m, [b.id]: e.target.value }))}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Btn variant="danger" onClick={() => act(b.id, "rejected")} loading={acting[b.id]}>
                      Reject
                    </Btn>
                    <Btn variant="success" onClick={() => act(b.id, "approved")} loading={acting[b.id]}>
                      Approve
                    </Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ icon, children }: { icon: "cal" | "pin"; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
      {icon === "cal"
        ? <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        : <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
      }
      <span>{children}</span>
    </div>
  );
}