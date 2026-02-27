import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/layouts/AdminLayout";
import CorporateLayout from "@/layouts/CorporateLayout";
import TransportLayout from "@/layouts/TransportLayout";
import DepartmentLayout from "@/layouts/DepartmentLayout";
import DriverLayout from "@/layouts/DriverLayout";

export default function DashboardRouter() {
  const { profile, loading, user } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // Safety net: if still loading after 6s, redirect to login
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && !user) window.location.href = "/login";
  }, [loading, user]);

  if (timedOut && loading) {
    window.location.href = "/login";
    return null;
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0f1117", flexDirection: "column", gap: 16,
      }}>
        <div style={{
          width: 32, height: 32, border: "3px solid #2a3045",
          borderTopColor: "#3b82f6", borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7a99", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Loading TMS...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  if (!profile) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0f1117", flexDirection: "column", gap: 16,
      }}>
        <div style={{ fontSize: 14, color: "#ef4444", marginBottom: 8 }}>
          No profile found for your account.
        </div>
        <div style={{ fontSize: 12, color: "#6b7a99", maxWidth: 320, textAlign: "center" }}>
          Your account exists but has no profile yet. Ask your administrator to approve your access request.
        </div>
        <button
          onClick={() => { window.location.href = "/login"; }}
          style={{ marginTop: 8, padding: "8px 16px", background: "transparent", border: "1px solid #2a3045", borderRadius: 6, color: "#6b7a99", cursor: "pointer", fontSize: 13 }}
        >
          Sign Out
        </button>
      </div>
    );
  }

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
