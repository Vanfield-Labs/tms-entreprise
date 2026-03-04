// src/modules/maintenance/pages/MaintenanceBoard.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Badge, Card, TabBar, Field, Textarea, Btn } from "@/components/TmsUI";
import { fmtDateTime } from "@/lib/utils";

type Req = {
  id: string; vehicle_id: string; issue_description: string;
  status: string; created_at: string; notes?: string;
};

type StatusKey = "all" | "reported" | "approved" | "in_progress" | "completed" | "closed";

const TABS: { value: StatusKey; label: string }[] = [
  { value: "all",         label: "All"         },
  { value: "reported",    label: "Reported"    },
  { value: "approved",    label: "Approved"    },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed"   },
  { value: "closed",      label: "Closed"      },
];

const NEXT_STATUS: Record<string, string | null> = {
  reported:    "approved",
  approved:    "in_progress",
  in_progress: "completed",
  completed:   "closed",
  closed:      null,
};

const NEXT_LABEL: Record<string, string> = {
  reported:    "Approve",
  approved:    "Start Work",
  in_progress: "Mark Complete",
  completed:   "Close",
};

export default function MaintenanceBoard() {
  const [items,   setItems]   = useState<Req[]>([]);
  const [notes,   setNotes]   = useState<Record<string, string>>({});
  const [acting,  setActing]  = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<StatusKey>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("maintenance_requests")
      .select("id,vehicle_id,issue_description,status,created_at,notes")
      .order("created_at", { ascending: false });
    setItems((data as Req[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const advance = async (req: Req) => {
    const next = NEXT_STATUS[req.status];
    if (!next) return;
    setActing(m => ({ ...m, [req.id]: true }));
    try {
      if (req.status === "in_progress") {
        await supabase.rpc("confirm_maintenance_completion", { p_request_id: req.id, p_notes: notes[req.id] || null });
      } else {
        await supabase.rpc("update_maintenance_status", { p_request_id: req.id, p_new_status: next });
      }
      await load();
    } finally { setActing(m => ({ ...m, [req.id]: false })); }
  };

  const reject = async (id: string) => {
    setActing(m => ({ ...m, [id]: true }));
    try {
      await supabase.rpc("update_maintenance_status", { p_request_id: id, p_new_status: "closed" });
      await load();
    } finally { setActing(m => ({ ...m, [id]: false })); }
  };

  const visible = tab === "all" ? items : items.filter(i => i.status === tab);
  const counts = Object.fromEntries(
    TABS.map(t => [t.value, t.value === "all" ? items.length : items.filter(i => i.status === t.value).length])
  ) as Record<StatusKey, number>;

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <TabBar tabs={TABS} active={tab} onChange={setTab} counts={counts} />

      {visible.length === 0 ? (
        <EmptyState title="No maintenance requests" subtitle={tab !== "all" ? `No items in "${tab}" status` : undefined} />
      ) : (
        <div className="space-y-3">
          {visible.map(req => {
            const next = NEXT_STATUS[req.status];
            return (
              <Card key={req.id}>
                <div className="px-4 py-3 border-b border-[color:var(--border)]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[color:var(--text)] flex-1">{req.issue_description}</p>
                    <Badge status={req.status} />
                  </div>
                  <p className="text-xs text-[color:var(--text-muted)] mt-1">
                    Vehicle: <span className="font-medium">{req.vehicle_id}</span>
                    <span className="mx-1.5">·</span>
                    {fmtDateTime(req.created_at)}
                  </p>
                </div>

                {next && (
                  <div className="p-4 space-y-3">
                    {req.status === "in_progress" && (
                      <Field label="Completion Notes">
                        <Textarea
                          rows={2}
                          placeholder="Describe work done…"
                          value={notes[req.id] || ""}
                          onChange={e => setNotes(m => ({ ...m, [req.id]: e.target.value }))}
                        />
                      </Field>
                    )}
                    <div className="flex gap-2">
                      {req.status === "reported" && (
                        <Btn variant="danger" size="sm" onClick={() => reject(req.id)} loading={acting[req.id]}>
                          Reject
                        </Btn>
                      )}
                      <Btn variant="primary" size="sm" className="flex-1" onClick={() => advance(req)} loading={acting[req.id]}>
                        {NEXT_LABEL[req.status]}
                      </Btn>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}