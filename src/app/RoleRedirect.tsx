// src/app/RoleRedirect.tsx
// Routes users to their correct dashboard.
// For unit_head and staff, checks unit_id to send Camera/News users
// to their specific dashboards instead of generic /dashboard/department.

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// Unit UUIDs
const CAMERA_UNIT_ID       = "252e08c0-0999-4afe-9eff-a15365bd4d47";
const JOY_NEWS_UNIT_ID     = "f34cb9c1-334a-4503-9e39-06980e6f4d74";
const ADOM_NEWS_UNIT_ID    = "61ef9897-c284-43fe-a60d-7a22fa4e1a11";
const JOY_BUSINESS_UNIT_ID = "0dc91872-e758-4392-9ef5-34e6434188e1";

const ROLE_HOME: Record<string, string> = {
  admin:                "/dashboard/admin",
  corporate_approver:   "/dashboard/corporate",
  transport_supervisor: "/dashboard/transport",
  driver:               "/dashboard/driver",
};

function getDepartmentHome(unitId: string | null): string {
  switch (unitId) {
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--border-bright)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-3 max-w-sm w-full">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "var(--red-dim)" }}>
            <svg className="w-6 h-6" style={{ color: "var(--red)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Profile not found</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Your account hasn't been fully set up yet. Please contact your administrator.
          </p>
          <button
            onClick={async () => {
              const { supabase } = await import("@/lib/supabase");
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="btn btn-ghost"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Roles with a fixed dashboard regardless of unit
  if (ROLE_HOME[profile.system_role]) {
    return <Navigate to={ROLE_HOME[profile.system_role]} replace />;
  }

  // unit_head and staff: route based on their unit
  return <Navigate to={getDepartmentHome(profile.unit_id)} replace />;
}