import type { Config } from "tailwindcss";

// Identité issue de la maquette « Campus numérique 2IAE » (Claude Design) :
// blanc, encre, orange 2IAE ; Archivo très gras pour les titres, IBM Plex
// Mono pour les étiquettes. La salle live passe en mode nuit (« nuit-* »).
export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        encre: "#141414",
        orange: {
          DEFAULT: "#E4793A",
          fonce: "#C85F22",
          profond: "#A34C17",
          clair: "#FFF1E6",
          pale: "#FFF3EA",
          peche: "#FFD2B3",
        },
        creme: "#FBF6F2",
        ligne: "#EADFD5",
        "ligne-douce": "#EFE7E0",
        "ligne-forte": "#E6DCD3",
        texte: {
          DEFAULT: "#141414",
          doux: "#4A423C",
          moyen: "#5E554F",
          pale: "#6B625B",
          gris: "#8A7F76",
        },
        direct: "#FF5A36",
        succes: "#1F8A5B",
        "succes-clair": "#E7F5EE",
        alerte: "#B7791F",
        "alerte-clair": "#FDF3E1",
        danger: "#C2410C",
        "danger-clair": "#FDECE6",
        nuit: {
          DEFAULT: "#0F0E0D",
          panneau: "#181615",
          carte: "#1E1C1A",
          bulle: "#221F1D",
          ligne: "#2A2624",
          bord: "#3A3431",
          texte: "#EDE6E0",
          doux: "#CFC6BE",
          gris: "#A89E95",
        },
      },
      fontFamily: {
        sans: ["'Archivo Variable'", "Archivo", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "24px",
        "4xl": "28px",
      },
      letterSpacing: {
        serre: "-0.03em",
        "tres-serre": "-0.035em",
      },
      keyframes: {
        pulse2: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
        monte: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        apparait: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        direct: "pulse2 1.4s infinite",
        monte: "monte .35s ease-out both",
        apparait: "apparait .25s ease-out both",
      },
      boxShadow: {
        carte: "0 1px 2px rgba(20,20,20,.04), 0 8px 24px -12px rgba(20,20,20,.12)",
        telephone: "0 30px 60px -20px rgba(20,20,20,.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
