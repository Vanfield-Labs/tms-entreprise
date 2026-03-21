// src/layouts/DepartmentLayout.tsx
// Routes unit_head → UnitHeadDashboard (first nav item)
// Routes staff → StaffDashboard (first nav item)
// Camera dept is handled by CameraLayout
import AppShell from "../app/AppShell";
import { useAuth } from "@/hooks/useAuth";
import UnitHeadDashboard from "@/modules/unithead/pages/UnitHeadDashboard";
import StaffDashboard from "@/modules/staff/pages/StaffDashboard";
import CreateBookingV2 from "@/modules/bookings/pages/CreateBookingV2";
import MyBookings from "@/modules/bookings/pages/MyBookings";
import BookingsTable from "@/modules/bookings/pages/BookingsTable";
import ReportMaintenance from "@/modules/maintenance/pages/ReportMaintenance";
import NewUserRequest from "@/modules/users/pages/NewUserRequest";
import CreateFuelRequest from "@/modules/fuel/pages/CreateFuelRequest";
import FuelRequests from "@/modules/fuel/pages/FuelRequests";
import ProfilePage from "@/pages/profile/ProfilePage";

export default function DepartmentLayout() {
  const { profile } = useAuth();
  const isUnitHead = profile?.system_role === "unit_head";

  // Shared pages for both roles
  const sharedPages = [
    { label: "New Booking",   element: <CreateBookingV2 /> },
    { label: "My Bookings",   element: <MyBookings /> },
    {
      label: "Fuel Request",
      element: (
        <div className="space-y-6">
          <CreateFuelRequest />
          <FuelRequests />
        </div>
      ),
    },
    { label: "Report Maintenance", element: <ReportMaintenance /> },
    { label: "Request User",  element: <NewUserRequest /> },
    { label: "Profile",       element: <ProfilePage /> },
  ];

  if (isUnitHead) {
    return (
      <AppShell
        title={profile?.position_title ?? "Unit Dashboard"}
        navItems={[
          { label: "Dashboard",    element: <UnitHeadDashboard /> },
          { label: "All Bookings", element: <BookingsTable /> },
          ...sharedPages,
        ]}
      />
    );
  }

  return (
    <AppShell
      title="My Dashboard"
      navItems={[
        { label: "Dashboard",  element: <StaffDashboard /> },
        ...sharedPages,
      ]}
    />
  );
}