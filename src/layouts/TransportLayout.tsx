import { Outlet } from "react-router-dom";
import AppShell from "../app/AppShell";

export default function TransportLayout() {
  return (
    <AppShell
      title="Transport"
      navItems={[
        { label: "Trips", path: "/dashboard/transport/trips" },
        { label: "Assignments", path: "/dashboard/transport/assignments" },
        { label: "Driver Schedule", path: "/dashboard/transport/driver-schedule" },
        { label: "Shift Overrides", path: "/dashboard/transport/shift-overrides" },
        { label: "Maintenance", path: "/dashboard/transport/maintenance" },
        { label: "Incidents", path: "/dashboard/transport/incidents" },
        { label: "Record Fuel", path: "/dashboard/transport/record-fuel" },
        { label: "Fuel Request", path: "/dashboard/transport/fuel-request" },
        { label: "Vehicles", path: "/dashboard/transport/vehicles" },
        { label: "Mileage Log", path: "/dashboard/transport/mileage-log" },
        { label: "Drivers", path: "/dashboard/transport/drivers" },
        { label: "Leave", path: "/dashboard/transport/leave" },
        { label: "Reports", path: "/dashboard/transport/reports" },
        { label: "Profile", path: "/dashboard/transport/profile" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
