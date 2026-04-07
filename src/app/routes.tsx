import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import ProtectedLayout from "./ProtectedLayout";
import RoleRedirect from "./RoleRedirect";
import Login from "../pages/auth/Login";
import TwoFactorChallenge from "@/pages/auth/TwoFactorChallenge";

import AdminLayout from "@/layouts/AdminLayout";
import CorporateLayout from "@/layouts/CorporateLayout";
import FinanceLayout from "@/layouts/FinanceLayout";
import TransportLayout from "@/layouts/TransportLayout";
import DriverLayout from "@/layouts/DriverLayout";
import DepartmentLayout from "@/layouts/DepartmentLayout";
import HrLayout from "@/layouts/HrLayout";
import CameraLayout from "@/layouts/CameraLayout";
import JoyNewsLayout from "@/layouts/JoyNewsLayout";
import AdomTvLayout from "@/layouts/AdomTvLayout";
import JoyBusinessLayout from "@/layouts/JoyBusinessLayout";
import DepartmentDashboardRoute from "@/layouts/DepartmentDashboardRoute";

import ReportsDashboard from "@/modules/reports/pages/ReportsDashboard";
import KPIDashboard from "@/modules/reports/pages/KPIDashboard";
import AuditLogs from "@/modules/reports/pages/AuditLogs";
import ApprovalQueue from "@/modules/approvals/pages/ApprovalQueue";
import BookingsTable from "@/modules/bookings/pages/BookingsTable";
import CreateBookingV2 from "@/modules/bookings/pages/CreateBookingV2";
import MyBookings from "@/modules/bookings/pages/MyBookings";
import CloseTrips from "@/modules/bookings/pages/CloseTrips";
import TripsWorkspace from "@/modules/dispatch/pages/TripsWorkspace";
import DriverTrips from "@/modules/trips/pages/DriverTrips";
import VehicleManagement from "@/modules/vehicles/pages/VehicleManagement";
import DriverManagement from "@/modules/drivers/pages/DriverManagement";
import DriverLeaveDashboard from "@/modules/drivers/pages/DriverLeaveDashboard";
import DriverLeavePage from "@/modules/drivers/pages/DriverLeavePage";
import DivisionManagement from "@/modules/divisions/pages/DivisionManagement";
import MaintenanceHistory from "@/modules/maintenance/pages/MaintenanceHistory";
import MaintenanceWorkspace from "@/modules/maintenance/pages/MaintenanceWorkspace";
import MaintenanceApprovalQueue from "@/modules/maintenance/pages/MaintenanceApprovalQueue";
import ReportMaintenance from "@/modules/maintenance/pages/ReportMaintenance";
import BookingFinanceQueue from "@/modules/finance/pages/BookingFinanceQueue";
import MaintenanceFinanceQueue from "@/modules/finance/pages/MaintenanceFinanceQueue";
import FuelMileageLog from "@/modules/fuel/pages/FuelMileageLog";
import FuelRecordQueue from "@/modules/fuel/pages/FuelRecordQueue";
import FuelReviewQueue from "@/modules/fuel/pages/FuelReviewQueue";
import FuelApprovalHistory from "@/modules/fuel/pages/FuelApprovalHistory";
import CreateFuelRequest from "@/modules/fuel/pages/CreateFuelRequest";
import MyFuelRequests from "@/modules/fuel/pages/MyFuelRequests";
import FuelRequests from "@/modules/fuel/pages/FuelRequests";
import IncidentBoard from "@/modules/incidents/pages/IncidentBoard";
import IncidentReportForm from "@/modules/incidents/pages/IncidentReportForm";
import MyIncidentReports from "@/modules/incidents/pages/MyIncidentReports";
import ScheduleManager from "@/modules/shifts/pages/ScheduleManager";
import ShiftAdmin from "@/modules/shifts/pages/ShiftAdmin";
import MyShifts from "@/modules/shifts/pages/MyShifts";
import MileageLog from "@/modules/fleet/pages/MileageLog";
import AllAssignmentsBoard from "@/modules/news/pages/AllAssignmentsBoard";
import NewsUnitDashboard from "@/modules/news/pages/NewsUnitDashboard";
import DriverAssignments from "@/modules/news/pages/DriverAssignments";
import CameraDashboard from "@/modules/camera/pages/CameraDashboard";
import NewUserRequest from "@/modules/users/pages/NewUserRequest";
import AdminUserManagement from "@/modules/users/pages/AdminUserManagement";
import ProfilePage from "@/pages/profile/ProfilePage";
import LicenceManagement from "@/pages/admin/LicenceManagement";
import SecurityLogs from "@/pages/admin/SecurityLogs";
import SupplierPortal from "@/pages/admin/SupplierPortal";
import { LicenceGate } from "@/components/LicenceGate";

