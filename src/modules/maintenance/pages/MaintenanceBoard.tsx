// src/modules/maintenance/pages/MaintenanceBoard.tsx

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase, cachedFetch } from "@/lib/supabase";
import {
  PageSpinner,
  EmptyState,
  Badge,
  Card,
  CardHeader,
  CardBody,
  Btn,
  Field,
  Input,
  Select,
  Textarea,
  Alert,
  TabBar,
  CountPill,
} from "@/components/TmsUI";
import { fmtDate } from "@/lib/utils";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { debounce } from "@/lib/debounce";

type Vehicle = { id: string; plate_number: string };

type Request = {
  id: string;
  vehicle_id: string;
  issue_type: string | null;
  issue_description: string;
  status: string;
  created_at: string;
  updated_at: string;
  priority: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  scheduled_date: string | null;
  notes: string | null;
  requested_by_supervisor: boolean | null;
  vehicles: { plate_number: string } | null;
  reporter: { full_name: string } | null;
};

type Tab = "pending" | "approved" | "in_progress" | "completed" | "new";

const STATUS_LABEL: Record<string, string> = {
  reported: "Pending",
  finance_pending: "Finance Review",
  approved: "Approved",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed",
};

const ISSUE_TYPES = [
  "engine",
  "tires",
  "brakes",
  "electrical",
  "body",
  "oil_change",
  "service",
  "other",
];

const PRIORITIES = ["low", "normal", "high", "critical"];

