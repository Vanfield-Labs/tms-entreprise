// src/layouts/AdminLayout.tsx
import AppShell from "../app/AppShell";
import ReportsDashboard from "@/modules/reports/pages/ReportsDashboard";
import AuditLogs from "../modules/reports/pages/AuditLogs";
import BookingsTable from "@/modules/bookings/pages/BookingsTable";
import VehicleManagement from "@/modules/vehicles/pages/VehicleManagement";
import DriverManagement from "@/modules/drivers/pages/DriverManagement";
import DriverLeaveDashboard from "@/modules/drivers/pages/DriverLeaveDashboard";
import DivisionManagement from "@/modules/divisions/pages/DivisionManagement";
import MaintenanceHistory from "@/modules/maintenance/pages/MaintenanceHistory";
import AdminUserManagement from "@/modules/users/pages/AdminUserManagement";
import FuelMileageLog from "@/modules/fuel/pages/FuelMileageLog";
import LicenceManagement from "@/pages/admin/LicenceManagement";
import SecurityLogs from "@/pages/admin/SecurityLogs";
import SupplierPortal from "@/pages/admin/SupplierPortal";
import ProfilePage from "@/pages/profile/ProfilePage";
import { LicenceGate } from "@/components/LicenceGate";

export default function AdminLayout() {
  return (
    <AppShell
      title="Admin"
      navItems={[
  // ── Overview ─────────────────
  { label: "Reports", element: <LicenceGate feature="reports"><ReportsDashboard /></LicenceGate> },

  // ── Operations ───────────────
  { label: "All Bookings", element: <LicenceGate feature="bookings"><BookingsTable /></LicenceGate> },
  { label: "Maintenance History", element: <LicenceGate feature="maintenance"><MaintenanceHistory /></LicenceGate> },
  { label: "Fuel Mileage Log", element: <LicenceGate feature="fuel"><FuelMileageLog /></LicenceGate> },
  { label: "Leave", element: <LicenceGate feature="fleet"><DriverLeaveDashboard /></LicenceGate> },

  // ── Fleet ────────────────────
  { label: "Vehicles", element: <LicenceGate feature="fleet"><VehicleManagement /></LicenceGate> },
  { label: "Drivers", element: <LicenceGate feature="fleet"><DriverManagement /></LicenceGate> },

  // ── Organization ─────────────
  { label: "Users", element: <LicenceGate feature="users"><AdminUserManagement /></LicenceGate> },
  { label: "Divisions & Units", element: <LicenceGate feature="divisions"><DivisionManagement /></LicenceGate> },

  // ── System ───────────────────
  { label: "Audit Logs", element: <LicenceGate feature="audit"><AuditLogs /></LicenceGate> },
  { label: "Security Logs", element: <SecurityLogs /> },
  { label: "Licence", element: <LicenceManagement /> },

  // ── External ─────────────────
  { label: "Supplier Portal", element: <SupplierPortal /> },

  // ── Account ──────────────────
  { label: "Profile", element: <ProfilePage /> },
]}
    />
  );
}
