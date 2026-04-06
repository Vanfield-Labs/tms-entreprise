// src/app/routes.tsx
import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import ProtectedLayout from "./ProtectedLayout";
import RoleRedirect from "./RoleRedirect";
import Login from "../pages/auth/Login";
import TwoFactorChallenge from "@/pages/auth/TwoFactorChallenge";

// Role layouts
import AdminLayout from "@/layouts/AdminLayout";
import CorporateLayout from "@/layouts/CorporateLayout";
import FinanceLayout from "@/layouts/FinanceLayout";
import TransportLayout from "@/layouts/TransportLayout";
import DriverLayout from "@/layouts/DriverLayout";
import DepartmentLayout from "@/layouts/DepartmentLayout";
import HrLayout from "@/layouts/HrLayout";

// Unit/department layouts
import CameraLayout from "@/layouts/CameraLayout";
import JoyNewsLayout from "@/layouts/JoyNewsLayout";
import AdomTvLayout from "@/layouts/AdomTvLayout";
import JoyBusinessLayout from "@/layouts/JoyBusinessLayout";

// Reports pages
import ReportsDashboard from "@/modules/reports/pages/ReportsDashboard";
import KPIDashboard from "@/modules/reports/pages/KPIDashboard";
import ScheduleManager from "@/modules/shifts/pages/ScheduleManager";
import ShiftAdmin from "@/modules/shifts/pages/ShiftAdmin";
import IncidentBoard from "@/modules/incidents/pages/IncidentBoard";
import FuelRecordQueue from "@/modules/fuel/pages/FuelRecordQueue";
import CreateFuelRequest from "@/modules/fuel/pages/CreateFuelRequest";
import MyFuelRequests from "@/modules/fuel/pages/MyFuelRequests";
import VehicleManagement from "@/modules/vehicles/pages/VehicleManagement";
import DriverManagement from "@/modules/drivers/pages/DriverManagement";
import DriverLeaveDashboard from "@/modules/drivers/pages/DriverLeaveDashboard";
import MileageLog from "@/modules/fleet/pages/MileageLog";
import AllAssignmentsBoard from "@/modules/news/pages/AllAssignmentsBoard";
import ProfilePage from "@/pages/profile/ProfilePage";
import TripsWorkspace from "@/modules/dispatch/pages/TripsWorkspace";
import MaintenanceWorkspace from "@/modules/maintenance/pages/MaintenanceWorkspace";

export const routes: RouteObject[] = [
  { path: "/login", element: <Login /> },
  { path: "/2fa", element: <TwoFactorChallenge /> },

  {
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <RoleRedirect /> },

      { path: "/dashboard/admin", element: <AdminLayout /> },
      { path: "/dashboard/corporate", element: <CorporateLayout /> },
      { path: "/dashboard/finance", element: <FinanceLayout /> },
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
      { path: "/dashboard/driver", element: <DriverLayout /> },
      { path: "/dashboard/hr", element: <HrLayout /> },
      { path: "/dashboard/department", element: <DepartmentLayout /> },
      { path: "/dashboard/camera", element: <CameraLayout /> },
      { path: "/dashboard/joynews", element: <JoyNewsLayout /> },
      { path: "/dashboard/adomtv", element: <AdomTvLayout /> },
      { path: "/dashboard/joybusiness", element: <JoyBusinessLayout /> },

      { path: "/reports", element: <ReportsDashboard /> },
      { path: "/reports/kpi", element: <KPIDashboard /> },

      { path: "*", element: <RoleRedirect /> },
    ],
  },
];
