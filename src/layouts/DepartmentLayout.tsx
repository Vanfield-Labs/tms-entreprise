// src/layouts/DepartmentLayout.tsx
import AppShell from "../app/AppShell";
import CreateBookingV2 from "@/modules/bookings/pages/CreateBookingV2";
import BookingsTable from "@/modules/bookings/pages/BookingsTable";
import MyBookings from "../modules/bookings/pages/MyBookings";
import ReportMaintenance from "../modules/maintenance/pages/ReportMaintenance";
import NewUserRequest from "../modules/users/pages/NewUserRequest";
import CreateFuelRequest from "@/modules/fuel/pages/CreateFuelRequest";
import FuelRequests from "../modules/fuel/pages/FuelRequests";

export default function DepartmentLayout() {
  return (
    <AppShell
      title="Department"
      navItems={[
        { label: "New Booking", element: <CreateBookingV2 /> },
        { label: "My Bookings", element: <MyBookings /> },
        { label: "All Bookings", element: <BookingsTable /> },
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
        { label: "Request User", element: <NewUserRequest /> },
      ]}
    />
  );
}