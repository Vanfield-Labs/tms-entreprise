// src/app/routes.tsx
import type { RouteObject } from "react-router-dom";
import ProtectedLayout from "./ProtectedLayout";
import RoleRedirect from "./RoleRedirect";
import Login from "../pages/auth/Login";

// Layouts
import AdminLayout from "@/layouts/AdminLayout";
import CorporateLayout from "@/layouts/CorporateLayout";
import TransportLayout from "@/layouts/TransportLayout";
import DriverLayout from "@/layouts/DriverLayout";
import DepartmentLayout from "@/layouts/DepartmentLayout";
import CameraLayout from "@/layouts/CameraLayout";

export const routes: RouteObject[] = [
  // Public
  { path: "/login", element: <Login /> },

  // Protected — everything inside requires auth
  {
    element: <ProtectedLayout />,
    children: [
      // Root → redirect based on role
      { path: "/", element: <RoleRedirect /> },

      // Role dashboards
      { path: "/dashboard/admin",      element: <AdminLayout /> },
      { path: "/dashboard/corporate",  element: <CorporateLayout /> },
      { path: "/dashboard/transport",  element: <TransportLayout /> },
      { path: "/dashboard/driver",     element: <DriverLayout /> },
      { path: "/dashboard/department", element: <DepartmentLayout /> },
      { path: "/dashboard/camera",     element: <CameraLayout /> },

      // Catch-all redirect
      { path: "*", element: <RoleRedirect /> },
    ],
  },
];