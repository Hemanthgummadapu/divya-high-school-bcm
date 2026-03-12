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
        "navbar": "#0B2A59",
        "nav-highlight": "#60a5fa",
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
      boxShadow: {
        "navbar": "0 2px 12px rgba(0,0,0,0.15)",
        "navbar-sidebar": "2px 0 12px rgba(0,0,0,0.15)",
        "card": "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
        "card-soft": "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 12px rgba(11,42,89,0.08), 0 12px 32px rgba(0,0,0,0.06)",
      },
      backgroundImage: {
        "navbar-gradient": "linear-gradient(135deg, #0f2a5f 0%, #1e3a8a 100%)",
      },
    },
  },
  plugins: [],
};
export default config;

