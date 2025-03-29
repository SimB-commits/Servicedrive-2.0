const { heroui } = require("@heroui/theme");

module.exports = {
  content: [
    './layouts/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        'sm': '0.25rem',
        DEFAULT: '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
      },
      boxShadow: {
        'soft': '0 2px 10px rgba(0, 0, 0, 0.05)',
        'medium': '0 4px 12px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [
    heroui({
      prefix: "heroui",
      addCommonColors: false,
      defaultTheme: "light",
      defaultExtendTheme: "light",
      layout: {
        disabledOpacity: "0.6",
      },
      themes: {
        light: {
          colors: {
            default: {
              50: "#f8f9fb",
              100: "#ebeef3",
              200: "#d7dce6",
              300: "#b4bdce",
              400: "#8a97b0",
              500: "#6b7994",
              600: "#556178",
              700: "#444d60",
              800: "#343c4d",
              900: "#1e232e",
              foreground: "#1e232e",
              DEFAULT: "#6b7994"
            },
            primary: {
              50: "#edf6ff",
              100: "#dbeeff",
              200: "#bfdcff",
              300: "#93c4fd",
              400: "#61a1fb",
              500: "#4284f5",
              600: "#2563eb",
              700: "#1d4ed8",
              800: "#1e40af",
              900: "#1e3a8a",
              foreground: "#fff",
              DEFAULT: "#2563eb"
            },
            secondary: {
              50: "#f5f3ff",
              100: "#ede9fe",
              200: "#ddd6fe",
              300: "#c4b5fd",
              400: "#a78bfa",
              500: "#8b5cf6",
              600: "#7c3aed",
              700: "#6d28d9",
              800: "#5b21b6",
              900: "#4c1d95",
              foreground: "#fff",
              DEFAULT: "#7c3aed"
            },
            success: {
              50: "#f0fdf4",
              100: "#dcfce7",
              200: "#bbf7d0",
              300: "#86efac",
              400: "#4ade80",
              500: "#22c55e",
              600: "#16a34a",
              700: "#15803d",
              800: "#166534",
              900: "#14532d",
              foreground: "#fff",
              DEFAULT: "#16a34a"
            },
            warning: {
              50: "#fffbeb",
              100: "#fef3c7",
              200: "#fde68a",
              300: "#fcd34d",
              400: "#fbbf24",
              500: "#f59e0b",
              600: "#d97706",
              700: "#b45309",
              800: "#92400e",
              900: "#78350f",
              foreground: "#000",
              DEFAULT: "#f59e0b"
            },
            danger: {
              50: "#fef2f2",
              100: "#fee2e2",
              200: "#fecaca",
              300: "#fca5a5",
              400: "#f87171",
              500: "#ef4444",
              600: "#dc2626",
              700: "#b91c1c",
              800: "#991b1b",
              900: "#7f1d1d",
              foreground: "#fff",
              DEFAULT: "#dc2626"
            },
            background: "#ffffff",
            foreground: "#1e232e",
            content1: {
              DEFAULT: "#f7f9fc",
              foreground: "#1e232e"
            },
            content2: {
              DEFAULT: "#f1f5f9",
              foreground: "#1e232e"
            },
            content3: {
              DEFAULT: "#e2e8f0",
              foreground: "#1e232e"
            },
            content4: {
              DEFAULT: "#cbd5e1",
              foreground: "#1e232e"
            },
            focus: "#3b82f6",
            overlay: "rgba(0, 0, 0, 0.4)"
          }
        },
        dark: {
          colors: {
            default: {
              50: "#202636", // Mörkare variant för bättre kontrast mot bakgrund
              100: "#2b3243", // Lite ljusare för att synas bättre
              200: "#374155", // Förbättrad kontrast
              300: "#475569", // Förbättrad synlighet
              400: "#64748b", // Lite ljusare för bättre synlighet
              500: "#94a3b8", // Förbättrad kontrast mot mörk bakgrund
              600: "#cbd5e1", // Ljusare för bättre synlighet
              700: "#e2e8f0",
              800: "#f1f5f9",
              900: "#f8fafc",
              foreground: "#fff",
              DEFAULT: "#94a3b8"  // Ljusare default för bättre synlighet
            },
            primary: {
              50: "#1e3a8a", // Mörkare nyanser i dark mode
              100: "#1e40af",
              200: "#1d4ed8",
              300: "#2563eb",
              400: "#3b82f6", // Mer vibrant för bättre synlighet
              500: "#60a5fa", // Ljusare nyans för bättre kontrast
              600: "#93c5fd",
              700: "#bfdbfe",
              800: "#dbeafe",
              900: "#eff6ff",
              foreground: "#fff",
              DEFAULT: "#3b82f6" // Mer vibrant färg för bättre synlighet
            },
            secondary: {
              50: "#4c1d95",
              100: "#5b21b6",
              200: "#6d28d9",
              300: "#7c3aed",
              400: "#8b5cf6",
              500: "#a78bfa", // Ljusare för bättre synlighet
              600: "#c4b5fd",
              700: "#ddd6fe",
              800: "#ede9fe",
              900: "#f5f3ff",
              foreground: "#fff",
              DEFAULT: "#a78bfa" // Ljusare för bättre synlighet
            },
            success: {
              50: "#14532d",
              100: "#166534",
              200: "#15803d",
              300: "#16a34a",
              400: "#22c55e",
              500: "#4ade80", // Ljusare för bättre synlighet
              600: "#86efac",
              700: "#bbf7d0",
              800: "#dcfce7",
              900: "#f0fdf4",
              foreground: "#000", // Svart text på ljusgrönt för bättre kontrast
              DEFAULT: "#4ade80" // Ljusare för bättre synlighet
            },
            warning: {
              50: "#78350f",
              100: "#92400e",
              200: "#b45309",
              300: "#d97706",
              400: "#f59e0b",
              500: "#fbbf24", // Ljusare för bättre synlighet
              600: "#fcd34d",
              700: "#fde68a",
              800: "#fef3c7",
              900: "#fffbeb",
              foreground: "#000", // Svart text på ljusgult för bättre kontrast
              DEFAULT: "#fbbf24" // Ljusare för bättre synlighet
            },
            danger: {
              50: "#7f1d1d",
              100: "#991b1b",
              200: "#b91c1c",
              300: "#dc2626",
              400: "#ef4444",
              500: "#f87171", // Ljusare för bättre synlighet
              600: "#fca5a5",
              700: "#fecaca",
              800: "#fee2e2",
              900: "#fef2f2",
              foreground: "#000", // Svart text på ljusrött för bättre kontrast
              DEFAULT: "#f87171" // Ljusare för bättre synlighet
            },
            background: "#0f1219", // Lite mörkare för bättre kontrast mot innehållselement
            foreground: "#f8fafc", // Ljusare text för bättre läsbarhet
            content1: {
              DEFAULT: "#1a202c", // Förbättrad kontrast mot bakgrund
              foreground: "#f8fafc" // Ljusare text
            },
            content2: {
              DEFAULT: "#252d3e", // Mer färgmättad för bättre visuell hierarki
              foreground: "#f8fafc" // Ljusare text
            },
            content3: {
              DEFAULT: "#2d3748", // Mer färgmättad för bättre visuell separation
              foreground: "#f8fafc" // Ljusare text
            },
            content4: {
              DEFAULT: "#3d4b63", // Tydligare separation från content3
              foreground: "#f8fafc" // Ljusare text
            },
            focus: "#60a5fa", // Ljusare blå för bättre synlighet
            overlay: "rgba(0, 0, 0, 0.75)" // Lite mer ogenomskinlig
          }
        }
      }
    }),
  ],
};