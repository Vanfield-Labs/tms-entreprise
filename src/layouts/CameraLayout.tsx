// src/layouts/CameraLayout.tsx
// Layout for Camera Department unit head and technicians
import AppShell from "../app/AppShell";
import CameraDashboard from "@/modules/camera/pages/CameraDashboard";
import CreateBookingV2 from "@/modules/bookings/pages/CreateBookingV2";
import MyBookings from "@/modules/bookings/pages/MyBookings";
import ProfilePage from "@/pages/profile/ProfilePage";

export default function CameraLayout() {
  return (
    <AppShell
      title="Camera Department"
      navItems={[
        { label: "Camera Schedule",  element: <CameraDashboard /> },
        { label: "New Booking",      element: <CreateBookingV2 /> },
        { label: "My Bookings",      element: <MyBookings /> },
        { label: "Profile",          element: <ProfilePage /> },
      ]}
    />
  );
}