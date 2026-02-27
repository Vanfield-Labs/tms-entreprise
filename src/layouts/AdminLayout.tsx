// src/layouts/AdminLayout.tsx
import AppShell from "../app/AppShell";
import ReportsDashboard from "@/modules/reports/pages/ReportsDashboard";
//import AdminUserRequests from "@/modules/users/pages/AdminUserRequests";
import AuditLogs from "../modules/reports/pages/AuditLogs";
import BookingsTable from "@/modules/bookings/pages/BookingsTable";
import VehicleManagement from "@/modules/vehicles/pages/VehicleManagement";
import DriverManagement from "@/modules/drivers/pages/DriverManagement";
import DivisionManagement from "@/modules/divisions/pages/DivisionManagement";

export default function AdminLayout() {
  return (
    <AppShell
      title="Admin"
      navItems={[
        { label: "Reports", element: <ReportsDashboard /> },
        { label: "All Bookings", element: <BookingsTable /> },
        { label: "Vehicles", element: <VehicleManagement /> },
        { label: "Drivers", element: <DriverManagement /> },
        { label: "Divisions & Units", element: <DivisionManagement /> },
       //{ label: "User Requests", element: <AdminUserRequests /> },
        { label: "Audit Logs", element: <AuditLogs /> },
      ]}
    />
  );
}