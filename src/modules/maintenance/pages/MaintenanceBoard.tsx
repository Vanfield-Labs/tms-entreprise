// src/modules/maintenance/pages/MaintenanceBoard.tsx — mobile-first
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Req = { id: string; vehicle_id: string; issue_description: string; status: string; created_at: string };

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  reported: { label: "Reported", color: "bg-blue-50 text-blue-700" },
  approved: { label: "Approved", color: "bg-violet-50 text-violet-700" },
  in_progress: { label: "In Progress", color: "bg-amber-50 text-amber-700" },
  completed: { label: "Completed", color: "bg-green-50 text-green-700" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-500" },
};

export default function MaintenanceBoard() {
  const [items, setItems] = useState<Req[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("maintenance_requests")
      .select("id,vehicle_id,issue_description,status,created_at")
      .order("created_at", { ascending: false });
    setItems((data as Req[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    setActing((m) => ({ ...m, [id]: true }));
    try {
      await supabase.rpc("update_maintenance_status", { p_request_id: id, p_new_status: status });
      await load();
    } finally {
      setActing((m) => ({ ...m, [id]: false }));
    }
  };

  const confirm = async (id: string) => {
    setActing((m) => ({ ...m, [id]: true }));
    try {
      await supabase.rpc("confirm_maintenance_completion", { p_request_id: id, p_notes: notes[id] || null });
      await load();
    } finally {
      setActing((m) => ({ ...m, [id]: false }));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {items.map((r) => {
            const sc = STATUS_CONFIG[r.status] || { label: r.status, color: "bg-gray-100 text-gray-600" };
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Vehicle ID: {r.vehicle_id.slice(0, 8)}…</p>
                    <p className="font-medium text-sm text-gray-900">{r.issue_description}</p>
                  </div>
                  <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                </div>

                <div className="px-4 py-2 border-b border-gray-50">
                  <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>

                <div className="p-4 space-y-3">
                  {r.status === "reported" && (
                    <div className="grid grid-cols-2 gap-2">
                      <ActionBtn onClick={() => setStatus(r.id, "approved")} loading={acting[r.id]} variant="secondary">Approve</ActionBtn>
                      <ActionBtn onClick={() => setStatus(r.id, "in_progress")} loading={acting[r.id]} variant="primary">Start Work</ActionBtn>
                    </div>
                  )}
                  {r.status === "approved" && (
                    <ActionBtn onClick={() => setStatus(r.id, "in_progress")} loading={acting[r.id]} variant="primary" full>Start Work →</ActionBtn>
                  )}
                  {r.status === "in_progress" && (
                    <ActionBtn onClick={() => setStatus(r.id, "completed")} loading={acting[r.id]} variant="primary" full>Mark as Completed</ActionBtn>
                  )}
                  {r.status === "completed" && (
                    <div className="space-y-2">
                      <input
                        placeholder="Completion notes (optional)"
                        value={notes[r.id] || ""}
                        onChange={(e) => setNotes((m) => ({ ...m, [r.id]: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                      <ActionBtn onClick={() => confirm(r.id)} loading={acting[r.id]} variant="primary" full>Confirm & Close</ActionBtn>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, loading, variant, children, full }: {
  onClick: () => void; loading?: boolean; variant: "primary" | "secondary"; children: React.ReactNode; full?: boolean;
}) {
  const base = `${full ? "w-full" : ""} py-2.5 px-4 text-sm font-medium rounded-xl transition-colors disabled:opacity-40`;
  const styles = variant === "primary"
    ? "bg-black text-white hover:bg-gray-800"
    : "border border-gray-200 text-gray-700 hover:bg-gray-50";
  return (
    <button onClick={onClick} disabled={loading} className={`${base} ${styles}`}>
      {loading ? "…" : children}
    </button>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>;
}

function EmptyState() {
  return (
    <div className="text-center py-16 text-gray-400">
      <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
      <p className="text-sm">No maintenance requests</p>
    </div>
  );
}
