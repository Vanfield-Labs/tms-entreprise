// src/modules/users/pages/AdminUserRequests.tsx — mobile-first
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Req = { id: string; full_name: string; email: string; division_id: string; unit_id: string; requested_role: string; status: string; created_at: string };

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-rose-100 text-rose-700",
  corporate_approver: "bg-violet-100 text-violet-700",
  transport_supervisor: "bg-amber-100 text-amber-700",
  driver: "bg-emerald-100 text-emerald-700",
  unit_head: "bg-sky-100 text-sky-700",
  staff: "bg-gray-100 text-gray-600",
};

export default function AdminUserRequests() {
  const [rows, setRows] = useState<Req[]>([]);
  const [userId, setUserId] = useState<Record<string, string>>({});
  const [position, setPosition] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_requests")
      .select("id,full_name,email,division_id,unit_id,requested_role,status,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setRows((data as Req[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (r: Req) => {
    if (!userId[r.id]) return;
    setActing((m) => ({ ...m, [r.id]: true }));
    try {
      await supabase.rpc("admin_approve_user_request", {
        p_request_id: r.id, p_user_id: userId[r.id], p_full_name: r.full_name,
        p_division_id: r.division_id, p_unit_id: r.unit_id, p_system_role: r.requested_role,
        p_position_title: position[r.id] || null,
      });
      await load();
    } finally {
      setActing((m) => ({ ...m, [r.id]: false }));
    }
  };

  const reject = async (r: Req) => {
    setActing((m) => ({ ...m, [r.id]: true }));
    try {
      await supabase.rpc("admin_reject_user_request", { p_request_id: r.id, p_reason: "Rejected by admin" });
      await load();
    } finally {
      setActing((m) => ({ ...m, [r.id]: false }));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <p className="text-sm">No pending user requests</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black text-white text-xs font-bold">{rows.length}</span>
            <span className="text-sm text-gray-600">pending request{rows.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{r.full_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.email}</p>
                  </div>
                  <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[r.requested_role] || "bg-gray-100 text-gray-600"}`}>
                    {r.requested_role?.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-amber-700 font-medium">⚠️ Create this user in Supabase Auth first, then paste their UUID below</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Auth User UUID *</label>
                    <input
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={userId[r.id] || ""}
                      onChange={(e) => setUserId((m) => ({ ...m, [r.id]: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Position Title (optional)</label>
                    <input
                      placeholder="e.g. Senior Driver"
                      value={position[r.id] || ""}
                      onChange={(e) => setPosition((m) => ({ ...m, [r.id]: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => reject(r)}
                      disabled={acting[r.id]}
                      className="py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => approve(r)}
                      disabled={!userId[r.id] || acting[r.id]}
                      className="py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {acting[r.id] ? "…" : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>;
}
