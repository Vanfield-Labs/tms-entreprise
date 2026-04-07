/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        tms: {
          bg: "var(--bg)",
          surface: "var(--surface)",
          "surface-2": "var(--surface-2)",
          border: "var(--border)",
          "border-bright": "var(--border-bright)",
          text: "var(--text)",
          muted: "var(--text-muted)",
          dim: "var(--text-dim)",
          accent: "var(--accent)",
          "accent-bright": "var(--accent-bright)",
          "accent-dim": "var(--accent-dim)",
          green: "var(--green)",
          "green-dim": "var(--green-dim)",
          amber: "var(--amber)",
          "amber-dim": "var(--amber-dim)",
          red: "var(--red)",
          "red-dim": "var(--red-dim)",
          purple: "var(--purple)",
          cyan: "var(--cyan)",
        },
      },
    },
  },
  plugins: [],
};