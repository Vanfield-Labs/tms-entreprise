// src/modules/fuel/pages/FuelRecordQueue.tsx — transport records actual fuel dispensed
import { useEffect, useState } from "react";
import { transportRecordFuel } from "../services/fuel.service";
import { supabase } from "@/lib/supabase";

export default function FuelRecordQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualCost, setActualCost] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("fuel_requests")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function record(id: string) {
    setRecording((m) => ({ ...m, [id]: true }));
    try {
      const cost = actualCost[id] ? Number(actualCost[id]) : undefined;
      await transportRecordFuel(id, cost, notes[id]);
      await load();
    } finally {
      setRecording((m) => ({ ...m, [id]: false }));
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="inline-flex w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold items-center justify-center">{rows.length}</span>
            <span className="text-sm text-gray-600">approved fuel request{rows.length !== 1 ? "s" : ""} to record</span>
          </div>

          {rows.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50/50 border-b border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{r.purpose || "Fuel Request"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Approved</span>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                {[
                  { label: "Type", value: r.fuel_type || "—" },
                  { label: "Liters", value: r.liters ?? "—" },
                  { label: "Est. Cost", value: r.estimated_cost ? `GHS ${r.estimated_cost}` : "—" },
                ].map((s) => (
                  <div key={s.label} className="px-3 py-2.5 text-center">
                    <div className="text-xs text-gray-400">{s.label}</div>
                    <div className="text-sm font-semibold text-gray-900 mt-0.5 capitalize">{String(s.value)}</div>
                  </div>
                ))}
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Actual Cost (GHS)</label>
                    <input
                      type="number" step="0.01" min="0"
                      placeholder={r.estimated_cost ? String(r.estimated_cost) : "0.00"}
                      value={actualCost[r.id] || ""}
                      onChange={(e) => setActualCost((m) => ({ ...m, [r.id]: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Notes</label>
                    <input
                      placeholder="e.g. Fuelled at Total station"
                      value={notes[r.id] || ""}
                      onChange={(e) => setNotes((m) => ({ ...m, [r.id]: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
                <button
                  onClick={() => record(r.id)}
                  disabled={recording[r.id]}
                  className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40"
                >
                  {recording[r.id] ? "Recording…" : "Record Fuel Dispensed ✓"}
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10";

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>;
}

function EmptyState() {
  return (
    <div className="text-center py-16 text-gray-400">
      <div className="text-4xl mb-3">⛽</div>
      <p className="text-sm">No approved fuel requests to record</p>
    </div>
  );
}