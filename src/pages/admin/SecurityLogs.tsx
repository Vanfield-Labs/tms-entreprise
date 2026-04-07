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
  login_success: { label: "Login Success", color: "var(--green)", bg: "var(--green-dim)", icon: "OK" },
  login_failed: { label: "Login Failed", color: "var(--red)", bg: "var(--red-dim)", icon: "X" },
  logout: { label: "Logout", color: "var(--text-muted)", bg: "var(--surface-2)", icon: "->" },
  session_expired: { label: "Session Expired", color: "var(--amber)", bg: "var(--amber-dim)", icon: "!" },
  password_changed: { label: "Password Changed", color: "var(--accent)", bg: "var(--accent-dim)", icon: "KEY" },
};

const EVENT_FILTERS = [
  "all",
  "login_success",
  "login_failed",
  "logout",
  "session_expired",
  "password_changed",
];

function normalizeEvent(event: string | null | undefined) {
  return (event ?? "").trim().toLowerCase();
}

function normalizeLogEntry(entry: LogEntry): LogEntry {
  return {
    ...entry,
    event: normalizeEvent(entry.event),
  };
}

export default function SecurityLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [eventFilter, setEventFilter] = useState("all");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const [{ data: logData, error: logsError }, { data: profileData, error: profilesError }] =
        await Promise.all([
          supabase.from("login_audit_log").select("*").order("created_at", { ascending: false }).limit(500),
          supabase
            .from("profiles")
            .select("user_id, full_name, failed_login_count")
            .gt("failed_login_count", 3),
        ]);

      if (!alive) return;

      if (logsError || profilesError) {
        setError(logsError?.message || profilesError?.message || "Could not load security logs");
      } else {
        setError(null);
      }

      setLogs(((logData as LogEntry[]) || []).map(normalizeLogEntry));
      setProfiles((profileData as Profile[]) || []);
      setLoading(false);
    };

    void load();

    const auditChannel = supabase
      .channel("security-logs:audit")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "login_audit_log" },
        () => {
          void load();
        }
      )
      .subscribe();

    const profilesChannel = supabase
      .channel("security-logs:profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          void load();
        }
      )
      .subscribe();

    const intervalId = window.setInterval(() => {
      void load();
    }, 15000);

    const reloadWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    window.addEventListener("focus", reloadWhenVisible);
    document.addEventListener("visibilitychange", reloadWhenVisible);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", reloadWhenVisible);
      document.removeEventListener("visibilitychange", reloadWhenVisible);
      void supabase.removeChannel(auditChannel);
      void supabase.removeChannel(profilesChannel);
    };
  }, []);

  const refresh = async () => {
    setLoading(true);

    const [{ data: logData, error: logsError }, { data: profileData, error: profilesError }] =
      await Promise.all([
        supabase.from("login_audit_log").select("*").order("created_at", { ascending: false }).limit(500),
        supabase
          .from("profiles")
          .select("user_id, full_name, failed_login_count")
          .gt("failed_login_count", 3),
      ]);

    if (logsError || profilesError) {
      setError(logsError?.message || profilesError?.message || "Could not load security logs");
    } else {
      setError(null);
    }

    setLogs(((logData as LogEntry[]) || []).map(normalizeLogEntry));
    setProfiles((profileData as Profile[]) || []);
    setLoading(false);
  };

  const filtered = logs.filter((log) => {
    const event = normalizeEvent(log.event);
    const matchEvent = eventFilter === "all" || event === eventFilter;
    const matchQuery =
      !q ||
      [log.email, event, log.user_agent, log.ip_address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase());

    return matchEvent && matchQuery;
  });

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Logs</h1>
          <p className="page-sub">Login and session audit trail</p>
        </div>
        <button onClick={() => void refresh()} className="btn btn-secondary" type="button">
          Refresh
        </button>
      </div>

      {error && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: "var(--amber-dim)", borderColor: "var(--amber)", color: "var(--amber)" }}
        >
          {error}
        </div>
      )}

      {profiles.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3"
          style={{ background: "var(--red-dim)", borderColor: "var(--red)" }}
        >
          <p className="mb-2 text-sm font-semibold" style={{ color: "var(--red)" }}>
            Warning: accounts with more than 3 failed login attempts
          </p>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => (
              <span
                key={profile.user_id}
                className="rounded-lg px-2 py-1 text-xs font-medium"
                style={{ background: "var(--surface)", color: "var(--text)" }}
              >
                {profile.full_name} - {profile.failed_login_count} failures
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="sm:w-64">
          <SearchInput value={q} onChange={setQ} placeholder="Search email, event, IP..." />
        </div>
        <div className="flex flex-wrap gap-1">
          {EVENT_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setEventFilter(filter)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-all"
              style={{
                background: eventFilter === filter ? "var(--accent)" : "var(--surface-2)",
                color: eventFilter === filter ? "#fff" : "var(--text-muted)",
                border: `1px solid ${eventFilter === filter ? "var(--accent)" : "var(--border)"}`,
              }}
              type="button"
            >
              {filter === "all" ? "All" : (EVENT_STYLE[filter]?.label ?? filter)}
            </button>
          ))}
        </div>
        <span className="ml-auto self-center font-mono text-xs" style={{ color: "var(--text-muted)" }}>
          {filtered.length} entries
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No log entries" subtitle="Login events will appear here as users sign in" />
      ) : (
        <>
          <div className="space-y-2 sm:hidden">
            {filtered.map((log) => {
              const event = normalizeEvent(log.event);
              const style = EVENT_STYLE[event] ?? {
                label: event || "Unknown",
                color: "var(--text-muted)",
                bg: "var(--surface-2)",
                icon: ".",
              };

              return (
                <Card key={log.id}>
                  <div className="flex items-start gap-3 p-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {style.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: style.color }}>
                          {style.label}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {log.email ?? "-"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--text-dim)" }}>
                        {fmtDateTime(log.created_at)}
                      </p>
                      {log.user_agent && (
                        <p className="mt-0.5 truncate text-[10px]" style={{ color: "var(--text-dim)" }}>
                          {log.user_agent.slice(0, 60)}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="hidden overflow-hidden sm:block card">
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Email</th>
                    <th>IP</th>
                    <th>Browser</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => {
                    const event = normalizeEvent(log.event);
                    const style = EVENT_STYLE[event] ?? {
                      label: event || "Unknown",
                      color: "var(--text-muted)",
                      bg: "var(--surface-2)",
                      icon: ".",
                    };

                    return (
                      <tr key={log.id} style={{ background: event === "login_failed" ? "var(--red-dim)" : undefined }}>
                        <td>
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                            style={{ background: style.bg, color: style.color }}
                          >
                            {style.icon} {style.label}
                          </span>
                        </td>
                        <td className="font-mono text-xs">{log.email ?? "-"}</td>
                        <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                          {log.ip_address ?? "-"}
                        </td>
                        <td className="max-w-[180px] truncate text-xs" style={{ color: "var(--text-dim)" }}>
                          {log.user_agent ? log.user_agent.slice(0, 60) : "-"}
                        </td>
                        <td className="whitespace-nowrap text-xs" style={{ color: "var(--text-muted)" }}>
                          {fmtDateTime(log.created_at)}
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
