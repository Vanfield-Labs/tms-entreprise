import { Outlet } from "react-router-dom";
import AppShell from "../app/AppShell";

export default function JoyBusinessLayout() {
  return (
    <AppShell
      title="Joy Business"
      navItems={[
        { label: "Assignments", path: "/dashboard/joybusiness/assignments" },
        { label: "New Booking", path: "/dashboard/joybusiness/new-booking" },
        { label: "My Bookings", path: "/dashboard/joybusiness/my-bookings" },
        { label: "Profile", path: "/dashboard/joybusiness/profile" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
