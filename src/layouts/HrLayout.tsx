import { Outlet } from "react-router-dom";
import AppShell from "../app/AppShell";

export default function HrLayout() {
  return (
    <AppShell
      title="HR"
      navItems={[
        { label: "Leave", path: "/dashboard/hr/leave" },
        { label: "Profile", path: "/dashboard/hr/profile" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
