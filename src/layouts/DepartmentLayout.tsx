import { Outlet } from "react-router-dom";
import AppShell from "../app/AppShell";
import { useAuth } from "@/hooks/useAuth";

export default function DepartmentLayout() {
  const { profile } = useAuth();
  const isUnitHead = profile?.system_role === "unit_head";

  const sharedPages = [
    { label: "New Booking", path: "/dashboard/department/new-booking" },
    { label: "My Bookings", path: "/dashboard/department/my-bookings" },
    { label: "Fuel Request", path: "/dashboard/department/fuel-request" },
    { label: "Report Maintenance", path: "/dashboard/department/report-maintenance" },
    { label: "Request User", path: "/dashboard/department/request-user" },
    { label: "Profile", path: "/dashboard/department/profile" },
  ];

  return (
    <AppShell
      title={isUnitHead ? profile?.position_title ?? "Unit Dashboard" : "My Dashboard"}
      navItems={
        isUnitHead
          ? [
              { label: "Dashboard", path: "/dashboard/department/dashboard" },
              { label: "All Bookings", path: "/dashboard/department/all-bookings" },
              ...sharedPages,
            ]
          : [
              { label: "Dashboard", path: "/dashboard/department/dashboard" },
              ...sharedPages,
            ]
      }
    >
      <Outlet />
    </AppShell>
  );
}
