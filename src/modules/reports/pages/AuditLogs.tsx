// src/modules/reports/pages/AuditLogs.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, Card, SearchInput } from "@/components/TmsUI";
import { fmtDateTime } from "@/lib/utils";

type Log = {
  id: string; action: string; entity_type: string; entity_id: string;
  performed_by: string; created_at: string; metadata: any;
  actor_name?: string;
};

const ACTION_COLORS: Record<string, string> = {
  create:   "var(--green)",
  submit:   "var(--accent)",
  approve:  "var(--green)",
  reject:   "var(--red)",
  dispatch: "var(--accent)",
  close:    "var(--text-muted)",
  record:   "var(--cyan)",
  update:   "var(--amber)",
  delete:   "var(--red)",
  override: "var(--amber)",
};

const ACTION_ICONS: Record<string, string> = {
  create: "✚", submit: "↑", approve: "✓", reject: "✗",
  dispatch: "→", close: "■", record: "⛽", update: "↻",
  delete: "✕", override: "⚑",
};

function ActionPill({ action }: { action: string }) {
  const key  = action.split("_")[0].toLowerCase();
  const color = ACTION_COLORS[key] ?? "var(--text-muted)";
  const icon  = ACTION_ICONS[key]  ?? "·";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      <span className="text-[10px]">{icon}</span>
      {action}
    </span>
  );
}

export default function AuditLogs() {
  const [logs,     setLogs]     = useState<Log[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [q,        setQ]        = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id,action,entity_type,entity_id,performed_by,created_at,metadata,profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(500);
      setLogs(((data as any[]) || []).map(r => ({
        ...r,
        actor_name: r.profiles?.full_name ?? r.performed_by,
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = logs.filter(r => {
    if (!q) return true;
    return [r.action, r.entity_type, r.actor_name, r.entity_id]
      .filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase());
  });

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {/* Mobile page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-sub">System activity trail — all workflow events</p>
        </div>
        {logs.length > 0 && (
          <span className="text-xs text-[color:var(--text-muted)] font-mono self-end pb-1">
            {filtered.length} entries
          </span>
        )}
      </div>

      {/* Info banner explaining what gets recorded */}
      <div
        className="rounded-xl border p-4 text-sm space-y-2"
        style={{
          background: "var(--accent-dim)",
          borderColor: "var(--accent)",
          color: "var(--accent-bright)",
        }}
      >
        <p className="font-semibold text-[color:var(--text)]">What gets recorded here?</p>
        <p className="text-[color:var(--text-muted)] text-xs leading-relaxed">
          Every time a workflow RPC function runs — booking submission, approvals, fuel requests,
          dispatch assignments, maintenance status changes, user creation, trip closures — it writes
          a row to the <span className="font-mono">audit_logs</span> table with the action, entity,
          actor, and a JSON metadata snapshot.
        </p>
        <p className="text-[color:var(--text-muted)] text-xs leading-relaxed">
          If this page shows no logs, it means either no workflows have run yet, or your Supabase
          RPC functions are not inserting to <span className="font-mono">audit_logs</span>.
          Check each RPC (e.g. <span className="font-mono">submit_booking</span>,{" "}
          <span className="font-mono">corporate_review_fuel_request</span>) and add:
        </p>
        <pre
          className="text-[11px] font-mono rounded-lg p-3 overflow-x-auto"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
{`INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, metadata)
VALUES (p_action, 'booking', p_booking_id, auth.uid(), jsonb_build_object(...));`}
        </pre>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          title="No audit entries yet"
          subtitle="Workflow actions (approvals, dispatches, fuel requests, etc.) will appear here as they happen."
        />
      ) : (
        <>
          <SearchInput value={q} onChange={setQ} placeholder="Filter by action, entity or user…" />

          {filtered.length === 0 ? (
            <EmptyState title="No logs match your search" subtitle="Try a different term" />
          ) : (
            <>
              {/* Mobile */}
              <div className="sm:hidden space-y-2">
                {filtered.map(r => (
                  <Card key={r.id}>
                    <button
                      className="w-full p-4 text-left"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <ActionPill action={r.action} />
                          <p className="text-xs text-[color:var(--text-muted)] truncate">
                            {r.entity_type} · {r.actor_name}
                          </p>
                          <p className="text-xs text-[color:var(--text-dim)]">{fmtDateTime(r.created_at)}</p>
                        </div>
                        <svg
                          className={`w-4 h-4 text-[color:var(--text-muted)] shrink-0 mt-1 transition-transform ${expanded === r.id ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                      {expanded === r.id && r.metadata && (
                        <pre className="mt-3 text-[11px] font-mono text-[color:var(--text-muted)] bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-left">
                          {JSON.stringify(r.metadata, null, 2)}
                        </pre>
                      )}
                    </button>
                  </Card>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="tms-table">
                    <thead>
                      <tr>{["Action","Entity","Actor","Time","Meta"].map(h => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => (
                        <>
                          <tr
                            key={r.id}
                            className="cursor-pointer"
                            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                          >
                            <td><ActionPill action={r.action} /></td>
                            <td>
                              <span className="font-medium">{r.entity_type}</span>
                              <span className="text-[color:var(--text-dim)] font-mono text-xs ml-2 hidden xl:inline">
                                {r.entity_id?.slice(0, 8)}…
                              </span>
                            </td>
                            <td>{r.actor_name}</td>
                            <td className="whitespace-nowrap text-[color:var(--text-muted)]">{fmtDateTime(r.created_at)}</td>
                            <td>
                              <span className="text-xs text-[color:var(--accent)] hover:underline">
                                {expanded === r.id ? "Hide" : "View"}
                              </span>
                            </td>
                          </tr>
                          {expanded === r.id && (
                            <tr key={`${r.id}-exp`}>
                              <td colSpan={5} className="p-0 pb-3 px-4">
                                <pre className="text-[11px] font-mono text-[color:var(--text-muted)] bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(r.metadata, null, 2)}
                                </pre>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}