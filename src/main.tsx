// src/main.tsx
// NOTE: StrictMode intentionally removed.
// React StrictMode double-mounts components in development, which causes
// Supabase's internal auth lock (navigator.locks) to be acquired twice
// simultaneously. The second instance steals the lock after 5s, breaking
// the first with "AbortError: Lock broken by another request with the
// 'steal' option". This is a known incompatibility between Supabase gotrue-js
// and React StrictMode. In production StrictMode has no effect anyway.
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "@/components/ErrorToast";
import { LicenceProvider } from "@/context/LicenceContext";
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