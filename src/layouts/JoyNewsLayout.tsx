import { Outlet } from "react-router-dom";
import AppShell from "../app/AppShell";

export default function JoyNewsLayout() {
  return (
    <AppShell
      title="Joy News"
      navItems={[
        { label: "Assignments", path: "/dashboard/joynews/assignments" },
        { label: "New Booking", path: "/dashboard/joynews/new-booking" },
        { label: "My Bookings", path: "/dashboard/joynews/my-bookings" },
        { label: "Profile", path: "/dashboard/joynews/profile" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
