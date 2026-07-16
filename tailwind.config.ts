import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Pictogram brand — same gradient family as the logo mark
        brand: {
          from: "#2547F4", // deep indigo-blue
          to: "#17C3EC",   // cyan
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
        "brand-gradient": "linear-gradient(135deg, #2547F4 0%, #17C3EC 100%)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
