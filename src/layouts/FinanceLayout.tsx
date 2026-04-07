import { Outlet } from "react-router-dom";
import AppShell from "@/app/AppShell";

export default function FinanceLayout() {
  return (
    <AppShell
      title="Finance"
      navItems={[
        { label: "Finance Bookings", path: "/dashboard/finance/finance-bookings" },
        { label: "Finance Maintenance", path: "/dashboard/finance/finance-maintenance" },
        { label: "Reports", path: "/dashboard/finance/reports" },
        { label: "Profile", path: "/dashboard/finance/profile" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
