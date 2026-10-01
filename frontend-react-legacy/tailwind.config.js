/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15,23,42,0.05)",
        "card-lg": "0 20px 25px -5px rgba(15,23,42,0.12), 0 8px 10px -6px rgba(15,23,42,0.06)",
      },
      backgroundImage: {
        "hero-grid":
          "linear-gradient(to right, rgba(203,213,225,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(203,213,225,0.4) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
