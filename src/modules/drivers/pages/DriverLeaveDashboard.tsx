import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  Alert,
  Btn,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageSpinner,
  SearchInput,
  Select,
  StatCard,
} from "@/components/TmsUI";
import {
  HR_UNIT_ID,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_OPTIONS,
  calculateDriverLeaveSnapshot,
  leaveStatusLabel,
  leaveTypeLabel,
  nextWorkingDate,
  type DriverLeaveBalanceRecord,
  type DriverLeaveDriverRecord,
  type DriverLeaveRecord,
} from "../lib/leave";

type DashboardPayload = {
  drivers: DriverLeaveDriverRecord[];
  balances: DriverLeaveBalanceRecord[];
  requests: DriverLeaveRecord[];
};

type DriverBalanceRow = DriverLeaveDriverRecord & {
  snapshot: ReturnType<typeof calculateDriverLeaveSnapshot>;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending_supervisor", label: LEAVE_STATUS_LABELS.pending_supervisor },
  { value: "pending_corporate", label: LEAVE_STATUS_LABELS.pending_corporate },
  { value: "pending_hr", label: LEAVE_STATUS_LABELS.pending_hr },
  { value: "approved", label: LEAVE_STATUS_LABELS.approved },
  { value: "rejected", label: LEAVE_STATUS_LABELS.rejected },
];

