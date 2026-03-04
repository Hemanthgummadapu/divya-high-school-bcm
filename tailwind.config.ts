import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      colors: {
        "primary-blue": "#1E3A8A",
        "accent-gold": "#F59E0B",
        "accent-gold-dark": "#d97706",
        "bg-page": "#F8FAFC",
        "card": "#FFFFFF",
        "heading": "#0F172A",
        "body": "#334155",
        "muted": "#64748B",
        "school-navy": "#1E3A8A",
        "school-navy-dark": "#1E3A8A",
        "school-gold": "#F59E0B",
        "school-gold-dark": "#d97706",
      },
    },
  },
  plugins: [],
};
export default config;

