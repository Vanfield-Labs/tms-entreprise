// src/app/RoleRedirect.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { markNextSignOutAsLogout } from "@/services/securityLog.service";

const CAMERA_UNIT_ID       = "252e08c0-0999-4afe-9eff-a15365bd4d47";
const JOY_NEWS_UNIT_ID     = "f34cb9c1-334a-4503-9e39-06980e6f4d74";
const ADOM_NEWS_UNIT_ID    = "61ef9897-c284-43fe-a60d-7a22fa4e1a11";
const JOY_BUSINESS_UNIT_ID = "0dc91872-e758-4392-9ef5-34e6434188e1";
const HR_UNIT_ID           = "f14262ab-7490-4958-94a9-dea5b11bf0c5";

const ROLE_HOME: Record<string, string> = {
  admin:                "/dashboard/admin",
  corporate_approver:   "/dashboard/corporate",
  finance_manager:      "/dashboard/finance",
  transport_supervisor: "/dashboard/transport",
  driver:               "/dashboard/driver",
};

function getDepartmentHome(unitId: string | null): string {
  switch (unitId) {
    case HR_UNIT_ID:           return "/dashboard/hr";
    case CAMERA_UNIT_ID:       return "/dashboard/camera";
    case JOY_NEWS_UNIT_ID:     return "/dashboard/joynews";
    case ADOM_NEWS_UNIT_ID:    return "/dashboard/adomtv";
    case JOY_BUSINESS_UNIT_ID: return "/dashboard/joybusiness";
    default:                   return "/dashboard/department";
  }
}

export default function RoleRedirect() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "0 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--red-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="var(--red)" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Profile not found</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
            Your account hasn't been fully set up. Please contact your administrator.
          </p>
          <button
            className="btn btn-ghost"
            onClick={async () => {
            markNextSignOutAsLogout();
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Roles with a fixed dashboard
  if (ROLE_HOME[profile.system_role]) {
    return <Navigate to={ROLE_HOME[profile.system_role]} replace />;
  }

  // unit_head and staff: route by unit_id
  return <Navigate to={getDepartmentHome(profile.unit_id)} replace />;
}
