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
  Field,
  Input,
  PageSpinner,
  Select,
  StatCard,
  Textarea,
} from "@/components/TmsUI";
import {
  LEAVE_TYPE_OPTIONS,
  calculateDriverLeaveSnapshot,
  leaveStatusLabel,
  leaveTypeLabel,
  nextWorkingDate,
  type DriverLeaveBalanceRecord,
  type DriverLeaveDriverRecord,
  type DriverLeaveRecord,
} from "../lib/leave";

type MyLeavePayload = {
  driver: DriverLeaveDriverRecord | null;
  balance: DriverLeaveBalanceRecord | null;
  requests: DriverLeaveRecord[];
};

const EMPTY_PAYLOAD: MyLeavePayload = {
  driver: null,
  balance: null,
  requests: [],
};

export default function DriverLeavePage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [payload, setPayload] = useState<MyLeavePayload>(EMPTY_PAYLOAD);
  const [leaveType, setLeaveType] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    setFeedback(null);

    const { data, error } = await supabase.rpc("get_my_driver_leave_dashboard_data");

    if (error) {
      setFeedback({ type: "error", text: error.message });
      setLoading(false);
      return;
    }

    setPayload((data as MyLeavePayload | null) ?? EMPTY_PAYLOAD);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const snapshot = useMemo(() => {
    if (!payload.driver) return null;
    return calculateDriverLeaveSnapshot(
      payload.driver,
      payload.balance ?? undefined,
      payload.requests
    );
  }, [payload.balance, payload.driver, payload.requests]);

  const currentLeave = useMemo(() => {
    if (!snapshot?.currentlyOnLeave) return null;

    return payload.requests.find(
      (request) =>
        request.status === "approved" &&
        request.start_date <= toIsoDate(new Date()) &&
        request.end_date >= toIsoDate(new Date())
    ) ?? null;
  }, [payload.requests, snapshot?.currentlyOnLeave]);

  const submitLeave = async () => {
    if (!payload.driver) {
      setFeedback({ type: "error", text: "Your driver profile was not found." });
      return;
    }

    if (!startDate || !endDate) {
      setFeedback({ type: "error", text: "Choose both a start date and an end date." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const { error } = await supabase.rpc("submit_driver_leave", {
      p_driver_id: payload.driver.id,
      p_leave_type: leaveType,
      p_start_date: startDate,
      p_end_date: endDate,
      p_reason: reason.trim() || null,
    });

    if (error) {
      setFeedback({ type: "error", text: error.message });
      setSubmitting(false);
      return;
    }

    setFeedback({
      type: "success",
      text: "Your leave request has been submitted to transport for review.",
    });
    setLeaveType("annual");
    setStartDate("");
    setEndDate("");
    setReason("");
    setSubmitting(false);
    await load();
  };

  if (loading) return <PageSpinner variant="dashboard" />;

  if (!payload.driver || !snapshot) {
    return (
      <div className="space-y-4">
        {feedback && (
          <Alert type="error">{feedback.text}</Alert>
        )}
        <EmptyState
          title="Driver profile not found"
          subtitle="Your login is not linked to a driver record yet. Please contact transport or admin."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave</h1>
          <p className="page-sub">
            Apply for leave, track approvals, and monitor your annual leave balance.
          </p>
        </div>
      </div>

      {feedback && (
        <Alert type={feedback.type === "error" ? "error" : "success"}>
          {feedback.text}
        </Alert>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Available Annual Days"
          value={snapshot.availableAnnualDays.toFixed(2)}
          accent={snapshot.availableAnnualDays <= 2 ? "red" : snapshot.availableAnnualDays <= 5 ? "amber" : "green"}
        />
        <StatCard label="Rolled Over" value={snapshot.rolloverDays.toFixed(2)} accent="accent" />
        <StatCard label="Accrued This Year" value={snapshot.accruedThisYear.toFixed(2)} accent="purple" />
        <StatCard label="Pending Annual Days" value={snapshot.pendingAnnualDays} accent="amber" />
      </div>

      {currentLeave && (
        <Alert type="info">
          You are currently on {leaveTypeLabel(currentLeave.leave_type)} until {fmtDate(currentLeave.end_date)} and should resume on{" "}
          {nextWorkingDate(currentLeave.end_date) ? fmtDate(nextWorkingDate(currentLeave.end_date) as string) : "-"}.
        </Alert>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr,1.25fr] gap-4">
        <Card>
          <CardHeader
            title="Apply for Leave"
            subtitle={`Employment start: ${payload.driver.employment_date ? fmtDate(payload.driver.employment_date) : "Not set"}`}
          />
          <CardBody className="space-y-4">
            <Field
              label="Leave Type"
              hint="Annual leave checks your available balance. Other leave types stay on record without deducting annual days."
            >
              <Select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                {LEAVE_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Start Date" required>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="End Date" required>
                <Input type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>

            <Field label="Reason / Note">
              <Textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Add any context HR and approvers should know."
              />
            </Field>

            <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <div className="font-medium text-[color:var(--text)]">{profile?.full_name ?? payload.driver.full_name ?? payload.driver.license_number}</div>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                {payload.driver.license_number} {payload.driver.phone ? `· ${payload.driver.phone}` : ""}
              </div>
            </div>

            <div className="flex justify-end">
              <Btn variant="primary" loading={submitting} onClick={submitLeave}>
                Submit Leave Request
              </Btn>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="My Leave Requests"
            subtitle="Supervisor approval comes first, then corporate, then HR"
          />
          <CardBody>
            {payload.requests.length === 0 ? (
              <EmptyState
                title="No leave requests yet"
                subtitle="Your submitted leave requests will appear here with their approval progress."
              />
            ) : (
              <div className="space-y-3">
                {payload.requests.map((request) => {
                  const resumeDate = request.status === "approved" ? nextWorkingDate(request.end_date) : null;
                  return (
                    <div
                      key={request.id}
                      id={`row-${request.id}`}
                      className="rounded-2xl border p-4"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-[color:var(--text)]">
                            {leaveTypeLabel(request.leave_type)}
                          </div>
                          <div className="text-xs text-[color:var(--text-muted)]">
                            Submitted {fmtDate(request.created_at.slice(0, 10))}
                          </div>
                        </div>
                        <span className="badge badge-submitted text-xs">
                          {leaveStatusLabel(request.status)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
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
                          <div style={{ color: "var(--text-dim)" }}>Resume Date</div>
                          <div>{resumeDate ? fmtDate(resumeDate) : "-"}</div>
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-[color:var(--text-muted)]">
                        {request.reason || "No additional note supplied."}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
