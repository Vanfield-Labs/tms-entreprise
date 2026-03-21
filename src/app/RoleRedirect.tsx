// src/app/RoleRedirect.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const CAMERA_UNIT_ID = "252e08c0-0999-4afe-9eff-a15365bd4d47";

const ROLE_HOME: Record<string, string> = {
  admin:                "/dashboard/admin",
  corporate_approver:   "/dashboard/corporate",
  transport_supervisor: "/dashboard/transport",
  driver:               "/dashboard/driver",
  unit_head:            "/dashboard/department",
  staff:                "/dashboard/department",
};

export default function RoleRedirect() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg]">
        <div className="w-8 h-8 border-2 border-[--text] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg] px-6">
        <div className="text-center space-y-3 max-w-sm w-full">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[--text]">Profile not found</h2>
          <p className="text-sm text-[--text-muted]">
            Your account hasn't been fully set up yet. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // Camera Department (unit_head AND staff) → dedicated camera layout
  if (profile.unit_id === CAMERA_UNIT_ID) {
    return <Navigate to="/dashboard/camera" replace />;
  }

  // Camera Department (both unit_head and staff) → dedicated camera layout
  if (profile.unit_id === CAMERA_UNIT_ID) {
    return <Navigate to="/dashboard/camera" replace />;
  }

  const home = ROLE_HOME[profile.system_role] ?? "/dashboard/department";
  return <Navigate to={home} replace />;
}