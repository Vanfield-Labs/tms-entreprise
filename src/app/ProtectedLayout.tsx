// src/app/ProtectedLayout.tsx
// Guards all dashboard routes. Also redirects to /2fa if:
// - user has TOTP enrolled (aal2 required)
// - current session is only aal1 (password only)
// - user's role is admin or corporate_approver

import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabase";

const MFA_REQUIRED_ROLES = ["admin", "corporate_approver"];
const CAMERA_UNIT_ID = "252e08c0-0999-4afe-9eff-a15365bd4d47";
const JOY_NEWS_UNIT_ID = "f34cb9c1-334a-4503-9e39-06980e6f4d74";
const ADOM_NEWS_UNIT_ID = "61ef9897-c284-43fe-a60d-7a22fa4e1a11";
const JOY_BUSINESS_UNIT_ID = "0dc91872-e758-4392-9ef5-34e6434188e1";

const ROLE_HOME: Record<string, string> = {
  admin: "/dashboard/admin",
  corporate_approver: "/dashboard/corporate",
  transport_supervisor: "/dashboard/transport",
  driver: "/dashboard/driver",
};

function getDepartmentHome(unitId: string | null): string {
  switch (unitId) {
    case CAMERA_UNIT_ID:
      return "/dashboard/camera";
    case JOY_NEWS_UNIT_ID:
      return "/dashboard/joynews";
    case ADOM_NEWS_UNIT_ID:
      return "/dashboard/adomtv";
    case JOY_BUSINESS_UNIT_ID:
      return "/dashboard/joybusiness";
    default:
      return "/dashboard/department";
  }
}

function getRoleHome(profile: { system_role: string; unit_id: string | null }) {
  return ROLE_HOME[profile.system_role] ?? getDepartmentHome(profile.unit_id);
}

export default function ProtectedLayout() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const [mfaChecked, setMfaChecked] = useState(false);
  const [needsMfa,   setNeedsMfa]   = useState(false);

  useEffect(() => {
    if (!user || !profile || loading) return;

    // Only check MFA for roles that require it
    if (!MFA_REQUIRED_ROLES.includes(profile.system_role)) {
      setMfaChecked(true);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        const currentLevel = data?.currentLevel;
        const nextLevel    = data?.nextLevel;

        // nextLevel === 'aal2' means user has MFA enrolled but hasn't verified it this session
        if (currentLevel === "aal1" && nextLevel === "aal2") {
          setNeedsMfa(true);
        }
      } catch {
        // Non-fatal — don't block access if MFA check fails
      }
      setMfaChecked(true);
    })();
  }, [user, profile, loading]);

  if (loading || (user && profile && MFA_REQUIRED_ROLES.includes(profile.system_role) && !mfaChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          <div className="text-xs uppercase tracking-widest font-mono" style={{ color: "var(--text-dim)" }}>
            Loading TMS…
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Redirect to 2FA challenge if needed
  if (needsMfa && location.pathname !== "/2fa") {
    return <Navigate to="/2fa" replace />;
  }

  if (profile) {
    const roleHome = getRoleHome(profile);
    const dashboardPaths = [
      "/dashboard/admin",
      "/dashboard/corporate",
      "/dashboard/transport",
      "/dashboard/driver",
      "/dashboard/department",
      "/dashboard/camera",
      "/dashboard/joynews",
      "/dashboard/adomtv",
      "/dashboard/joybusiness",
    ];

    if (dashboardPaths.includes(location.pathname) && location.pathname !== roleHome) {
      return <Navigate to={roleHome} replace />;
    }
  }

  return <Outlet />;
}
