// src/layouts/CorporateLayout.tsx
import AppShell from "../app/AppShell";
import ApprovalQueue from "@/modules/approvals/pages/ApprovalQueue";
import FuelReviewQueue from "@/modules/fuel/pages/FuelReviewQueue";
import FuelApprovalHistory from "@/modules/fuel/pages/FuelApprovalHistory";
import MaintenanceApprovalQueue from "@/modules/maintenance/pages/MaintenanceApprovalQueue";
import DriverLeaveDashboard from "@/modules/drivers/pages/DriverLeaveDashboard";
import ReportsDashboard from "@/modules/reports/pages/ReportsDashboard";
import ProfilePage from "@/pages/profile/ProfilePage";

export default function CorporateLayout() {
  return (
    <AppShell
      title="Corporate"
      navItems={[
  // ── Approvals ───────────────
  { label: "Booking Approvals", element: <ApprovalQueue /> },
  { label: "Fuel Approvals", element: <FuelReviewQueue /> },
  { label: "Maintenance Approvals", element: <MaintenanceApprovalQueue /> },
  { label: "Leave", element: <DriverLeaveDashboard /> },

  // ── Fuel ────────────────────
  { label: "Fuel History", element: <FuelApprovalHistory /> },

  // ── Insights ────────────────
  { label: "Reports", element: <ReportsDashboard /> },

  // ── Account ────────────────
  { label: "Profile", element: <ProfilePage /> },
]}
    />
  );
}
