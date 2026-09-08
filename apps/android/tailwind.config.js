/** NativeWind Tailwind config — same scale philosophy as apps/app's
 * design.md (4pt grid, one radius ladder). Colors come from the runtime
 * palette (src/theme), not from here. */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      borderRadius: {
        sm: "8px",
        md: "10px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      fontFamily: {
        "sans-regular": ["Inter-Regular"],
        "sans-bold": ["Inter-Bold"],
      },
    },
  },
  plugins: [],
};
