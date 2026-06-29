import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#fffdf8",
          100: "#f7f0e4",
          200: "#efe2cb",
          300: "#dfd0b5",
          700: "#796652",
          900: "#2f2419",
        },
        teal: {
          500: "#0f766e",
          600: "#115e59",
        },
      },
      boxShadow: {
        float: "0 24px 60px rgba(91, 66, 38, 0.12)",
      },
      backgroundImage: {
        ambient:
          "radial-gradient(circle at top left, rgba(255,247,237,0.42), transparent 28%), linear-gradient(160deg, #f8f2e8 0%, #efe2cb 52%, #dfd0b5 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
