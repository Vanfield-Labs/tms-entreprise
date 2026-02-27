// src/App.tsx
import { BrowserRouter, useRoutes } from "react-router-dom";
import { routes } from "@/app/routes";

function Routes() {
  return useRoutes(routes);
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes />
    </BrowserRouter>
  );
}