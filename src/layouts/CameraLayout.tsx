import { Outlet } from "react-router-dom";
import AppShell from "../app/AppShell";

export default function CameraLayout() {
  return (
    <AppShell
      title="Camera Department"
      navItems={[
        { label: "Camera Schedule", path: "/dashboard/camera/camera-schedule" },
        { label: "New Booking", path: "/dashboard/camera/new-booking" },
        { label: "My Bookings", path: "/dashboard/camera/my-bookings" },
        { label: "Profile", path: "/dashboard/camera/profile" },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
