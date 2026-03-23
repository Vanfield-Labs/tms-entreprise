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

  return <Outlet />;
}