const JOY_NEWS_ID = "f34cb9c1-334a-4503-9e39-06980e6f4d74";
const ADOM_NEWS_ID = "61ef9897-c284-43fe-a60d-7a22fa4e1a11";
const JOY_BUSINESS_ID = "0dc91872-e758-4392-9ef5-34e6434188e1";

export const routes: RouteObject[] = [
  { path: "/login", element: <Login /> },
  { path: "/2fa", element: <TwoFactorChallenge /> },
  {
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <RoleRedirect /> },
      {
        path: "/dashboard/admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="reports" replace /> },
          { path: "reports", element: <LicenceGate feature="reports"><ReportsDashboard /></LicenceGate> },
          { path: "all-bookings", element: <LicenceGate feature="bookings"><BookingsTable /></LicenceGate> },
          { path: "maintenance-history", element: <LicenceGate feature="maintenance"><MaintenanceHistory /></LicenceGate> },
          { path: "fuel-mileage-log", element: <LicenceGate feature="fuel"><FuelMileageLog /></LicenceGate> },
          { path: "leave", element: <LicenceGate feature="fleet"><DriverLeaveDashboard /></LicenceGate> },
          { path: "vehicles", element: <LicenceGate feature="fleet"><VehicleManagement /></LicenceGate> },
          { path: "drivers", element: <LicenceGate feature="fleet"><DriverManagement /></LicenceGate> },
          { path: "users", element: <LicenceGate feature="users"><AdminUserManagement /></LicenceGate> },
          { path: "divisions-units", element: <LicenceGate feature="divisions"><DivisionManagement /></LicenceGate> },
          { path: "audit-logs", element: <LicenceGate feature="audit"><AuditLogs /></LicenceGate> },
          { path: "security-logs", element: <SecurityLogs /> },
          { path: "licence", element: <LicenceManagement /> },
          { path: "supplier-portal", element: <SupplierPortal /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/dashboard/corporate",
        element: <CorporateLayout />,
        children: [
          { index: true, element: <Navigate to="booking-approvals" replace /> },
          { path: "booking-approvals", element: <ApprovalQueue /> },
          { path: "fuel-approvals", element: <FuelReviewQueue /> },
          { path: "maintenance-approvals", element: <MaintenanceApprovalQueue /> },
          { path: "leave", element: <DriverLeaveDashboard /> },
          { path: "fuel-history", element: <FuelApprovalHistory /> },
          { path: "reports", element: <ReportsDashboard /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/dashboard/finance",
        element: <FinanceLayout />,
        children: [
          { index: true, element: <Navigate to="finance-bookings" replace /> },
          { path: "finance-bookings", element: <BookingFinanceQueue /> },
          { path: "finance-maintenance", element: <MaintenanceFinanceQueue /> },
          { path: "reports", element: <ReportsDashboard /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/dashboard/transport",
        element: <TransportLayout />,
        children: [
          { index: true, element: <Navigate to="trips" replace /> },
          { path: "trips", element: <TripsWorkspace /> },
          { path: "assignments", element: <AllAssignmentsBoard /> },
          { path: "driver-schedule", element: <ScheduleManager /> },
          { path: "shift-overrides", element: <ShiftAdmin /> },
          { path: "maintenance", element: <MaintenanceWorkspace /> },
          { path: "incidents", element: <IncidentBoard /> },
          { path: "record-fuel", element: <FuelRecordQueue /> },
          {
            path: "fuel-request",
            element: (
              <div className="space-y-6">
                <CreateFuelRequest />
                <MyFuelRequests />
              </div>
            ),
          },
          { path: "vehicles", element: <VehicleManagement /> },
          { path: "mileage-log", element: <MileageLog /> },
          { path: "drivers", element: <DriverManagement /> },
          { path: "leave", element: <DriverLeaveDashboard /> },
          { path: "reports", element: <ReportsDashboard /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/dashboard/driver",
        element: <DriverLayout />,
        children: [
          { index: true, element: <Navigate to="my-trips" replace /> },
          { path: "my-trips", element: <DriverTrips /> },
          { path: "my-shifts", element: <MyShifts /> },
          { path: "assignments", element: <DriverAssignments /> },
          {
            path: "fuel-request",
            element: (
              <div className="space-y-6">
                <CreateFuelRequest />
                <MyFuelRequests />
              </div>
            ),
          },
          {
            path: "incidents",
            element: (
              <div className="space-y-6">
                <IncidentReportForm />
                <MyIncidentReports />
              </div>
            ),
          },
          { path: "leave", element: <DriverLeavePage /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/dashboard/hr",
        element: <HrLayout />,
        children: [
          { index: true, element: <Navigate to="leave" replace /> },
          { path: "leave", element: <DriverLeaveDashboard /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/dashboard/department",
        element: <DepartmentLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "dashboard", element: <DepartmentDashboardRoute /> },
          { path: "all-bookings", element: <BookingsTable /> },
          { path: "new-booking", element: <CreateBookingV2 /> },
          { path: "my-bookings", element: <MyBookings /> },
          {
            path: "fuel-request",
            element: (
              <div className="space-y-6">
                <CreateFuelRequest />
                <FuelRequests />
              </div>
            ),
          },
          { path: "report-maintenance", element: <ReportMaintenance /> },
          { path: "request-user", element: <NewUserRequest /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/dashboard/camera",
        element: <CameraLayout />,
        children: [
          { index: true, element: <Navigate to="camera-schedule" replace /> },
          { path: "camera-schedule", element: <CameraDashboard /> },
          { path: "new-booking", element: <CreateBookingV2 /> },
          { path: "my-bookings", element: <MyBookings /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/dashboard/joynews",
        element: <JoyNewsLayout />,
        children: [
          { index: true, element: <Navigate to="assignments" replace /> },
          { path: "assignments", element: <NewsUnitDashboard unitId={JOY_NEWS_ID} unitName="Joy News" /> },
          { path: "new-booking", element: <CreateBookingV2 /> },
          { path: "my-bookings", element: <MyBookings /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/dashboard/adomtv",
        element: <AdomTvLayout />,
        children: [
          { index: true, element: <Navigate to="assignments" replace /> },
          { path: "assignments", element: <NewsUnitDashboard unitId={ADOM_NEWS_ID} unitName="Adom News" /> },
          { path: "new-booking", element: <CreateBookingV2 /> },
          { path: "my-bookings", element: <MyBookings /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/dashboard/joybusiness",
        element: <JoyBusinessLayout />,
        children: [
          { index: true, element: <Navigate to="assignments" replace /> },
          { path: "assignments", element: <NewsUnitDashboard unitId={JOY_BUSINESS_ID} unitName="Joy Business" /> },
          { path: "new-booking", element: <CreateBookingV2 /> },
          { path: "my-bookings", element: <MyBookings /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      { path: "/reports", element: <ReportsDashboard /> },
      { path: "/reports/kpi", element: <KPIDashboard /> },
      { path: "/close-trips", element: <CloseTrips /> },
      { path: "*", element: <RoleRedirect /> },
    ],
  },
];
