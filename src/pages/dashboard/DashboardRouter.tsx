// src/pages/dashboard/DashboardRouter.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout        from "@/layouts/AdminLayout";
import CorporateLayout    from "@/layouts/CorporateLayout";
import TransportLayout    from "@/layouts/TransportLayout";
import DepartmentLayout   from "@/layouts/DepartmentLayout";
import DriverLayout       from "@/layouts/DriverLayout";
import CameraLayout       from "@/layouts/CameraLayout";
import JoyNewsLayout      from "@/layouts/JoyNewsLayout";
import AdomTvLayout       from "@/layouts/AdomTvLayout";
import JoyBusinessLayout  from "@/layouts/JoyBusinessLayout";

// Unit IDs for specialist layouts
const CAMERA_UNIT_ID      = "252e08c0-0999-4afe-9eff-a15365bd4d47";
const JOY_NEWS_UNIT_ID    = "f34cb9c1-334a-4503-9e39-06980e6f4d74";
const ADOM_NEWS_UNIT_ID   = "61ef9897-c284-43fe-a60d-7a22fa4e1a11";
const JOY_BUSINESS_UNIT_ID = "0dc91872-e758-4392-9ef5-34e6434188e1";

const SLOW_THRESHOLD_MS  = 4000;  // show "slow" message after 4s
const TIMEOUT_MS         = 12000; // redirect to login after 12s

export default function DashboardRouter() {
  const { profile, loading, user } = useAuth();
  const [elapsed,  setElapsed]  = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  // Tick every second to show elapsed time feedback
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  // Hard timeout — redirect to login if stuck too long
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && !user) window.location.href = "/login";
  }, [loading, user]);

  if (timedOut && loading) {
    // Show a helpful stuck screen instead of just redirecting
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)", flexDirection: "column", gap: 16, padding: "0 24px", textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 4 }}>⏱️</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
          Taking longer than expected
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 300, lineHeight: 1.6 }}>
          The server is slow to respond. This may be a temporary issue.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { window.location.href = "/login"; }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    const isSlow = elapsed * 1000 >= SLOW_THRESHOLD_MS;
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)", flexDirection: "column", gap: 16,
      }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--text-dim)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}>
          {isSlow ? "Still loading…" : "Loading TMS…"}
        </div>
        {isSlow && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Slow connection detected
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!user) return null;

  if (!profile) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)", flexDirection: "column", gap: 16,
        padding: "0 24px", textAlign: "center",
      }}>
        <div style={{ fontSize: 14, color: "var(--status-error-fg)", marginBottom: 4 }}>
          No profile found for your account.
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", maxWidth: 320 }}>
          Your account exists but has no profile yet. Ask your administrator to approve your access request.
        </div>
        <button
          onClick={() => { window.location.href = "/login"; }}
          className="btn btn-ghost"
          style={{ marginTop: 8 }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  // ── Specialist unit routing ────────────────────────────────────────────────
  // Camera department — any role
  if (profile.unit_id === CAMERA_UNIT_ID) {
    return <CameraLayout />;
  }

  // News unit routing for unit_head and staff
  if (["unit_head", "staff"].includes(profile.system_role)) {
    if (profile.unit_id === JOY_NEWS_UNIT_ID)     return <JoyNewsLayout />;
    if (profile.unit_id === ADOM_NEWS_UNIT_ID)    return <AdomTvLayout />;
    if (profile.unit_id === JOY_BUSINESS_UNIT_ID) return <JoyBusinessLayout />;
  }

  // ── Standard role routing ─────────────────────────────────────────────────
  switch (profile.system_role) {
    case "admin":                return <AdminLayout />;
    case "corporate_approver":   return <CorporateLayout />;
    case "transport_supervisor": return <TransportLayout />;
    case "driver":               return <DriverLayout />;
    case "unit_head":
    case "staff":
    default:                     return <DepartmentLayout />;
  }
}