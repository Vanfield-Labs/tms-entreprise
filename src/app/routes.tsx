// src/app/routes.tsx
import type { RouteObject } from "react-router-dom";
import ProtectedLayout   from "./ProtectedLayout";
import RoleRedirect      from "./RoleRedirect";
import Login             from "../pages/auth/Login";
import TwoFactorChallenge from "@/pages/auth/TwoFactorChallenge";

// Role layouts
import AdminLayout       from "@/layouts/AdminLayout";
import CorporateLayout   from "@/layouts/CorporateLayout";
import TransportLayout   from "@/layouts/TransportLayout";
import DriverLayout      from "@/layouts/DriverLayout";
import DepartmentLayout  from "@/layouts/DepartmentLayout";

// Unit/department layouts
import CameraLayout      from "@/layouts/CameraLayout";
import JoyNewsLayout     from "@/layouts/JoyNewsLayout";
import AdomTvLayout      from "@/layouts/AdomTvLayout";
import JoyBusinessLayout from "@/layouts/JoyBusinessLayout";

export const routes: RouteObject[] = [
  // Public routes (no auth required)
  { path: "/login", element: <Login /> },
  { path: "/2fa",   element: <TwoFactorChallenge /> },

  // Protected — everything below requires auth
  {
    element: <ProtectedLayout />,
    children: [
      { path: "/",                      element: <RoleRedirect /> },

      // Core role dashboards
      { path: "/dashboard/admin",       element: <AdminLayout /> },
      { path: "/dashboard/corporate",   element: <CorporateLayout /> },
      { path: "/dashboard/transport",   element: <TransportLayout /> },
      { path: "/dashboard/driver",      element: <DriverLayout /> },
      { path: "/dashboard/department",  element: <DepartmentLayout /> },

      // Unit-specific dashboards
      { path: "/dashboard/camera",      element: <CameraLayout /> },
      { path: "/dashboard/joynews",     element: <JoyNewsLayout /> },
      { path: "/dashboard/adomtv",      element: <AdomTvLayout /> },
      { path: "/dashboard/joybusiness", element: <JoyBusinessLayout /> },

      // Catch-all → role redirect
      { path: "*", element: <RoleRedirect /> },
    ],
  },
];