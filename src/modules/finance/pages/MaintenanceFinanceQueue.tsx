import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Badge,
  Btn,
  Card,
  CountPill,
  EmptyState,
  Field,
  PageSpinner,
  Textarea,
} from "@/components/TmsUI";
import { fmtDate, fmtMoney } from "@/lib/utils";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";

type Request = {
  id: string;
  issue_type: string | null;
  issue_description: string;
  status: string;
  created_at: string;
  priority: string | null;
  estimated_cost: number | null;
  scheduled_date: string | null;
  notes: string | null;
  requested_by_supervisor: boolean | null;
  vehicles: { plate_number: string } | null;
  reporter: { full_name: string } | null;
  finance_approved_at: string | null;
  finance_approved_by: string | null;
  finance_notes: string | null;
  finance_actor_name?: string | null;
};

function getFinanceDecisionLabel(status: string) {
  if (status === "finance_rejected") return "Rejected by Finance";
  if (status === "rejected") return "Rejected by Corporate";
  if (status === "reported") return "Forwarded to Corporate";
  return "Reviewed and moved forward";
}

export default function MaintenanceFinanceQueue() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [historyRequests, setHistoryRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [focusedRequestId, setFocusedRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("maintenance_requests")
      .select(
        "id,issue_type,issue_description,status,created_at,priority,estimated_cost,scheduled_date,notes,requested_by_supervisor,finance_approved_at,finance_approved_by,finance_notes,vehicles(plate_number),reporter:reported_by(full_name)"
      )
      .eq("status", "finance_pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("MaintenanceFinanceQueue load:", error.message);
      setRequests([]);
      setLoading(false);
      return;
    }

    const { data: historyData, error: historyError } = await supabase
      .from("maintenance_requests")
      .select(
        "id,issue_type,issue_description,status,created_at,priority,estimated_cost,scheduled_date,notes,requested_by_supervisor,finance_approved_at,finance_approved_by,finance_notes,vehicles(plate_number),reporter:reported_by(full_name)"
      )
      .not("finance_approved_at", "is", null)
      .neq("status", "finance_pending")
      .order("finance_approved_at", { ascending: false })
      .limit(12);

    if (historyError) {
      console.error("MaintenanceFinanceQueue history:", historyError.message);
    }

    const liveRequests = (data as unknown as Request[]) || [];
    const reviewedRequests = (historyData as unknown as Request[]) || [];
    const financeActorIds = [
      ...new Set(reviewedRequests.map((row) => row.finance_approved_by).filter(Boolean)),
    ] as string[];

    let financeActorMap: Record<string, string> = {};

    if (financeActorIds.length > 0) {
      const { data: financeProfiles } = await supabase
        .from("profiles")
        .select("user_id,full_name")
        .in("user_id", financeActorIds);

      financeActorMap = Object.fromEntries(
        (((financeProfiles as { user_id: string; full_name: string }[] | null) || []).map((row) => [
          row.user_id,
          row.full_name,
        ]))
      );
    }

    setRequests(liveRequests);
    setHistoryRequests(
      reviewedRequests.map((row) => ({
        ...row,
        finance_actor_name: row.finance_approved_by
          ? financeActorMap[row.finance_approved_by] ?? null
          : null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const debouncedReload = useMemo(() => debounce(() => void load(), 350), [load]);

  useRealtimeTable({
    table: "maintenance_requests",
    event: "*",
    onChange: debouncedReload,
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ entityType?: string; entityId?: string | null }>
      ).detail;

      if (
        !detail?.entityId ||
        !["maintenance_request", "maintenance"].includes(detail.entityType ?? "")
      ) {
        return;
      }

      setFocusedRequestId(detail.entityId);
      setExpanded(detail.entityId);

      window.setTimeout(() => {
        document
          .getElementById(`maintenance-finance-${detail.entityId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);

      window.setTimeout(() => {
        setFocusedRequestId((current) =>
          current === detail.entityId ? null : current
        );
      }, 4500);
    };

    window.addEventListener("tms:entity-focus", handler);
    return () => window.removeEventListener("tms:entity-focus", handler);
  }, []);

  const act = async (request: Request, nextStatus: "approved" | "rejected") => {
    setActing((prev) => ({ ...prev, [request.id]: true }));

    try {
      const { error } = await supabase.rpc("finance_review_maintenance", {
        p_request_id: request.id,
        p_action: nextStatus,
        p_comment: notes[request.id] ?? null,
      });

      if (error) throw error;

      await load();
      setExpanded(null);
    } catch (actionError: any) {
      alert(`Finance action failed: ${actionError.message}`);
    } finally {
      setActing((prev) => ({ ...prev, [request.id]: false }));
    }
  };

  if (loading) return <PageSpinner variant="cards" count={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CountPill n={requests.length} color="amber" />
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          maintenance request{requests.length !== 1 ? "s" : ""} awaiting finance approval
        </span>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="All caught up"
          subtitle="No maintenance requests are waiting for finance review"
        />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const isOpen = expanded === request.id;
            const isFocused = focusedRequestId === request.id;

            return (
              <div key={request.id} id={`maintenance-finance-${request.id}`}>
              <Card>
                <button
                  className="w-full text-left px-4 py-3"
                  onClick={() => setExpanded(isOpen ? null : request.id)}
                  style={{
                    boxShadow: isFocused
                      ? "0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent), 0 18px 40px rgba(0,0,0,0.12)"
                      : undefined,
                    transition: "all 0.3s ease",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                          {request.vehicles?.plate_number ?? "—"} —{" "}
                          {(request.issue_type ?? "other").replace("_", " ")}
                        </p>

                        {request.requested_by_supervisor && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                          >
                            Supervisor Request
                          </span>
                        )}
                      </div>

                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {request.reporter?.full_name ?? "—"} · {fmtDate(request.created_at)}
                      </p>
                    </div>

                    <Badge status="finance_pending" label="Finance Review" />
                  </div>
                </button>

                {isOpen && (
                  <div
                    className="px-4 pb-4 space-y-3 border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p className="text-sm pt-3" style={{ color: "var(--text)" }}>
                      {request.issue_description}
                    </p>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {request.estimated_cost != null && (
                        <div>
                          <span style={{ color: "var(--text-dim)" }}>Estimated Cost</span>
                          <p className="font-semibold" style={{ color: "var(--text)" }}>
                            {fmtMoney(request.estimated_cost)}
                          </p>
                        </div>
                      )}

                      {request.scheduled_date && (
                        <div>
                          <span style={{ color: "var(--text-dim)" }}>Scheduled Date</span>
                          <p className="font-semibold" style={{ color: "var(--text)" }}>
                            {fmtDate(request.scheduled_date)}
                          </p>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-[color:var(--text-dim)]">
                      Approval path: Finance → Corporate → Maintenance
                    </p>

                    {request.notes && (
                      <p className="text-xs italic whitespace-pre-wrap" style={{ color: "var(--text-muted)" }}>
                        {request.notes}
                      </p>
                    )}

                    <Field label="Finance Comment">
                      <Textarea
                        rows={2}
                        placeholder="Optional finance note..."
                        value={notes[request.id] ?? ""}
                        onChange={(event) =>
                          setNotes((prev) => ({
                            ...prev,
                            [request.id]: event.target.value,
                          }))
                        }
                      />
                    </Field>

                    <div className="flex gap-2">
                      <Btn
                        variant="danger"
                        size="sm"
                        loading={acting[request.id]}
                        onClick={() => act(request, "rejected")}
                      >
                        Reject
                      </Btn>
                      <Btn
                        variant="success"
                        size="sm"
                        loading={acting[request.id]}
                        onClick={() => act(request, "approved")}
                      >
                        Send to Corporate
                      </Btn>
                    </div>
                  </div>
                )}
              </Card>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2">
        <div className="flex items-center gap-3 mb-3">
          <CountPill n={historyRequests.length} color="green" />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            recent finance history
          </span>
        </div>

        {historyRequests.length === 0 ? (
          <Card>
            <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
              Reviewed maintenance requests will appear here after finance forwards or rejects them.
            </div>
          </Card>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr>
                    <th>Vehicle / Issue</th>
                    <th>Reporter</th>
                    <th>Finance Decision</th>
                    <th>Current Status</th>
                    <th>Reviewed</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRequests.map((request) => (
                    <tr key={`maintenance-history-${request.id}`}>
                      <td>
                        <div className="min-w-[180px]">
                          <p className="font-medium text-[color:var(--text)]">
                            {request.vehicles?.plate_number ?? "—"} — {(request.issue_type ?? "other").replace("_", " ")}
                          </p>
                          <p className="text-xs text-[color:var(--text-muted)]">
                            {fmtDate(request.created_at)}
                          </p>
                        </div>
                      </td>
                      <td className="text-[color:var(--text)]">
                        {request.reporter?.full_name ?? "Unknown"}
                      </td>
                      <td>
                        <div className="min-w-[200px]">
                          <p className="text-sm text-[color:var(--text)]">
                            {getFinanceDecisionLabel(request.status)}
                          </p>
                          {request.finance_actor_name && (
                            <p className="text-xs text-[color:var(--text-muted)]">
                              by {request.finance_actor_name}
                            </p>
                          )}
                          {request.finance_notes && (
                            <p className="text-xs text-[color:var(--text-dim)] mt-1">
                              {request.finance_notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge status={request.status} />
                      </td>
                      <td className="whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {request.finance_approved_at ? fmtDate(request.finance_approved_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
