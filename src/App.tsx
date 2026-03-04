// src/App.tsx
import { useRoutes } from "react-router-dom";
import { routes } from "@/app/routes";

function Routes() {
  return useRoutes(routes);
}

export default function App() {
  return <Routes />;
}