import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Pictogram brand — one flat blue, no gradient. `from`/`to` are kept
        // as the same value (rather than removed) because ~140 existing
        // class names across the app reference text-brand-from,
        // border-brand-from, ring-brand-from and bg-brand-from directly;
        // this is the one-line way to re-skin all of them at once.
        brand: {
          from: "#1E4FD1",
          to: "#1E4FD1",
        },
        surface: {
          light: "#FFFFFF",
          lightMuted: "#F7F9FC",
          dark: "#131826",
          darkMuted: "#0B0F19",
        },
        ink: {
          light: "#12172B",
          dark: "#F5F7FF",
          muted: "#8A93A6",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      backgroundImage: {
        // Kept as the same "bg-brand-gradient" utility (used in ~90 places)
        // so nothing needs to change at the call sites, but both stops are
        // now the same color, so it renders as flat #1E4FD1 everywhere.
        "brand-gradient": "linear-gradient(135deg, #1E4FD1 0%, #1E4FD1 100%)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
