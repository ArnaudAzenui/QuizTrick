import type { Config } from "tailwindcss";

/**
 * Theme colours are CSS variables defined in src/frontend/styles/globals.css
 * so the light/dark toggle (FR-8.x) only has to flip a data attribute.
 */
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--qt-bg) / <alpha-value>)",
        surface: "rgb(var(--qt-surface) / <alpha-value>)",
        border: "rgb(var(--qt-border) / <alpha-value>)",
        fg: "rgb(var(--qt-fg) / <alpha-value>)",
        muted: "rgb(var(--qt-muted) / <alpha-value>)",
        primary: "rgb(var(--qt-primary) / <alpha-value>)",
        "primary-fg": "rgb(var(--qt-primary-fg) / <alpha-value>)",
        success: "rgb(var(--qt-success) / <alpha-value>)",
        danger: "rgb(var(--qt-danger) / <alpha-value>)",
        warning: "rgb(var(--qt-warning) / <alpha-value>)",
      },
      borderRadius: { xl: "0.875rem" },
    },
  },
  plugins: [],
};

export default config;
