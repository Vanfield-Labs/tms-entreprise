import { Outlet } from "react-router-dom";
import AppShell from "../app/AppShell";

export default function AdomTvLayout() {
  return (
    <AppShell
      title="Adom News"
      navItems={[
        { label: "Assignments", path: "/dashboard/adomtv/assignments" },
        { label: "New Booking", path: "/dashboard/adomtv/new-booking" },
        { label: "My Bookings", path: "/dashboard/adomtv/my-bookings" },
        { label: "Profile", path: "/dashboard/adomtv/profile" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
