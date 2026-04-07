import { Outlet } from "react-router-dom";
import AppShell from "../app/AppShell";

export default function AdminLayout() {
  return (
    <AppShell
      title="Admin"
      navItems={[
        { label: "Reports", path: "/dashboard/admin/reports" },
        { label: "All Bookings", path: "/dashboard/admin/all-bookings" },
        { label: "Maintenance History", path: "/dashboard/admin/maintenance-history" },
        { label: "Fuel Mileage Log", path: "/dashboard/admin/fuel-mileage-log" },
        { label: "Leave", path: "/dashboard/admin/leave" },
        { label: "Vehicles", path: "/dashboard/admin/vehicles" },
        { label: "Drivers", path: "/dashboard/admin/drivers" },
        { label: "Users", path: "/dashboard/admin/users" },
        { label: "Divisions & Units", path: "/dashboard/admin/divisions-units" },
        { label: "Audit Logs", path: "/dashboard/admin/audit-logs" },
        { label: "Security Logs", path: "/dashboard/admin/security-logs" },
        { label: "Licence", path: "/dashboard/admin/licence" },
        { label: "Supplier Portal", path: "/dashboard/admin/supplier-portal" },
        { label: "Profile", path: "/dashboard/admin/profile" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
