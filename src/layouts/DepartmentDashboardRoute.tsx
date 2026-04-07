import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import UnitHeadDashboard from "@/modules/unithead/pages/UnitHeadDashboard";
import StaffDashboard from "@/modules/staff/pages/StaffDashboard";

export default function DepartmentDashboardRoute() {
  const { profile, loading } = useAuth();

  if (loading) return null;

  if (profile?.system_role === "unit_head") {
    return <UnitHeadDashboard />;
  }

  if (profile?.system_role === "staff") {
    return <StaffDashboard />;
  }

  return <Navigate to="/" replace />;
}
