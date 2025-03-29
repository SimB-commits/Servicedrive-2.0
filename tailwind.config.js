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
              foreground: "#fff",
              DEFAULT: "#8a97b0"
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
              DEFAULT: "#3b82f6"
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
              DEFAULT: "#8b5cf6"
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
              DEFAULT: "#22c55e"
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
              DEFAULT: "#fbbf24"
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
              DEFAULT: "#ef4444"
            },
            background: "#121620",
            foreground: "#f1f5f9",
            content1: {
              DEFAULT: "#1a1f2e",
              foreground: "#f1f5f9"
            },
            content2: {
              DEFAULT: "#252b3b",
              foreground: "#f1f5f9"
            },
            content3: {
              DEFAULT: "#2e364a",
              foreground: "#f1f5f9"
            },
            content4: {
              DEFAULT: "#384157",
              foreground: "#f1f5f9"
            },
            focus: "#3b82f6",
            overlay: "rgba(0, 0, 0, 0.8)"
          }
        }
      }
    }),
  ],
};