// src/app/routes.tsx
import type { RouteObject } from "react-router-dom";
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
      { path: "/dashboard/transport", element: <TransportLayout /> },
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
