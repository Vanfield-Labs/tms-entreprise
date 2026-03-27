// src/modules/news/pages/DriverAssignments.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, cachedFetch } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageSpinner, EmptyState, Badge, Card, TabBar } from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";

type Assignment = {
  id: string;
  destination: string;
  gps_address: string | null;
  call_time: string | null;
  departure_time: string | null;
  assignment_date: string;
  is_urgent: boolean;
  is_live_u: boolean;
  notes: string | null;
  status: string;
  unit_name: string;
  reporter_name: string | null;
  camera_tech_name: string | null;
  camera_tech_phone: string | null;
  driver_name: string | null;
};

type Tab = "today" | "upcoming" | "past";

function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : "—";
}

export default function DriverAssignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("today");

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async (force = false) => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const data = await cachedFetch<Assignment[]>(
        `driver_assignments:${user.id}`,
        async () => {
          const { data, error } = await supabase.rpc("get_driver_assignments");
          if (error) throw error;
          return (data as Assignment[]) || [];
        },
        force
      );

      setAssignments(data);
      localStorage.setItem(`driver_assignments_cache:${user.id}`, JSON.stringify(data));
    } catch (e: any) {
      console.error("DriverAssignments load:", e.message);
      try {
        const fallback = localStorage.getItem(`driver_assignments_cache:${user.id}`);
        if (fallback) setAssignments(JSON.parse(fallback));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const debouncedReload = useMemo(() => debounce(() => void load(true), 450), [load]);

  useRealtimeTable({
    table: "news_assignments",
    event: "*",
    enabled: !!user?.id,
    onChange: debouncedReload,
  });

  const filtered = assignments.filter((a) =>
    tab === "today"
      ? a.assignment_date === today
      : tab === "upcoming"
      ? a.assignment_date > today
      : a.assignment_date < today
  );

  const tabs: { value: Tab; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "upcoming", label: "Upcoming" },
    { value: "past", label: "Past" },
  ];

  const counts = {
    today: assignments.filter((a) => a.assignment_date === today).length,
    upcoming: assignments.filter((a) => a.assignment_date > today).length,
    past: assignments.filter((a) => a.assignment_date < today).length,
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">My Assignments</h1>
        <p className="page-sub">News unit deployments you are assigned to</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Today", value: counts.today, color: "var(--accent)" },
          { label: "Upcoming", value: counts.upcoming, color: "var(--green)" },
          { label: "Past", value: counts.past, color: "var(--text-muted)" },
        ].map((s) => (
          <div key={s.label} className="stat-card text-center">
            <div className="stat-value" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <TabBar tabs={tabs} active={tab} onChange={(v) => setTab(v as Tab)} counts={counts} />

      {filtered.length === 0 ? (
        <EmptyState
          title={
            tab === "today"
              ? "No assignments today"
              : tab === "upcoming"
              ? "No upcoming assignments"
              : "No past assignments"
          }
          subtitle="Assignments from news units will appear here when you are assigned"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id}>
              <div
                className="px-4 py-3 border-b"
                style={{
                  borderColor: "var(--border)",
                  background: a.is_urgent ? "var(--red-dim)" : "var(--surface-2)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.is_urgent && <span className="badge badge-rejected">🚨 URGENT</span>}
                      {a.is_live_u && <span className="badge badge-dispatched">📡 Live U</span>}
                      <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                        {a.destination}
                      </p>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {a.unit_name} · {fmtDate(a.assignment_date)}
                      {a.call_time && ` · Call: ${fmtTime(a.call_time)}`}
                      {a.departure_time && ` · Depart: ${fmtTime(a.departure_time)}`}
                    </p>
                  </div>
                  <Badge status={a.status} />
                </div>
              </div>

              <div className="px-4 py-4 grid grid-cols-3 gap-3">
                {[
                  { icon: "🎤", label: "Reporter", val: a.reporter_name, sub: null, you: false },
                  {
                    icon: "📷",
                    label: "Camera Tech",
                    val: a.camera_tech_name,
                    sub: a.camera_tech_phone,
                    you: false,
                  },
                  { icon: "🚗", label: "Driver", val: a.driver_name, sub: null, you: true },
                ].map((m) => (
                  <div key={m.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20 }}>{m.icon}</div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-dim)",
                        textTransform: "uppercase",
                        marginTop: 2,
                      }}
                    >
                      {m.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        marginTop: 2,
                        color: m.you ? "var(--accent)" : "var(--text)",
                      }}
                    >
                      {m.val ?? "—"}
                    </div>
                    {m.you && m.val && (
                      <div style={{ fontSize: 9, color: "var(--accent)", fontWeight: 500 }}>
                        (you)
                      </div>
                    )}
                    {m.sub && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--accent)",
                          fontFamily: "'IBM Plex Mono', monospace",
                          marginTop: 2,
                        }}
                      >
                        {m.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {(a.gps_address || a.notes) && (
                <div
                  className="px-4 pb-4 space-y-1 pt-2"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  {a.gps_address && (
                    <a
                      href={a.gps_address}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 13,
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>📍</span>
                      <span style={{ textDecoration: "underline" }}>Navigate to location →</span>
                    </a>
                  )}
                  {a.notes && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {a.notes}
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}