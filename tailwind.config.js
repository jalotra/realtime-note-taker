/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#1c1917",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#1c1917",
        },
        primary: {
          DEFAULT: "#292524",
          foreground: "#fafaf9",
        },
        secondary: {
          DEFAULT: "#f5f5f4",
          foreground: "#292524",
        },
        muted: {
          DEFAULT: "#f5f5f4",
          foreground: "#78716c",
        },
        accent: {
          DEFAULT: "#f5f5f4",
          foreground: "#292524",
        },
        destructive: {
          DEFAULT: "#dc2626",
          foreground: "#fafaf9",
        },
        border: "#e7e5e4",
        input: "#e7e5e4",
        ring: "#a8a29e",
      },
      fontFamily: {
        sans: ["Figtree_400Regular"],
        "sans-medium": ["Figtree_500Medium"],
        "sans-semibold": ["Figtree_600SemiBold"],
        "sans-bold": ["Figtree_700Bold"],
      },
    },
  },
  plugins: [],
};
