import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        muted: "var(--muted)",
        // Marca: verde césped + dorado trofeo
        pitch: {
          50: "#ecfdf3",
          100: "#d1fadf",
          200: "#a6f4c5",
          300: "#6ce9a6",
          400: "#32d583",
          500: "#12b76a",
          600: "#039855",
          700: "#027a48",
          800: "#05603a",
          900: "#054f31",
          950: "#022c1d",
        },
        gold: {
          50: "#fffbea",
          100: "#fff3c4",
          200: "#fce588",
          300: "#fadb5f",
          400: "#f7c948",
          500: "#f0b429",
          600: "#de911d",
          700: "#cb6e17",
          800: "#b44d12",
          900: "#8d2b0b",
        },
        // Colores semánticos de estado del draft
        state: {
          available: "#12b76a", // jugador disponible
          picked: "#64748b", // jugador elegido
          active: "#f0b429", // turno activo
          paused: "#f97316", // draft pausado
          finished: "#6366f1", // draft finalizado
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      boxShadow: {
        "turn-glow": "0 0 0 2px rgba(240,180,41,0.6), 0 0 24px rgba(240,180,41,0.35)",
      },
      keyframes: {
        "pulse-turn": {
          "0%, 100%": { boxShadow: "0 0 0 2px rgba(240,180,41,0.6), 0 0 18px rgba(240,180,41,0.25)" },
          "50%": { boxShadow: "0 0 0 2px rgba(240,180,41,0.9), 0 0 28px rgba(240,180,41,0.5)" },
        },
      },
      animation: {
        "pulse-turn": "pulse-turn 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
