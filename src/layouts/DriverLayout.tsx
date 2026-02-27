// src/layouts/DriverLayout.tsx
import AppShell from "../app/AppShell";
import MyShifts from "../modules/shifts/pages/MyShifts";
import DriverTrips from "@/modules/trips/pages/DriverTrips";

export default function DriverLayout() {
  return (
    <AppShell
      title="Driver"
      navItems={[
        { label: "My Trips", element: <DriverTrips /> },
        { label: "My Shifts", element: <MyShifts /> },
      ]}
    />
  );
}