import { Outlet } from "react-router-dom";
import AppShell from "../app/AppShell";

export default function DriverLayout() {
  return (
    <AppShell
      title="Driver"
      navItems={[
        { label: "My Trips", path: "/dashboard/driver/my-trips" },
        { label: "My Shifts", path: "/dashboard/driver/my-shifts" },
        { label: "Assignments", path: "/dashboard/driver/assignments" },
        { label: "Fuel Request", path: "/dashboard/driver/fuel-request" },
        { label: "Incidents", path: "/dashboard/driver/incidents" },
        { label: "Leave", path: "/dashboard/driver/leave" },
        { label: "Profile", path: "/dashboard/driver/profile" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
