// src/modules/fuel/pages/FuelReviewQueue.tsx
// Corporate Approver: review submitted fuel requests → approve or reject
// Flow: submitted (here) → approved → FuelRecordQueue (Transport records it)
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { approveFuelRequest } from "../services/fuel.service";
import {
  PageSpinner, EmptyState, Badge, Card, CountPill,
  Field, Input, Btn,
} from "@/components/TmsUI";
import { fmtDate, fmtMoney } from "@/lib/utils";

export default function FuelReviewQueue() {
  const [rows,    setRows]    = useState<any[]>([]);
  const [notes,   setNotes]   = useState<Record<string, string>>({});
  const [acting,  setActing]  = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fuel_requests")
      .select("*")
      .eq("status", "submitted")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    // Realtime — update queue when new requests come in
    const ch = supabase
      .channel("fuel_review_queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "fuel_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const act = async (id: string, approve: boolean) => {
    setActing(m => ({ ...m, [id]: true }));
    try {
      await approveFuelRequest(id, "approved", notes[id]);
      await load();
    } finally {
      setActing(m => ({ ...m, [id]: false }));
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {/* Mobile page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fuel Approvals</h1>
          <p className="page-sub">Review and approve fuel requests from staff and drivers</p>
        </div>
      </div>

      {/* Flow indicator */}
      <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)] bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-xl px-4 py-2.5 w-fit flex-wrap">
        <span className="badge badge-draft">Draft</span>
        <span>→</span>
        <span className="badge badge-submitted font-bold ring-2 ring-[color:var(--amber)]">Submitted ← you are here</span>
        <span>→</span>
        <span className="badge badge-approved">Approved</span>
        <span>→</span>
        <span className="badge badge-recorded">Recorded (Transport)</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No pending fuel approvals"
          subtitle="When staff or drivers submit a fuel request it will appear here for your review. Make sure they click 'Submit Request' — draft requests don't appear in this queue."
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <CountPill n={rows.length} color="amber" />
            <span className="text-sm text-[color:var(--text-muted)]">
              pending approval{rows.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3">
            {rows.map(r => (
              <Card key={r.id}>
                {/* Card header */}
                <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--amber)]/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[color:var(--text)]">{r.purpose || "Fuel Request"}</p>
                      <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{fmtDate(r.created_at)}</p>
                    </div>
                    <Badge status={r.status} />
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 divide-x divide-[color:var(--border)] border-b border-[color:var(--border)]">
                  {[
                    ["Type",   r.fuel_type  ?? "—"],
                    ["Litres", r.liters     ?? "—"],
                    ["Est.",   r.estimated_cost ? fmtMoney(r.estimated_cost) : "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 text-center">
                      <p className="text-[10px] font-medium text-[color:var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-sm font-semibold text-[color:var(--text)] capitalize">{value}</p>
                    </div>
                  ))}
                </div>

                {r.notes && (
                  <div className="px-4 py-2 border-b border-[color:var(--border)]">
                    <p className="text-xs text-[color:var(--text-muted)]">{r.notes}</p>
                  </div>
                )}

                {/* Review actions */}
                <div className="p-4 space-y-3">
                  <Field label="Review Note (optional)">
                    <Input
                      placeholder="Add a comment or reason…"
                      value={notes[r.id] ?? ""}
                      onChange={e => setNotes(m => ({ ...m, [r.id]: e.target.value }))}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Btn
                      variant="success"
                      size="sm"
                      loading={acting[r.id]}
                      onClick={() => act(r.id, true)}
                    >
                      ✓ Approve
                    </Btn>
                    <Btn
                      variant="danger"
                      size="sm"
                      loading={acting[r.id]}
                      onClick={() => act(r.id, false)}
                    >
                      ✗ Reject
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