export default function MaintenanceBoard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const [fVehicle, setFVehicle] = useState("");
  const [fType, setFType] = useState("service");
  const [fDesc, setFDesc] = useState("");
  const [fPriority, setFPriority] = useState("normal");
  const [fEstCost, setFEstCost] = useState("");
  const [fDate, setFDate] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [vehicleData, requestData] = await Promise.all([
      cachedFetch<Vehicle[]>("vehicles_active_maintenance", async () => {
        const { data } = await supabase
          .from("vehicles")
          .select("id,plate_number")
          .eq("status", "active")
          .order("plate_number");
        return (data as Vehicle[]) || [];
      }),
      supabase
        .from("maintenance_requests")
        .select(
          "id,vehicle_id,issue_type,issue_description,status,created_at,updated_at,priority,estimated_cost,actual_cost,scheduled_date,notes,requested_by_supervisor,vehicles(plate_number),reporter:reported_by(full_name)"
        )
        .order("created_at", { ascending: false }),
    ]);

    setVehicles(vehicleData);
    setRequests((requestData.data as unknown as Request[]) || []);
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

  const updateStatus = async (id: string, status: string) => {
    setActing((m) => ({ ...m, [id]: true }));

    const { error } = await supabase.rpc("update_maintenance_status", {
      p_request_id: id,
      p_status: status,
      p_notes: notes[id] ?? null,
    });

    if (error) {
      alert(error.message);
    }

    await load();
    setActing((m) => ({ ...m, [id]: false }));
    setExpanded(null);
  };

  const submitRequest = async () => {
    if (!fVehicle || !fDesc.trim()) {
      setFormError("Vehicle and description required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.rpc("submit_maintenance_request", {
      p_vehicle_id: fVehicle,
      p_issue_type: fType,
      p_issue_description: fDesc.trim(),
      p_priority: fPriority,
      p_estimated_cost: fEstCost ? parseFloat(fEstCost) : null,
      p_scheduled_date: fDate || null,
      p_notes: fNotes.trim() || null,
      p_requested_by_supervisor: true,
    });

    setSaving(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setFVehicle("");
    setFType("service");
    setFDesc("");
    setFPriority("normal");
    setFEstCost("");
    setFDate("");
    setFNotes("");
    await load();
    setTab("pending");
  };

  const tabMap: Record<Tab, string[]> = {
    pending: ["reported", "finance_pending"],
    approved: ["approved"],
    in_progress: ["in_progress"],
    completed: ["completed", "closed"],
    new: [],
  };

  const visible =
    tab === "new" ? [] : requests.filter((r) => tabMap[tab].includes(r.status));

  const tabs: { value: Tab; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "new", label: "+ New Request" },
  ];

  const counts: Partial<Record<Tab, number>> = {
    pending: requests.filter((r) => ["reported", "finance_pending"].includes(r.status)).length,
    approved: requests.filter((r) => r.status === "approved").length,
    in_progress: requests.filter((r) => r.status === "in_progress").length,
    completed: requests.filter((r) => ["completed", "closed"].includes(r.status)).length,
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">Maintenance</h1>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={(v) => setTab(v as Tab)} counts={counts} />

      {tab === "new" && (
        <Card>
          <CardHeader
            title="Request / Schedule Maintenance"
            subtitle="Submitted for finance review first, then corporate approval"
          />
          <CardBody className="space-y-4">
            {formError && (
              <Alert type="error" onDismiss={() => setFormError(null)}>
                {formError}
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Vehicle" required>
                <Select value={fVehicle} onChange={(e) => setFVehicle(e.target.value)}>
                  <option value="">— Select —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Issue Type">
                <Select value={fType} onChange={(e) => setFType(e.target.value)}>
                  {ISSUE_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Priority">
                <Select value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p} className="capitalize">
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Estimated Cost (GHS)">
                <Input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={fEstCost}
                  onChange={(e) => setFEstCost(e.target.value)}
                />
              </Field>

              <Field label="Scheduled Date">
                <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </Field>
            </div>

            <Field label="Description" required>
              <Textarea
                rows={3}
                placeholder="Describe the issue or required maintenance…"
                value={fDesc}
                onChange={(e) => setFDesc(e.target.value)}
              />
            </Field>

            <Field label="Notes">
              <Textarea
                rows={2}
                placeholder="Additional notes…"
                value={fNotes}
                onChange={(e) => setFNotes(e.target.value)}
              />
            </Field>

            <div className="flex justify-end">
              <Btn variant="primary" onClick={submitRequest} loading={saving}>
                Submit for Approval
              </Btn>
            </div>
          </CardBody>
        </Card>
      )}

      {tab !== "new" && (
        <>
          {visible.length === 0 ? (
            <EmptyState title={`No ${tabs.find((t) => t.value === tab)?.label.toLowerCase()} requests`} />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <CountPill n={visible.length} color="amber" />
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {tabs.find((t) => t.value === tab)?.label}
                </span>
              </div>

              <div className="space-y-3">
                {visible.map((r) => {
                  const isOpen = expanded === r.id;

                  return (
                    <Card key={r.id}>
                      <button
                        className="w-full text-left px-4 py-3"
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                                {r.vehicles?.plate_number ?? "—"} —{" "}
                                {(r.issue_type ?? "other").replace("_", " ")}
                              </p>

                              {r.requested_by_supervisor && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded font-medium"
                                  style={{
                                    background: "var(--accent-dim)",
                                    color: "var(--accent)",
                                  }}
                                >
                                  Supervisor
                                </span>
                              )}

                              {r.priority && r.priority !== "normal" && (
                                <span
                                  className="text-xs font-semibold capitalize"
                                  style={{
                                    color:
                                      r.priority === "critical"
                                        ? "var(--red)"
                                        : r.priority === "high"
                                        ? "var(--amber)"
                                        : "var(--text-muted)",
                                  }}
                                >
                                  {r.priority}
                                </span>
                              )}
                            </div>

                            <p
                              className="text-xs mt-0.5 truncate"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {r.reporter?.full_name ?? "—"} · {fmtDate(r.created_at)}
                            </p>
                          </div>

                          <Badge status={r.status} label={STATUS_LABEL[r.status] ?? r.status} />
                        </div>
                      </button>

                      {isOpen && (
                        <div
                          className="px-4 pb-4 space-y-3 border-t"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <p className="text-sm pt-3" style={{ color: "var(--text)" }}>
                            {r.issue_description}
                          </p>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            {r.estimated_cost != null && (
                              <div>
                                <span style={{ color: "var(--text-dim)" }}>Est. Cost</span>
                                <p className="font-medium" style={{ color: "var(--text)" }}>
                                  GHS {r.estimated_cost.toFixed(2)}
                                </p>
                              </div>
                            )}

                            {r.actual_cost != null && (
                              <div>
                                <span style={{ color: "var(--text-dim)" }}>Actual Cost</span>
                                <p className="font-medium" style={{ color: "var(--text)" }}>
                                  GHS {r.actual_cost.toFixed(2)}
                                </p>
                              </div>
                            )}

                            {r.scheduled_date && (
                              <div>
                                <span style={{ color: "var(--text-dim)" }}>Scheduled Date</span>
                                <p className="font-medium" style={{ color: "var(--text)" }}>
                                  {fmtDate(r.scheduled_date)}
                                </p>
                              </div>
                            )}

                            {r.updated_at && (
                              <div>
                                <span style={{ color: "var(--text-dim)" }}>Updated</span>
                                <p className="font-medium" style={{ color: "var(--text)" }}>
                                  {fmtDate(r.updated_at)}
                                </p>
                              </div>
                            )}
                          </div>

                          {r.notes && (
                            <div
                              className="rounded-lg px-3 py-2 text-xs"
                              style={{
                                background: "var(--surface-2)",
                                border: "1px solid var(--border)",
                                color: "var(--text-muted)",
                              }}
                            >
                              {r.notes}
                            </div>
                          )}

                          {r.status !== "completed" && r.status !== "closed" && (
                            <>
                              <Field label="Update Notes">
                                <Input
                                  placeholder="Optional note for this update…"
                                  value={notes[r.id] ?? ""}
                                  onChange={(e) =>
                                    setNotes((m) => ({
                                      ...m,
                                      [r.id]: e.target.value,
                                    }))
                                  }
                                />
                              </Field>

                              <div className="flex flex-wrap gap-2">
                                {r.status === "approved" && (
                                  <Btn
                                    size="sm"
                                    variant="primary"
                                    loading={acting[r.id]}
                                    onClick={() => updateStatus(r.id, "in_progress")}
                                  >
                                    Start Work
                                  </Btn>
                                )}

                                {(r.status === "approved" || r.status === "in_progress") && (
                                  <Btn
                                    size="sm"
                                    variant="success"
                                    loading={acting[r.id]}
                                    onClick={() => updateStatus(r.id, "completed")}
                                  >
                                    Mark Completed
                                  </Btn>
                                )}

                                {r.status === "completed" && (
                                  <Btn
                                    size="sm"
                                    variant="primary"
                                    loading={acting[r.id]}
                                    onClick={() => updateStatus(r.id, "closed")}
                                  >
                                    Close
                                  </Btn>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
