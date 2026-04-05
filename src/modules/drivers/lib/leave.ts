export const HR_UNIT_ID = "f14262ab-7490-4958-94a9-dea5b11bf0c5";

export const LEAVE_TYPE_OPTIONS = [
  { value: "annual", label: "Annual Leave", deductsAnnual: true },
  { value: "sick", label: "Sick Leave", deductsAnnual: false },
  { value: "maternity", label: "Maternity Leave", deductsAnnual: false },
  { value: "paternity", label: "Paternity Leave", deductsAnnual: false },
  { value: "emergency", label: "Emergency Leave", deductsAnnual: false },
  { value: "bereavement", label: "Bereavement Leave", deductsAnnual: false },
  { value: "study", label: "Study Leave", deductsAnnual: false },
  { value: "compassionate", label: "Compassionate Leave", deductsAnnual: false },
  { value: "unpaid", label: "Unpaid Leave", deductsAnnual: false },
  { value: "other", label: "Other", deductsAnnual: false },
] as const;

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending_supervisor: "Awaiting Supervisor",
  pending_corporate: "Awaiting Corporate",
  pending_hr: "Awaiting HR",
  approved: "Approved",
  rejected: "Rejected",
};

export type DriverLeaveRecord = {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_user_id?: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
};

export type DriverLeaveBalanceRecord = {
  driver_id: string;
  annual_entitlement: number | null;
  days_taken: number | null;
  days_booked_in: number | null;
  accrual_start_date: string | null;
  updated_at?: string | null;
};

export type DriverLeaveDriverRecord = {
  id: string;
  user_id?: string | null;
  full_name: string | null;
  license_number: string;
  employment_status: string;
  employment_date: string | null;
  phone?: string | null;
};

export type DriverLeaveSnapshot = {
  annualEntitlement: number;
  accrualStartDate: string | null;
  rolloverDays: number;
  accruedThisYear: number;
  approvedAnnualDays: number;
  pendingAnnualDays: number;
  availableAnnualDays: number;
  currentlyOnLeave: boolean;
  currentLeaveType: string | null;
  currentLeaveEndDate: string | null;
  currentResumeDate: string | null;
};

const ANNUAL_LEAVE_TYPES: Set<string> = new Set(
  LEAVE_TYPE_OPTIONS.filter((type) => type.deductsAnnual).map((type) => type.value)
);

export function leaveTypeLabel(value: string) {
  return (
    LEAVE_TYPE_OPTIONS.find((type) => type.value === value)?.label ??
    value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function leaveStatusLabel(status: string) {
  return LEAVE_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function nextWorkingDate(dateLike: string | null) {
  if (!dateLike) return null;

  const date = fromIsoDate(dateLike);
  if (!date) return null;

  const next = new Date(date);
  do {
    next.setDate(next.getDate() + 1);
  } while (next.getDay() === 0 || next.getDay() === 6);

  return toIsoDate(next);
}

export function calculateDriverLeaveSnapshot(
  driver: DriverLeaveDriverRecord,
  balance: DriverLeaveBalanceRecord | undefined,
  requests: DriverLeaveRecord[],
  today = new Date()
): DriverLeaveSnapshot {
  const annualEntitlement = balance?.annual_entitlement ?? 20;
  const todayIso = toIsoDate(today);
  const currentYear = today.getFullYear();
  const accrualStartDate =
    balance?.accrual_start_date ?? driver.employment_date ?? todayIso;
  const accrualStart = fromIsoDate(accrualStartDate) ?? today;

  let priorEntitlement = 0;
  for (let year = accrualStart.getFullYear(); year < currentYear; year += 1) {
    const yearStart = maxDate(
      new Date(year, 0, 1),
      new Date(accrualStart.getFullYear(), accrualStart.getMonth(), accrualStart.getDate())
    );
    const clampedYearStart = year === accrualStart.getFullYear() ? maxDate(yearStart, accrualStart) : yearStart;
    const yearEnd = new Date(year, 11, 31);

    if (clampedYearStart <= yearEnd) {
      priorEntitlement +=
        annualEntitlement *
        ((diffInCalendarDays(yearEnd, clampedYearStart) + 1) / daysInYear(year));
    }
  }

  const currentYearStart = maxDate(new Date(currentYear, 0, 1), accrualStart);
  const accruedThisYear =
    currentYearStart <= today
      ? annualEntitlement *
        ((diffInCalendarDays(today, currentYearStart) + 1) / daysInYear(currentYear))
      : 0;

  const approvedBeforeCurrent = sumDays(
    requests.filter(
      (request) =>
        ANNUAL_LEAVE_TYPES.has(request.leave_type) &&
        request.status === "approved" &&
        new Date(request.start_date).getFullYear() < currentYear
    )
  );
  const approvedAnnualDays = sumDays(
    requests.filter(
      (request) =>
        ANNUAL_LEAVE_TYPES.has(request.leave_type) &&
        request.status === "approved" &&
        new Date(request.start_date).getFullYear() === currentYear
    )
  );
  const pendingAnnualDays = sumDays(
    requests.filter(
      (request) =>
        ANNUAL_LEAVE_TYPES.has(request.leave_type) &&
        ["pending_supervisor", "pending_corporate", "pending_hr"].includes(
          request.status
        ) &&
        new Date(request.start_date).getFullYear() === currentYear
    )
  );

  const rolloverDays = Math.max(0, round2(priorEntitlement - approvedBeforeCurrent));
  const accruedRounded = round2(accruedThisYear);
  const availableAnnualDays = Math.max(
    0,
    round2(rolloverDays + accruedRounded - approvedAnnualDays - pendingAnnualDays)
  );

  const currentLeave = requests
    .filter(
      (request) =>
        request.status === "approved" &&
        request.start_date <= todayIso &&
        request.end_date >= todayIso
    )
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];

  return {
    annualEntitlement,
    accrualStartDate,
    rolloverDays,
    accruedThisYear: accruedRounded,
    approvedAnnualDays,
    pendingAnnualDays,
    availableAnnualDays,
    currentlyOnLeave: Boolean(currentLeave),
    currentLeaveType: currentLeave?.leave_type ?? null,
    currentLeaveEndDate: currentLeave?.end_date ?? null,
    currentResumeDate: currentLeave ? nextWorkingDate(currentLeave.end_date) : null,
  };
}

export function upcomingResumeDate(request: DriverLeaveRecord) {
  if (request.status !== "approved") return null;
  return nextWorkingDate(request.end_date);
}

function sumDays(requests: DriverLeaveRecord[]) {
  return requests.reduce((total, request) => total + (request.working_days ?? 0), 0);
}

function daysInYear(year: number) {
  return (year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)) ? 366 : 365;
}

function diffInCalendarDays(later: Date, earlier: Date) {
  const laterUtc = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const earlierUtc = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((laterUtc - earlierUtc) / 86400000);
}

function fromIsoDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function maxDate(a: Date, b: Date) {
  return a > b ? a : b;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
