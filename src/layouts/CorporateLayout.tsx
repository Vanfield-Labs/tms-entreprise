import { Outlet } from "react-router-dom";
import AppShell from "../app/AppShell";

export default function CorporateLayout() {
  return (
    <AppShell
      title="Corporate"
      navItems={[
        { label: "Booking Approvals", path: "/dashboard/corporate/booking-approvals" },
        { label: "Fuel Approvals", path: "/dashboard/corporate/fuel-approvals" },
        { label: "Maintenance Approvals", path: "/dashboard/corporate/maintenance-approvals" },
        { label: "Leave", path: "/dashboard/corporate/leave" },
        { label: "Fuel History", path: "/dashboard/corporate/fuel-history" },
        { label: "Reports", path: "/dashboard/corporate/reports" },
        { label: "Profile", path: "/dashboard/corporate/profile" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
