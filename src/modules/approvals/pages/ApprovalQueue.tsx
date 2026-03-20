// src/modules/approvals/pages/ApprovalQueue.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, CountPill, Field, Input, Btn } from "@/components/TmsUI";
import { fmtDate, fmtDateTime } from "@/lib/utils";

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

export default function ApprovalQueue() {
  const [items,   setItems]   = useState<Booking[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [acting,  setActing]  = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("bookings")
      .select("id,purpose,trip_date,trip_time,pickup_location,dropoff_location,pickup_digital_address,dropoff_digital_address,booking_type,num_passengers,trip_notes,status,created_by,created_at")
      .eq("status", "submitted")
      .order("created_at", { ascending: false });

    const bookings = (data as any[]) || [];

    if (bookings.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    let profileMap: Record<string, { name: string; position: string | null; division: string | null; unit: string | null }> = {};
    try {
      const creatorIds = [...new Set(bookings.map((b: any) => b.created_by).filter(Boolean))];
      const { data: profilesRaw } = await supabase
        .from("profiles")
        .select("user_id,full_name,position_title,division_id,unit_id")
        .in("user_id", creatorIds);
      const profiles = (profilesRaw as any[]) || [];

      const divIds  = [...new Set(profiles.map((p: any) => p.division_id).filter(Boolean))];
      const unitIds = [...new Set(profiles.map((p: any) => p.unit_id).filter(Boolean))];
      const [{ data: divsRaw }, { data: unitsRaw }] = await Promise.all([
        divIds.length  ? supabase.from("divisions").select("id,name").in("id", divIds)  : Promise.resolve({ data: [] }),
        unitIds.length ? supabase.from("units").select("id,name").in("id", unitIds)      : Promise.resolve({ data: [] }),
      ]);
      const divMap  = Object.fromEntries(((divsRaw  as any[]) || []).map((d: any) => [d.id, d.name]));
      const unitMap = Object.fromEntries(((unitsRaw as any[]) || []).map((u: any) => [u.id, u.name]));
      profiles.forEach((p: any) => {
        profileMap[p.user_id] = {
          name:     p.full_name      ?? "—",
          position: p.position_title ?? null,
          division: p.division_id ? (divMap[p.division_id] ?? null) : null,
          unit:     p.unit_id     ? (unitMap[p.unit_id]    ?? null) : null,
        };
      });
    } catch (_) {}

    setItems(bookings.map((b: any) => {
      const prof = profileMap[b.created_by] ?? { name: "—", position: null, division: null, unit: null };
      return { ...b, requester_name: prof.name, requester_position: prof.position, requester_division: prof.division, requester_unit: prof.unit };
    }));

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

                {/* ── Card header ── */}
                <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--accent-dim)]/20">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-[color:var(--text)]">{b.purpose}</h3>
                    <Badge status="submitted" label="Pending" />
                  </div>
                </div>

                {/* ── Requester info ── */}
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

                  {/* Avatar + text side by side, text block has min-w-0 to prevent overflow */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {/* Avatar — fixed size, never shrinks */}
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
                      {b.requester_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>

                    {/* Text block — takes remaining space, clips overflow */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
                        {b.requester_name}
                      </p>
                      {b.requester_position && (
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.3 }}>
                          {b.requester_position}
                        </p>
                      )}
                      {(b.requester_division || b.requester_unit) && (
                        <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "2px 0 0", lineHeight: 1.3 }}>
                          {[b.requester_division, b.requester_unit].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>
                    Submitted {fmtDateTime(b.created_at)}
                  </p>
                </div>

                {/* ── Trip details ── */}
                <div className="px-4 py-3 space-y-2 border-b border-[color:var(--border)]">
                  <Row icon="cal">{fmtDate(b.trip_date)} at {b.trip_time}</Row>
                  <Row icon="pin">{b.pickup_location} → {b.dropoff_location}</Row>
                  {b.pickup_digital_address && (
                    <p style={{ fontSize: 11, color: "var(--text-dim)", paddingLeft: 20 }}>{b.pickup_digital_address}</p>
                  )}
                  {b.trip_notes && (
                    <div
                      className="rounded-lg px-3 py-2 text-xs mt-1"
                      style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>Notes: </span>{b.trip_notes}
                    </div>
                  )}
                </div>

                {/* ── Actions ── */}
                <div className="p-4 space-y-3">
                  <Field label="Comment (optional)">
                    <Input
                      placeholder="Add a comment…"
                      value={comment[b.id] || ""}
                      onChange={e => setComment(m => ({ ...m, [b.id]: e.target.value }))}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Btn variant="danger"  onClick={() => act(b.id, "rejected")} loading={acting[b.id]}>Reject</Btn>
                    <Btn variant="success" onClick={() => act(b.id, "approved")} loading={acting[b.id]}>Approve</Btn>
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