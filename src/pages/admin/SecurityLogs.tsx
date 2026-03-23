// src/pages/admin/SecurityLogs.tsx
// Admin-only: searchable login audit log with warnings for failed attempts.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageSpinner, EmptyState, SearchInput, Card } from "@/components/TmsUI";
import { fmtDateTime } from "@/lib/utils";

type LogEntry = {
  id: string;
  user_id: string | null;
  email: string | null;
  event: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

type Profile = {
  user_id: string;
  failed_login_count: number;
  full_name: string;
};

const EVENT_STYLE: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  login_success:    { label: "Login Success",    color: "var(--green)",  bg: "var(--green-dim)",  icon: "✓" },
  login_failed:     { label: "Login Failed",     color: "var(--red)",    bg: "var(--red-dim)",    icon: "✗" },
  logout:           { label: "Logout",           color: "var(--text-muted)", bg: "var(--surface-2)", icon: "→" },
  session_expired:  { label: "Session Expired",  color: "var(--amber)",  bg: "var(--amber-dim)",  icon: "⏱" },
  password_changed: { label: "Password Changed", color: "var(--accent)", bg: "var(--accent-dim)", icon: "🔑" },
};

const EVENT_FILTERS = ["all", "login_success", "login_failed", "logout", "session_expired", "password_changed"];

export default function SecurityLogs() {
  const [logs,       setLogs]       = useState<LogEntry[]>([]);
  const [profiles,   setProfiles]   = useState<Profile[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [q,          setQ]          = useState("");
  const [eventFilter, setEventFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from("login_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("profiles")
          .select("user_id, full_name, failed_login_count")
          .gt("failed_login_count", 3),
      ]);
      setLogs((l as LogEntry[]) || []);
      setProfiles((p as Profile[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = logs.filter(l => {
    const matchEvent = eventFilter === "all" || l.event === eventFilter;
    const matchQ = !q || [l.email, l.event, l.user_agent, l.ip_address]
      .filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase());
    return matchEvent && matchQ;
  });

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Logs</h1>
          <p className="page-sub">Login and session audit trail</p>
        </div>
      </div>

      {/* High-risk account warnings */}
      {profiles.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3"
          style={{ background: "var(--red-dim)", borderColor: "var(--red)" }}
        >
          <p className="text-sm font-semibold mb-2" style={{ color: "var(--red)" }}>
            ⚠️ Accounts with {">"}3 failed login attempts
          </p>
          <div className="flex flex-wrap gap-2">
            {profiles.map(p => (
              <span
                key={p.user_id}
                className="text-xs px-2 py-1 rounded-lg font-medium"
                style={{ background: "var(--surface)", color: "var(--text)" }}
              >
                {p.full_name} — {p.failed_login_count} failures
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="sm:w-64">
          <SearchInput value={q} onChange={setQ} placeholder="Search email, event, IP…" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {EVENT_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setEventFilter(f)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
              style={{
                background: eventFilter === f ? "var(--accent)" : "var(--surface-2)",
                color:      eventFilter === f ? "#fff" : "var(--text-muted)",
                border:     `1px solid ${eventFilter === f ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {f === "all" ? "All" : (EVENT_STYLE[f]?.label ?? f)}
            </button>
          ))}
        </div>
        <span className="text-xs self-center ml-auto font-mono" style={{ color: "var(--text-muted)" }}>
          {filtered.length} entries
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No log entries" subtitle="Login events will appear here as users sign in" />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map(l => {
              const style = EVENT_STYLE[l.event] ?? { label: l.event, color: "var(--text-muted)", bg: "var(--surface-2)", icon: "·" };
              return (
                <Card key={l.id}>
                  <div className="p-3 flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 font-bold"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {style.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: style.color }}>{style.label}</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{l.email ?? "—"}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{fmtDateTime(l.created_at)}</p>
                      {l.user_agent && (
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-dim)" }}>{l.user_agent.slice(0, 60)}</p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr><th>Event</th><th>Email</th><th>IP</th><th>Browser</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const style = EVENT_STYLE[l.event] ?? { label: l.event, color: "var(--text-muted)", bg: "var(--surface-2)", icon: "·" };
                    return (
                      <tr key={l.id} style={{ background: l.event === "login_failed" ? "var(--red-dim)" : undefined }}>
                        <td>
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ background: style.bg, color: style.color }}
                          >
                            {style.icon} {style.label}
                          </span>
                        </td>
                        <td className="font-mono text-xs">{l.email ?? "—"}</td>
                        <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{l.ip_address ?? "—"}</td>
                        <td className="text-xs max-w-[180px] truncate" style={{ color: "var(--text-dim)" }}>
                          {l.user_agent ? l.user_agent.slice(0, 60) : "—"}
                        </td>
                        <td className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                          {fmtDateTime(l.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}