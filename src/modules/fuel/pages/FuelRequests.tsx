// src/modules/fuel/pages/FuelRequests.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card } from "@/components/TmsUI";
import { fmtDate, fmtMoney } from "@/lib/utils";

export default function FuelRequests() {
  const [rows, setRows]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) { setLoading(false); return; }
      const { data } = await supabase
        .from("fuel_requests").select("*")
        .eq("created_by", u.user.id)
        .order("created_at", { ascending: false }).limit(100);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-[color:var(--text-muted)]">{rows.length} request{rows.length !== 1 ? "s" : ""}</p>
      {rows.length === 0 ? (
        <EmptyState title="No fuel requests" subtitle="Your submitted requests will appear here" />
      ) : (
        rows.map(r => (
          <Card key={r.id}>
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[color:var(--text)] flex-1">{r.purpose || "Fuel Request"}</p>
                <Badge status={r.status} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[["Type", r.fuel_type ?? "—"], ["Litres", r.liters ?? "—"], ["Est.", fmtMoney(r.estimated_cost)]].map(([l, v]) => (
                  <div key={l} className="bg-[color:var(--surface-2)] rounded-lg px-2 py-1.5">
                    <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wide">{l}</p>
                    <p className="text-sm font-semibold text-[color:var(--text)]">{v}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[color:var(--text-dim)]">{fmtDate(r.created_at)}</p>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}