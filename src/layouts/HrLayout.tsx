import AppShell from "../app/AppShell";
import DriverLeaveDashboard from "@/modules/drivers/pages/DriverLeaveDashboard";
import ProfilePage from "@/pages/profile/ProfilePage";

export default function HrLayout() {
  return (
    <AppShell
      title="HR"
      navItems={[
        { label: "Leave", element: <DriverLeaveDashboard /> },
        { label: "Profile", element: <ProfilePage /> },
      ]}
    />
  );
}
