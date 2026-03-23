// src/main.tsx
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { LicenceProvider } from "@/context/LicenceContext";
import { ToastProvider } from "@/components/ErrorToast";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <LicenceProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </LicenceProvider>
    </ThemeProvider>
  </BrowserRouter>
);