export default function DriverLeaveDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DashboardPayload>({
    drivers: [],
    balances: [],
    requests: [],
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [actingId, setActingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const isAdmin = profile?.system_role === "admin";
  const isSupervisor = profile?.system_role === "transport_supervisor" || isAdmin;
  const isCorporate = profile?.system_role === "corporate_approver" || isAdmin;
  const isHr =
    isAdmin ||
    (profile?.unit_id === HR_UNIT_ID &&
      (profile?.system_role === "unit_head" || profile?.system_role === "staff"));

  const load = async () => {
    setLoading(true);
    setFeedback(null);

    const { data, error } = await supabase.rpc("get_driver_leave_dashboard_data");

    if (error) {
      setFeedback({ type: "error", text: error.message });
      setLoading(false);
      return;
    }

    const nextPayload = (data as DashboardPayload | null) ?? {
      drivers: [],
      balances: [],
      requests: [],
    };

    setPayload(nextPayload);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const focusLeaveRow = (
      event: Event | CustomEvent<{ entityId?: string | null; entityType?: string | null }>
    ) => {
      const detail = (event as CustomEvent<{ entityId?: string | null; entityType?: string | null }>).detail;
      if (!detail?.entityId) return;
      if (detail.entityType && detail.entityType !== "driver_leave_request") return;

      setFocusedId(detail.entityId);
      window.setTimeout(() => {
        document.getElementById(`row-${detail.entityId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 160);
    };

    window.addEventListener("tms:focus-driver-leave-request", focusLeaveRow as EventListener);
    window.addEventListener("tms:entity-focus", focusLeaveRow as EventListener);

    return () => {
      window.removeEventListener("tms:focus-driver-leave-request", focusLeaveRow as EventListener);
      window.removeEventListener("tms:entity-focus", focusLeaveRow as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!focusedId) return;
    const timer = window.setTimeout(() => setFocusedId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [focusedId]);

  const balanceMap = useMemo(() => {
    return new Map(payload.balances.map((balance) => [balance.driver_id, balance]));
  }, [payload.balances]);

  const requestsByDriver = useMemo(() => {
    const map = new Map<string, DriverLeaveRecord[]>();
    payload.requests.forEach((request) => {
      const existing = map.get(request.driver_id) ?? [];
      existing.push(request);
      map.set(request.driver_id, existing);
    });
    return map;
  }, [payload.requests]);

  const driverBalances = useMemo<DriverBalanceRow[]>(() => {
    return payload.drivers.map((driver) => ({
      ...driver,
      snapshot: calculateDriverLeaveSnapshot(
        driver,
        balanceMap.get(driver.id),
        requestsByDriver.get(driver.id) ?? []
      ),
    }));
  }, [balanceMap, payload.drivers, requestsByDriver]);

  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return payload.requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (leaveTypeFilter !== "all" && request.leave_type !== leaveTypeFilter) return false;
      if (!normalized) return true;

      return [
        request.driver_name,
        request.leave_type,
        request.reason ?? "",
        leaveStatusLabel(request.status),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [leaveTypeFilter, payload.requests, query, statusFilter]);

  const filteredBalances = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return driverBalances.filter((driver) => {
      if (!normalized) return true;
      return [driver.full_name ?? "", driver.license_number, driver.phone ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [driverBalances, query]);

  const currentlyOnLeave = useMemo(() => {
    return driverBalances
      .filter((driver) => driver.snapshot.currentlyOnLeave)
      .sort((a, b) =>
        (a.snapshot.currentLeaveEndDate ?? "").localeCompare(
          b.snapshot.currentLeaveEndDate ?? ""
        )
      );
  }, [driverBalances]);

  const resumingSoon = useMemo(() => {
    const today = new Date();
    const inFourteenDays = new Date(today);
    inFourteenDays.setDate(inFourteenDays.getDate() + 14);
    const endIso = toIsoDate(inFourteenDays);

    return driverBalances
      .filter((driver) => {
        const resumeDate = driver.snapshot.currentResumeDate;
        return Boolean(resumeDate && resumeDate >= toIsoDate(today) && resumeDate <= endIso);
      })
      .sort((a, b) =>
        (a.snapshot.currentResumeDate ?? "").localeCompare(
          b.snapshot.currentResumeDate ?? ""
        )
      );
  }, [driverBalances]);

  const metrics = useMemo(() => {
    return {
      pendingSupervisor: payload.requests.filter((request) => request.status === "pending_supervisor").length,
      pendingCorporate: payload.requests.filter((request) => request.status === "pending_corporate").length,
      pendingHr: payload.requests.filter((request) => request.status === "pending_hr").length,
      onLeave: currentlyOnLeave.length,
      resumingSoon: resumingSoon.length,
    };
  }, [currentlyOnLeave.length, payload.requests, resumingSoon.length]);

  const actOnRequest = async (
    request: DriverLeaveRecord,
    stage: "supervisor" | "corporate" | "hr",
    action: "approved" | "rejected"
  ) => {
    setActingId(request.id);
    setFeedback(null);

    const { error } = await supabase.rpc("action_driver_leave", {
      p_request_id: request.id,
      p_action: action,
      p_stage: stage,
      p_note: null,
    });

    if (error) {
      setFeedback({ type: "error", text: error.message });
      setActingId(null);
      return;
    }

    setFeedback({
      type: "success",
      text:
        action === "approved"
          ? `${request.driver_name}'s leave request was updated successfully.`
          : `${request.driver_name}'s leave request was rejected successfully.`,
    });
    setActingId(null);
    await load();
  };

  const requestStage = (request: DriverLeaveRecord) => {
    if (request.status === "pending_supervisor") return "supervisor";
    if (request.status === "pending_corporate") return "corporate";
    if (request.status === "pending_hr") return "hr";
    return null;
  };

  const canReview = (request: DriverLeaveRecord) => {
    if (request.status === "pending_supervisor") return isSupervisor;
    if (request.status === "pending_corporate") return isCorporate;
    if (request.status === "pending_hr") return isHr;
    return false;
  };

  if (loading) return <PageSpinner variant="dashboard" />;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave</h1>
          <p className="page-sub">
            Track approvals, annual balances, active leave, and resumption dates in one place.
          </p>
        </div>
      </div>

      {feedback && (
        <Alert type={feedback.type === "error" ? "error" : "success"}>
          {feedback.text}
        </Alert>
      )}

      <Alert type="info">
        Annual leave accrues daily from the driver's employment date, carries forward when unused,
        and is only deducted after final HR approval. Non-annual leave types stay on record without
        reducing annual balance.
      </Alert>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard label="Pending Supervisor" value={metrics.pendingSupervisor} accent="amber" />
        <StatCard label="Pending Corporate" value={metrics.pendingCorporate} accent="accent" />
        <StatCard label="Pending HR" value={metrics.pendingHr} accent="purple" />
        <StatCard label="On Leave Now" value={metrics.onLeave} accent="green" />
        <StatCard label="Resuming Soon" value={metrics.resumingSoon} accent="cyan" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr,0.9fr] gap-4">
        <Card>
          <CardHeader
            title="Approval Queue"
            subtitle="Every leave request and where it currently sits in the chain"
          />
          <CardBody className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="w-full lg:flex-1">
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search driver, leave type, status..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-[320px]">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select value={leaveTypeFilter} onChange={(e) => setLeaveTypeFilter(e.target.value)}>
                  <option value="all">All leave types</option>
                  {LEAVE_TYPE_OPTIONS.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <EmptyState
                title="No leave requests match the current filters"
                subtitle="Try a different status, leave type, or search term."
              />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="tms-table">
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Type</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Days</th>
                        <th>Status</th>
                        <th>Resume</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((request) => {
                        const stage = requestStage(request);
                        const resumeDate = nextWorkingDate(request.end_date);
                        return (
                          <tr
                            key={request.id}
                            id={`row-${request.id}`}
                            style={{
                              background:
                                focusedId === request.id
                                  ? "color-mix(in srgb, var(--accent-dim) 40%, transparent)"
                                  : "transparent",
                            }}
                          >
                            <td>
                              <div className="font-medium">{request.driver_name}</div>
                              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {request.reason || "No note"}
                              </div>
                            </td>
                            <td>{leaveTypeLabel(request.leave_type)}</td>
                            <td className="whitespace-nowrap text-xs">{fmtDate(request.start_date)}</td>
                            <td className="whitespace-nowrap text-xs">{fmtDate(request.end_date)}</td>
                            <td>{request.working_days}</td>
                            <td>
                              <span className="badge badge-submitted text-xs">
                                {leaveStatusLabel(request.status)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap text-xs">
                              {resumeDate ? fmtDate(resumeDate) : "-"}
                            </td>
                            <td>
                              {stage && canReview(request) ? (
                                <div className="flex gap-2">
                                  <Btn
                                    size="sm"
                                    variant="success"
                                    loading={actingId === request.id}
                                    onClick={() => void actOnRequest(request, stage, "approved")}
                                  >
                                    {stage === "hr" ? "Final Approve" : "Approve"}
                                  </Btn>
                                  <Btn
                                    size="sm"
                                    variant="danger"
                                    loading={actingId === request.id}
                                    onClick={() => void actOnRequest(request, stage, "rejected")}
                                  >
                                    Reject
                                  </Btn>
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                                  No action
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {filteredRequests.map((request) => {
                    const stage = requestStage(request);
                    const resumeDate = nextWorkingDate(request.end_date);
                    return (
                      <div
                        key={request.id}
                        id={`row-${request.id}`}
                        className="card p-4 space-y-3"
                        style={{
                          background:
                            focusedId === request.id
                              ? "color-mix(in srgb, var(--accent-dim) 35%, var(--surface))"
                              : undefined,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-[color:var(--text)]">{request.driver_name}</div>
                            <div className="text-xs text-[color:var(--text-muted)]">
                              {leaveTypeLabel(request.leave_type)}
                            </div>
                          </div>
                          <span className="badge badge-submitted text-xs">
                            {leaveStatusLabel(request.status)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div style={{ color: "var(--text-dim)" }}>From</div>
                            <div>{fmtDate(request.start_date)}</div>
                          </div>
                          <div>
                            <div style={{ color: "var(--text-dim)" }}>To</div>
                            <div>{fmtDate(request.end_date)}</div>
                          </div>
                          <div>
                            <div style={{ color: "var(--text-dim)" }}>Working Days</div>
                            <div>{request.working_days}</div>
                          </div>
                          <div>
                            <div style={{ color: "var(--text-dim)" }}>Resume</div>
                            <div>{resumeDate ? fmtDate(resumeDate) : "-"}</div>
                          </div>
                        </div>
                        <div className="text-xs text-[color:var(--text-muted)]">
                          {request.reason || "No note supplied."}
                        </div>
                        {stage && canReview(request) && (
                          <div className="flex gap-2">
                            <Btn
                              size="sm"
                              variant="success"
                              className="flex-1"
                              loading={actingId === request.id}
                              onClick={() => void actOnRequest(request, stage, "approved")}
                            >
                              {stage === "hr" ? "Final Approve" : "Approve"}
                            </Btn>
                            <Btn
                              size="sm"
                              variant="danger"
                              className="flex-1"
                              loading={actingId === request.id}
                              onClick={() => void actOnRequest(request, stage, "rejected")}
                            >
                              Reject
                            </Btn>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Drivers Currently On Leave"
              subtitle="Approved leave in progress right now"
            />
            <CardBody className="space-y-3">
              {currentlyOnLeave.length === 0 ? (
                <EmptyState
                  title="No drivers are currently on leave"
                  subtitle="This card will highlight active leave cases automatically."
                />
              ) : (
                currentlyOnLeave.map((driver) => (
                  <div
                    key={driver.id}
                    className="rounded-xl border p-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-[color:var(--text)]">
                          {driver.full_name ?? driver.license_number}
                        </div>
                        <div className="text-xs text-[color:var(--text-muted)]">
                          {leaveTypeLabel(driver.snapshot.currentLeaveType ?? "annual")}
                        </div>
                      </div>
                      <span className="badge badge-approved">On leave</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div style={{ color: "var(--text-dim)" }}>Ends</div>
                        <div>{driver.snapshot.currentLeaveEndDate ? fmtDate(driver.snapshot.currentLeaveEndDate) : "-"}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-dim)" }}>Resumes</div>
                        <div>{driver.snapshot.currentResumeDate ? fmtDate(driver.snapshot.currentResumeDate) : "-"}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Resuming In 14 Days"
              subtitle="Useful for planning shifts and cover"
            />
            <CardBody className="space-y-3">
              {resumingSoon.length === 0 ? (
                <EmptyState
                  title="No upcoming resumptions"
                  subtitle="Approved leave resumes in the next 14 days will show here."
                />
              ) : (
                resumingSoon.map((driver) => (
                  <div
                    key={`${driver.id}-resume`}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div>
                      <div className="font-medium text-[color:var(--text)]">
                        {driver.full_name ?? driver.license_number}
                      </div>
                      <div className="text-xs text-[color:var(--text-muted)]">
                        Back on {driver.snapshot.currentResumeDate ? fmtDate(driver.snapshot.currentResumeDate) : "-"}
                      </div>
                    </div>
                    <span className="badge badge-dispatched">
                      {leaveTypeLabel(driver.snapshot.currentLeaveType ?? "leave")}
                    </span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Annual Leave Balances"
          subtitle="Accrual, rollover, usage, and current availability for every driver"
        />
        <CardBody>
          {filteredBalances.length === 0 ? (
            <EmptyState
              title="No drivers match the current search"
              subtitle="Clear the search box to view the full annual leave ledger."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="tms-table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Joined</th>
                    <th>Entitlement</th>
                    <th>Rolled Over</th>
                    <th>Accrued</th>
                    <th>Approved</th>
                    <th>Pending</th>
                    <th>Available</th>
                    <th>Current Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBalances.map((driver) => (
                    <tr key={driver.id}>
                      <td>
                        <div className="font-medium">{driver.full_name ?? driver.license_number}</div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {driver.license_number}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {driver.employment_date ? fmtDate(driver.employment_date) : "-"}
                      </td>
                      <td>{driver.snapshot.annualEntitlement}</td>
                      <td>{driver.snapshot.rolloverDays.toFixed(2)}</td>
                      <td>{driver.snapshot.accruedThisYear.toFixed(2)}</td>
                      <td>{driver.snapshot.approvedAnnualDays}</td>
                      <td>{driver.snapshot.pendingAnnualDays}</td>
                      <td>
                        <span
                          style={{
                            color:
                              driver.snapshot.availableAnnualDays <= 2
                                ? "var(--red)"
                                : driver.snapshot.availableAnnualDays <= 5
                                ? "var(--amber)"
                                : "var(--green)",
                            fontWeight: 700,
                          }}
                        >
                          {driver.snapshot.availableAnnualDays.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        {driver.snapshot.currentlyOnLeave ? (
                          <span className="badge badge-approved">On leave</span>
                        ) : (
                          <span className="badge badge-draft">
                            {driver.employment_status?.replace(/_/g, " ") || "active"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
