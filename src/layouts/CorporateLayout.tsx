// src/layouts/CorporateLayout.tsx
import AppShell from "../app/AppShell";
import ApprovalQueue from "@/modules/approvals/pages/ApprovalQueue";
import FuelReviewQueue from "@/modules/fuel/pages/FuelReviewQueue";
import ReportsDashboard from "@/modules/reports/pages/ReportsDashboard";

export default function CorporateLayout() {
  return (
    <AppShell
      title="Corporate"
      navItems={[
        { label: "Booking Approvals", element: <ApprovalQueue /> },
        { label: "Fuel Approvals", element: <FuelReviewQueue /> },
        { label: "Reports", element: <ReportsDashboard /> },
      ]}
    />
  );
}