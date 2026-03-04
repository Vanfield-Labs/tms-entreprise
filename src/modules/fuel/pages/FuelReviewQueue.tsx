// src/modules/fuel/pages/FuelReviewQueue.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { corporateApproveFuel } from "../services/fuel.service";
import { PageSpinner, EmptyState, Badge, Card, CountPill, Field, Input, Btn } from "@/components/TmsUI";
import { fmtDate, fmtMoney } from "@/lib/utils";

export default function FuelReviewQueue() {
  const [rows,    setRows]    = useState<any[]>([]);
  const [notes,   setNotes]   = useState<Record<string, string>>({});
  const [acting,  setActing]  = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("fuel_requests").select("*").eq("status","submitted").order("created_at", { ascending: false }).limit(200);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const act = async (id: string, approve: boolean) => {
    setActing(m => ({ ...m, [id]: true }));
    try {
      await corporateApproveFuel(id, approve, notes[id]);
      await load();
    } finally { setActing(m => ({ ...m, [id]: false })); }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <EmptyState title="All caught up" subtitle="No fuel requests awaiting review" />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <CountPill n={rows.length} color="amber" />
            <span className="text-sm text-[color:var(--text-muted)]">pending fuel approval{rows.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-3">
            {rows.map(r => (
              <Card key={r.id}>
                <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--amber)]/10">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[color:var(--text)]">{r.purpose || "Fuel Request"}</p>
                      <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{fmtDate(r.created_at)}</p>
                    </div>
                    <Badge status={r.status} />
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-[color:var(--border)] border-b border-[color:var(--border)]">
                  {[["Type", r.fuel_type ?? "—"], ["Litres", r.liters ?? "—"], ["Est. Cost", fmtMoney(r.estimated_cost)]].map(([l,v]) => (
                    <div key={l} className="px-3 py-2.5 text-center">
                      <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wide">{l}</p>
                      <p className="text-sm font-semibold text-[color:var(--text)] mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 space-y-3">
                  <Field label="Note (optional)">
                    <Input placeholder="Add a comment…" value={notes[r.id] || ""} onChange={e => setNotes(m => ({ ...m, [r.id]: e.target.value }))} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Btn variant="danger"  onClick={() => act(r.id, false)} loading={acting[r.id]}>Reject</Btn>
                    <Btn variant="success" onClick={() => act(r.id, true)}  loading={acting[r.id]}>Approve</Btn>
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