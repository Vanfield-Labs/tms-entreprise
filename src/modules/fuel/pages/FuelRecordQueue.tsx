// src/modules/fuel/pages/FuelRecordQueue.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { transportRecordFuel } from "../services/fuel.service";
import { PageSpinner, EmptyState, Badge, Card, CountPill, Field, Input, Btn } from "@/components/TmsUI";
import { fmtDate, fmtMoney } from "@/lib/utils";

export default function FuelRecordQueue() {
  const [rows,    setRows]    = useState<any[]>([]);
  const [actCost, setActCost] = useState<Record<string, string>>({});
  const [notes,   setNotes]   = useState<Record<string, string>>({});
  const [acting,  setActing]  = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("fuel_requests").select("*").eq("status","approved").order("created_at", { ascending: false }).limit(200);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const record = async (id: string) => {
    setActing(m => ({ ...m, [id]: true }));
    try {
      await transportRecordFuel(id, actCost[id] ? parseFloat(actCost[id]) : undefined, notes[id]);
      await load();
    } finally { setActing(m => ({ ...m, [id]: false })); }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <EmptyState title="No approved requests" subtitle="Approved fuel requests awaiting recording appear here" />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <CountPill n={rows.length} color="green" />
            <span className="text-sm text-[color:var(--text-muted)]">ready to record</span>
          </div>
          <div className="space-y-3">
            {rows.map(r => (
              <Card key={r.id}>
                <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--green)]/10">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Actual Cost (GHS)">
                      <Input type="number" min="0" step="0.01" placeholder={r.estimated_cost ?? "0.00"} value={actCost[r.id] || ""} onChange={e => setActCost(m => ({ ...m, [r.id]: e.target.value }))} />
                    </Field>
                    <Field label="Notes">
                      <Input placeholder="Pump #, attendant…" value={notes[r.id] || ""} onChange={e => setNotes(m => ({ ...m, [r.id]: e.target.value }))} />
                    </Field>
                  </div>
                  <Btn variant="primary" className="w-full" onClick={() => record(r.id)} loading={acting[r.id]}>
                    Record Fuel Dispensed
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