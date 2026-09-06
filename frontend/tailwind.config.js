/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        plum: {
          DEFAULT: "#5C3243",
          hover: "#4A2735",
          light: "#F5EFF0",
          wine: "#3D1C28",
          brand: "#6B3A4B",
        },
        gold: {
          DEFAULT: "#D4A373",
          light: "#F8F1E9",
          soft: "#E9D8A6",
        },
        accent: "#B56576",
        cream: "rgb(var(--c-cream) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          secondary: "rgb(var(--c-ink-secondary) / <alpha-value>)",
          muted: "rgb(var(--c-ink-muted) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--c-line) / <alpha-value>)",
          subtle: "rgb(var(--c-line-subtle) / <alpha-value>)",
        },
        ok: "#2D6A4F",
        warn: "#E07A5F",
        err: "#9E2A2B",
        admin: {
          sidebar: "#1E181C",
          bg: "#F4F1EA",
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "Playfair Display", "serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      maxWidth: {
        "8xl": "88rem",
      },
      letterSpacing: {
        widest2: "0.25em",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both",
        fadeIn: "fadeIn 0.5s ease both",
        slideIn: "slideIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
