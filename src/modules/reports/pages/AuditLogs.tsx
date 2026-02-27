import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/utils";

type Audit = {
  id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: any;
  created_at: string;
};

const ACTION_COLORS: Record<string, string> = {
  create: "var(--green)",
  submit: "var(--amber)",
  approve: "var(--green)",
  reject: "var(--red)",
  dispatch: "var(--accent-bright)",
  update: "var(--cyan)",
  delete: "var(--red)",
  close: "var(--text-muted)",
};

export default function AuditLogs() {
  const [rows, setRows] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id,actor_user_id,action,entity_type,entity_id,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      setRows((data as Audit[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [r.action, r.entity_type, r.actor_user_id, r.entity_id].join(" ").toLowerCase().includes(q);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-header">
        <h1 className="page-title">Audit Logs</h1>
        <p className="page-sub">Complete record of all system actions</p>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          className="tms-input"
          style={{ maxWidth: 300 }}
          placeholder="Search action, entity, user..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}>
          {filtered.length} entries
        </span>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-row">Loading audit logs...</div>
        ) : (
          <table className="tms-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <>
                  <tr key={r.id}>
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 11,
                        fontWeight: 600,
                        color: ACTION_COLORS[r.action.split("_")[0]] || "var(--text)",
                      }}>
                        {r.action}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: "var(--text-muted)" }}>{r.entity_type}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "var(--text-dim)", marginLeft: 6 }}>
                          {r.entity_id?.slice(0, 8)}...
                        </span>
                      </div>
                    </td>
                    <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "var(--text-muted)" }}>
                      {r.actor_user_id?.slice(0, 8)}...
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      >
                        {expanded === r.id ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr key={`${r.id}-exp`}>
                      <td colSpan={5} style={{ padding: "0 14px 12px" }}>
                        <pre style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          padding: "10px 14px",
                          fontSize: 11,
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: "var(--text-muted)",
                          whiteSpace: "pre-wrap",
                          overflowX: "auto",
                          margin: 0,
                        }}>
                          {JSON.stringify(r.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state">No logs found</div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
