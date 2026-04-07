// src/main.tsx
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { LicenceProvider } from "@/context/LicenceContext";
import { ToastProvider } from "@/components/ErrorToast";
import { AuthProvider } from "@/hooks/useAuth";
import App from "./App";
import "./index.css";

import { StrictMode } from "react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <LicenceProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </LicenceProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
