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
};

function appendDecisionNote(
  existing: string | null,
  stage: string,
  decision: string,
  comment: string
) {
  const trimmed = comment.trim();
  if (!trimmed) return existing;

  const entry = `[${stage} ${decision}] ${trimmed}`;
  return existing ? `${existing}\n\n${entry}` : entry;
}

export default function MaintenanceFinanceQueue() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("maintenance_requests")
      .select(
        "id,issue_type,issue_description,status,created_at,priority,estimated_cost,scheduled_date,notes,requested_by_supervisor,vehicles(plate_number),reporter:reported_by(full_name)"
      )
      .eq("status", "finance_pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("MaintenanceFinanceQueue load:", error.message);
      setRequests([]);
      setLoading(false);
      return;
    }

    setRequests((data as unknown as Request[]) || []);
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

  const act = async (request: Request, nextStatus: "approved" | "rejected") => {
    setActing((prev) => ({ ...prev, [request.id]: true }));

    try {
      const { error } = await supabase
        .from("maintenance_requests")
        .update({
          status: nextStatus,
          notes: appendDecisionNote(
            request.notes,
            "Finance",
            nextStatus === "approved" ? "approved" : "rejected",
            notes[request.id] ?? ""
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      await load();
      setExpanded(null);
    } catch (actionError: any) {
      alert(`Finance action failed: ${actionError.message}`);
    } finally {
      setActing((prev) => ({ ...prev, [request.id]: false }));
    }
  };

  if (loading) return <PageSpinner />;

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

            return (
              <Card key={request.id}>
                <button
                  className="w-full text-left px-4 py-3"
                  onClick={() => setExpanded(isOpen ? null : request.id)}
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
                        Approve Budget
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
