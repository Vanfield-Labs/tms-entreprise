import AppShell from "@/app/AppShell";
import BookingFinanceQueue from "@/modules/finance/pages/BookingFinanceQueue";
import MaintenanceFinanceQueue from "@/modules/finance/pages/MaintenanceFinanceQueue";
import ReportsDashboard from "@/modules/reports/pages/ReportsDashboard";
import ProfilePage from "@/pages/profile/ProfilePage";

export default function FinanceLayout() {
  return (
    <AppShell
      title="Finance"
      navItems={[
        { label: "Finance Bookings", element: <BookingFinanceQueue /> },
        { label: "Finance Maintenance", element: <MaintenanceFinanceQueue /> },
        { label: "Reports", element: <ReportsDashboard /> },
        { label: "Profile", element: <ProfilePage /> },
      ]}
    />
  );
}
