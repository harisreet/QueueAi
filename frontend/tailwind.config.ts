import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          300: "#93c5fd",
          400: "#59a3ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        accent: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        danger: {
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
        },
        warn: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
        },
        surface: {
          900: "#0a0f1e",
          800: "#0d1530",
          700: "#111827",
          600: "#1a2540",
          500: "#1e2d4a",
          400: "#243455",
        },
      },
    },
  },
  plugins: [],
};

export default config;
