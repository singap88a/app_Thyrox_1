/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Syrux brand palette
        syrux: {
          bg:       "#0a0f1e",  // deep navy background
          card:     "#111827",  // card surfaces
          border:   "#1e2d4a",  // subtle borders
          accent:   "#00d4ff",  // teal/cyan primary
          muted:    "#6b7280",  // muted text
          dimmed:   "#374151",  // very dim text
          surface:  "#0d1520",  // input/inner surface
        },
        // Status colors
        danger:  "#ef4444",
        caution: "#facc15",
        success: "#4ade80",
        info:    "#38bdf8",
        violet:  "#a78bfa",
      },
      fontFamily: {
        sans: ["System"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
    },
  },
  plugins: [],
};