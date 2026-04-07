import { supabase } from "@/lib/supabase";

export type SecurityEvent =
  | "login_success"
  | "login_failed"
  | "logout"
  | "session_expired"
  | "password_changed";

type SecurityEventInput = {
  event: SecurityEvent;
  userId?: string | null;
  email?: string | null;
};

type SecurityEventRow = {
  user_id: string | null;
  email: string | null;
  event: SecurityEvent;
  ip_address: string | null;
  user_agent: string | null;
};

const PENDING_SECURITY_EVENTS_KEY = "tms-pending-security-events";
const SIGN_OUT_REASON_KEY = "tms-signout-reason";

function readPendingEvents(): SecurityEventInput[] {
  try {
    const raw = localStorage.getItem(PENDING_SECURITY_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingEvents(events: SecurityEventInput[]) {
  try {
    if (events.length === 0) {
      localStorage.removeItem(PENDING_SECURITY_EVENTS_KEY);
      return;
    }
    localStorage.setItem(PENDING_SECURITY_EVENTS_KEY, JSON.stringify(events));
  } catch {}
}

function toRow(
  input: SecurityEventInput,
  currentUser?: { id?: string | null; email?: string | null } | null
): SecurityEventRow {
  return {
    user_id: input.userId ?? currentUser?.id ?? null,
    email: input.email ?? currentUser?.email ?? null,
    event: input.event,
    ip_address: null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };
}

async function persistSecurityEvent(
  input: SecurityEventInput,
  currentUser?: { id?: string | null; email?: string | null } | null
) {
  const row = toRow(input, currentUser);
  const userAgent = row.user_agent?.slice(0, 250) ?? null;

  try {
    const { error } = await supabase.rpc("record_login_event", {
      p_user_id: row.user_id,
      p_email: row.email,
      p_event: row.event,
      p_ip: row.ip_address,
      p_user_agent: userAgent,
    });

    if (!error) return true;
  } catch {}

  try {
    const { error } = await supabase.from("login_audit_log").insert(row);
    return !error;
  } catch {
    return false;
  }
}

export function queueSecurityEvent(input: SecurityEventInput) {
  const pending = readPendingEvents();
  pending.push(input);
  writePendingEvents(pending);
}

export async function logSecurityEvent(
  input: SecurityEventInput,
  currentUser?: { id?: string | null; email?: string | null } | null
) {
  const ok = await persistSecurityEvent(input, currentUser);
  if (!ok) {
    queueSecurityEvent(input);
  }
}

export async function flushPendingSecurityEvents(currentUser: {
  id?: string | null;
  email?: string | null;
}) {
  const pending = readPendingEvents();
  if (pending.length === 0) return;

  const remaining: SecurityEventInput[] = [];

  for (const event of pending) {
    const ok = await persistSecurityEvent(event, currentUser);
    if (!ok) remaining.push(event);
  }

  writePendingEvents(remaining);
}

export function markNextSignOutAsLogout() {
  markNextSignOutReason("logout");
}

export function markNextSignOutReason(event: "logout" | "session_expired") {
  try {
    localStorage.setItem(SIGN_OUT_REASON_KEY, event);
  } catch {}
}

export function consumePendingSignOutReason(): SecurityEvent | null {
  try {
    const raw = localStorage.getItem(SIGN_OUT_REASON_KEY);
    localStorage.removeItem(SIGN_OUT_REASON_KEY);
    return raw === "logout" || raw === "session_expired" ? raw : null;
  } catch {
    return null;
  }
}
