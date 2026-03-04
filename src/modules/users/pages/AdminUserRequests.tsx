// src/modules/users/pages/AdminUserRequests.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, CountPill, Field, Input, Btn, TabBar } from "@/components/TmsUI";
import { fmtDateTime } from "@/lib/utils";

type Req = {
  id: string; full_name: string; email: string; system_role: string;
  division_id: string | null; unit_id: string | null;
  status: string; created_at: string; position_title: string | null;
  division_name?: string; unit_name?: string;
};
type Tab = "pending" | "all";

export default function AdminUserRequests() {
  const [items,   setItems]   = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<Tab>("pending");
  const [authIds, setAuthIds] = useState<Record<string, string>>({});
  const [acting,  setActing]  = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: reqs }, { data: divs }, { data: units }] = await Promise.all([
      supabase.from("user_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("divisions").select("id,name"),
      supabase.from("units").select("id,name"),
    ]);
    const divMap  = Object.fromEntries(((divs  as any[]) || []).map(d => [d.id, d.name]));
    const unitMap = Object.fromEntries(((units as any[]) || []).map(u => [u.id, u.name]));
    setItems(((reqs as any[]) || []).map(r => ({
      ...r,
      division_name: r.division_id ? divMap[r.division_id] : "—",
      unit_name: r.unit_id ? unitMap[r.unit_id] : "—",
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async (req: Req) => {
    const authId = authIds[req.id]?.trim();
    if (!authId) { alert("Please enter the Auth UUID first."); return; }
    setActing(m => ({ ...m, [req.id]: true }));
    try {
      await supabase.rpc("admin_approve_user_request", { p_request_id: req.id, p_auth_uuid: authId });
      await load();
    } finally { setActing(m => ({ ...m, [req.id]: false })); }
  };

  const reject = async (id: string) => {
    setActing(m => ({ ...m, [id]: true }));
    try {
      await supabase.rpc("admin_reject_user_request", { p_request_id: id });
      await load();
    } finally { setActing(m => ({ ...m, [id]: false })); }
  };

  const visible = tab === "pending" ? items.filter(i => i.status === "pending") : items;
  const tabs: { value: Tab; label: string }[] = [{ value: "pending", label: "Pending" }, { value: "all", label: "All" }];

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <TabBar tabs={tabs} active={tab} onChange={setTab} counts={{ pending: items.filter(i => i.status === "pending").length, all: items.length }} />

      {visible.length === 0 ? (
        <EmptyState title="No user requests" subtitle={tab === "pending" ? "No pending approvals" : undefined} />
      ) : (
        <div className="space-y-3">
          {visible.map(req => (
            <Card key={req.id}>
              <div className="px-4 py-3 border-b border-[color:var(--border)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-[color:var(--text)]">{req.full_name}</p>
                    <p className="text-xs text-[color:var(--text-muted)]">{req.email}</p>
                  </div>
                  <Badge status={req.status} />
                </div>
              </div>

              <div className="px-4 py-3 space-y-1 border-b border-[color:var(--border)]">
                {[
                  ["Role",     req.system_role.replace(/_/g," ")],
                  ["Division", req.division_name ?? "—"],
                  ["Unit",     req.unit_name ?? "—"],
                  ["Position", req.position_title ?? "—"],
                  ["Submitted",fmtDateTime(req.created_at)],
                ].map(([l,v]) => (
                  <div key={l} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-[color:var(--text-muted)] shrink-0">{l}</span>
                    <span className="text-[color:var(--text)] capitalize">{v}</span>
                  </div>
                ))}
              </div>

              {req.status === "pending" && (
                <div className="p-4 space-y-3">
                  <Field label="Auth UUID (required to approve)">
                    <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={authIds[req.id] || ""} onChange={e => setAuthIds(m => ({ ...m, [req.id]: e.target.value }))} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Btn variant="danger"  onClick={() => reject(req.id)}  loading={acting[req.id]}>Reject</Btn>
                    <Btn variant="success" onClick={() => approve(req)}    loading={acting[req.id]}>Approve</Btn>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}