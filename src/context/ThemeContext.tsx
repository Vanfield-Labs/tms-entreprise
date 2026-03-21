// src/context/ThemeContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // 1. Saved manual preference wins
    const saved = localStorage.getItem("tms-theme") as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
    // 2. Fall back to OS preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // Track whether the user has manually chosen a theme.
  // If they haven't, OS changes will override automatically.
  const [manualOverride, setManualOverride] = useState<boolean>(() => {
    const saved = localStorage.getItem("tms-theme");
    return saved === "light" || saved === "dark";
  });

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    // Only persist to localStorage when the user explicitly chose
    if (manualOverride) {
      localStorage.setItem("tms-theme", theme);
    }
  }, [theme, manualOverride]);

  // Listen for OS-level light/dark changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const handleOsChange = (e: MediaQueryListEvent) => {
      // Only follow OS if the user hasn't manually overridden
      if (!manualOverride) {
        setTheme(e.matches ? "dark" : "light");
      }
    };

    mq.addEventListener("change", handleOsChange);
    return () => mq.removeEventListener("change", handleOsChange);
  }, [manualOverride]);

  const toggleTheme = () => {
    setManualOverride(true);
    setTheme(t => {
      const next: Theme = t === "dark" ? "light" : "dark";
      localStorage.setItem("tms-theme", next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}