// src/modules/news/pages/AllAssignmentsBoard.tsx
// Transport supervisor + Group Leader view:
//   Shows all news_assignments segmented by unit, where drivers are involved.
//   Also shows assignments involving camera techs (for context).
//   Group leaders only see their team's drivers.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageSpinner, EmptyState, Badge, Card, SearchInput, TabBar } from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";

type Assignment = {
  id: string; destination: string; gps_address: string | null;
  call_time: string | null; departure_time: string | null;
  assignment_date: string; is_urgent: boolean; is_live_u: boolean;
  notes: string | null; status: string;
  unit_name: string;
  reporter_name: string | null;
  driver_name: string | null; driver_phone: string | null;
  camera_tech_name: string | null;
};

type Tab = "today" | "upcoming" | "all";

function fmtTime(t: string | null) { return t ? t.slice(0, 5) : "—"; }

export default function AllAssignmentsBoard() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<Tab>("today");
  const [q, setQ]                     = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("news_assignments")
        .select("id,destination,gps_address,call_time,departure_time,assignment_date,is_urgent,is_live_u,notes,status,unit_id,reporter_id,driver_id,camera_tech_id")
        .neq("status", "cancelled")
        .order("assignment_date", { ascending: false })
        .limit(500);

      // Group leaders: filter by drivers in their team
      if (profile?.system_role !== "transport_supervisor" && profile?.system_role !== "admin") {
        // Find this user's driver record to get team_id
        const { data: drv } = await supabase.from("drivers")
          .select("id,team_id,team_role").eq("user_id", profile?.user_id ?? "").single();
        if (drv && (drv as any).team_id) {
          // Get all driver IDs in this team
          const { data: teamDrivers } = await supabase.from("drivers")
            .select("id").eq("team_id", (drv as any).team_id);
          const teamDriverIds = ((teamDrivers as any[]) || []).map(d => d.id);
          if (teamDriverIds.length > 0) {
            query = query.in("driver_id", teamDriverIds);
          }
        }
      }

      const { data: asgData } = await query;
      const asgArr = (asgData as any[]) || [];

      const repIds     = [...new Set(asgArr.map(a => a.reporter_id).filter(Boolean))];
      const drvIds     = [...new Set(asgArr.map(a => a.driver_id).filter(Boolean))];
      const camIds     = [...new Set(asgArr.map(a => a.camera_tech_id).filter(Boolean))];
      const unitIds    = [...new Set(asgArr.map(a => a.unit_id).filter(Boolean))];

      const [{ data: repP }, { data: drvD }, { data: camP }, { data: uData }] = await Promise.all([
        repIds.length  ? supabase.from("profiles").select("user_id,full_name").in("user_id", repIds)  : Promise.resolve({ data: [] }),
        drvIds.length  ? supabase.from("drivers").select("id,full_name,phone").in("id", drvIds)       : Promise.resolve({ data: [] }),
        camIds.length  ? supabase.from("profiles").select("user_id,full_name").in("user_id", camIds)  : Promise.resolve({ data: [] }),
        unitIds.length ? supabase.from("units").select("id,name").in("id", unitIds)                   : Promise.resolve({ data: [] }),
      ]);

      const repMap  = Object.fromEntries(((repP as any[]) || []).map(p => [p.user_id, p.full_name]));
      const drvMap  = Object.fromEntries(((drvD as any[]) || []).map(d => [d.id, d]));
      const camMap  = Object.fromEntries(((camP as any[]) || []).map(p => [p.user_id, p.full_name]));
      const uMap    = Object.fromEntries(((uData as any[]) || []).map(u => [u.id, u.name]));

      setAssignments(asgArr.map(a => ({
        ...a,
        unit_name:        uMap[a.unit_id] ?? "Unknown",
        reporter_name:    a.reporter_id    ? repMap[a.reporter_id]    ?? null : null,
        driver_name:      a.driver_id      ? (drvMap[a.driver_id] as any)?.full_name ?? null : null,
        driver_phone:     a.driver_id      ? (drvMap[a.driver_id] as any)?.phone ?? null : null,
        camera_tech_name: a.camera_tech_id ? camMap[a.camera_tech_id] ?? null : null,
      })));
    } finally { setLoading(false); }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const filtered = assignments.filter(a => {
    const matchTab = tab === "today"    ? a.assignment_date === today
                   : tab === "upcoming" ? a.assignment_date > today
                   : true;
    const matchQ = !q || [a.destination, a.unit_name, a.reporter_name, a.driver_name, a.camera_tech_name]
      .filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase());
    return matchTab && matchQ;
  });

  // Group by unit
  const byUnit: Record<string, Assignment[]> = {};
  filtered.forEach(a => { (byUnit[a.unit_name] = byUnit[a.unit_name] || []).push(a); });

  const tabs: { value: Tab; label: string }[] = [
    { value: "today",    label: "Today" },
    { value: "upcoming", label: "Upcoming" },
    { value: "all",      label: "All" },
  ];
  const counts = {
    today:    assignments.filter(a => a.assignment_date === today).length,
    upcoming: assignments.filter(a => a.assignment_date > today).length,
    all:      assignments.length,
  };

  if (loading) return <PageSpinner variant="cards" count={4} />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">Assignments Board</h1>
        <p className="page-sub">News unit assignments · drivers &amp; camera crew</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Today",    value: counts.today,    color: "var(--accent)" },
          { label: "Upcoming", value: counts.upcoming, color: "var(--amber)"  },
          { label: "Total",    value: counts.all,      color: "var(--text)"   },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} counts={counts} />
      <SearchInput value={q} onChange={setQ} placeholder="Search destination, unit, driver…" />

      {Object.keys(byUnit).length === 0 ? (
        <EmptyState title="No assignments found" subtitle="Active news unit assignments will appear here" />
      ) : (
        <div className="space-y-6">
          {Object.entries(byUnit).map(([unitName, asgs]) => (
            <div key={unitName}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                📺 {unitName} — {asgs.length} assignment{asgs.length !== 1 ? "s" : ""}
              </h3>
              <div className="space-y-2">
                {asgs.map(a => (
                  <Card key={a.id}>
                    <div className="px-4 py-3 border-b flex items-start justify-between gap-2"
                      style={{ borderColor: "var(--border)", background: a.is_urgent ? "var(--red-dim)" : "var(--surface-2)" }}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {a.is_urgent && <span className="badge badge-rejected">🚨 URGENT</span>}
                          {a.is_live_u && <span className="badge badge-dispatched">📡 Live U</span>}
                          <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{a.destination}</p>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {fmtDate(a.assignment_date)}
                          {a.call_time      && ` · Call: ${fmtTime(a.call_time)}`}
                          {a.departure_time && ` · Depart: ${fmtTime(a.departure_time)}`}
                        </p>
                      </div>
                      <Badge status={a.status} />
                    </div>
                    <div className="px-4 py-3 grid grid-cols-3 gap-3">
                      {[
                        { icon: "🎤", label: "Reporter", val: a.reporter_name, sub: null },
                        { icon: "📷", label: "Camera",   val: a.camera_tech_name, sub: null },
                        { icon: "🚗", label: "Driver",   val: a.driver_name, sub: a.driver_phone },
                      ].map(m => (
                        <div key={m.label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 18 }}>{m.icon}</div>
                          <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", marginTop: 2 }}>{m.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 1 }}>{m.val ?? "—"}</div>
                          {m.sub && <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "monospace" }}>{m.sub}</div>}
                        </div>
                      ))}
                    </div>
                    {(a.gps_address || a.notes) && (
                      <div className="px-4 pb-3">
                        {a.gps_address && (
                          <a href={a.gps_address} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: "var(--accent)", display: "block" }}>📍 Navigate →</a>
                        )}
                        {a.notes && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{a.notes}</p>}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
