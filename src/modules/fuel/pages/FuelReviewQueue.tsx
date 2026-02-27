// src/modules/fuel/pages/FuelReviewQueue.tsx — mobile-first
import { useEffect, useState } from "react";
import { corporateApproveFuel } from "../services/fuel.service";
import { supabase } from "@/lib/supabase";

export default function FuelReviewQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase.from("fuel_requests").select("*").in("status", ["submitted"]).order("created_at", { ascending: false }).limit(200);
      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(id: string, approve: boolean) {
    setActing((m) => ({ ...m, [id]: true }));
    try {
      await corporateApproveFuel(id, approve, noteMap[id]);
      await load();
    } finally {
      setActing((m) => ({ ...m, [id]: false }));
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <EmptyState message="No fuel requests pending review" />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">{rows.length}</span>
            <span className="text-sm text-gray-600">pending fuel approval{rows.length !== 1 ? "s" : ""}</span>
          </div>

          {rows.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-orange-50/40">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{r.purpose || "Fuel Request"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium capitalize">{r.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                <Stat label="Type" value={r.fuel_type || "—"} />
                <Stat label="Liters" value={r.liters ?? "—"} />
                <Stat label="Est. Cost" value={r.estimated_cost ? `GHS ${r.estimated_cost}` : "—"} />
              </div>

              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Notes (optional)</label>
                  <input
                    placeholder="Add a note…"
                    value={noteMap[r.id] || ""}
                    onChange={(e) => setNoteMap((m) => ({ ...m, [r.id]: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => act(r.id, false)} disabled={acting[r.id]} className="py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-40">Reject</button>
                  <button onClick={() => act(r.id, true)} disabled={acting[r.id]} className="py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40">{acting[r.id] ? "…" : "Approve"}</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-gray-900 mt-0.5 capitalize">{String(value)}</div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <div className="text-4xl mb-3">⛽</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
