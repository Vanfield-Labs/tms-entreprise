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
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Audit Logs</h1>
        <span className="text-xs text-[color:var(--text-muted)]">{filtered.length} entries</span>
      </div>

      <SearchInput value={q} onChange={setQ} placeholder="Filter by action, entity or user…" />

      {filtered.length === 0 ? (
        <EmptyState title="No logs found" subtitle="Try adjusting your search" />
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
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[color:var(--text)] truncate">{r.action}</p>
                      <p className="text-xs text-[color:var(--text-muted)] truncate">{r.entity_type} · {r.actor_name}</p>
                      <p className="text-xs text-[color:var(--text-dim)]">{fmtDateTime(r.created_at)}</p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-[color:var(--text-muted)] shrink-0 transition-transform ${expanded === r.id ? "rotate-180" : ""}`}
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
                  <tr>{["Action","Entity","ID","Actor","Time","Metadata"].map(h=><th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <>
                      <tr key={r.id} className="cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                        <td className="font-medium">{r.action}</td>
                        <td>{r.entity_type}</td>
                        <td className="font-mono text-xs text-[color:var(--text-muted)] max-w-[120px] truncate">{r.entity_id}</td>
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
                          <td colSpan={6} className="p-0 pb-3 px-4">
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
    </div>
  );
}