/**
 * NativeWind (Tailwind v3) config for the Android app.
 *
 * Two deliberate choices, both about fidelity (the device must render what the
 * browser check renders — see README):
 *
 *  - Colors are CSS variables resolved at runtime by the theme provider
 *    (src/theme/tokens.ts), so one class name works in both themes — the same
 *    vocabulary the web app uses.
 *  - The spacing, type and radius scales are px. NativeWind converts rem with a
 *    root size of 14 (react-native-css-interop runtime) while the browser
 *    resolves rem at 16, so any rem-based utility would render 12.5% smaller on
 *    the phone than in the browser — px makes every shell render identically.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        "success-soft": "var(--success-soft)",
        "success-line": "var(--success-line)",
        "warning-soft": "var(--warning-soft)",
        "warning-line": "var(--warning-line)",
        "destructive-soft": "var(--destructive-soft)",
        "muted-soft": "var(--muted-soft)",
        "muted-veil": "var(--muted-veil)",
        "border-soft": "var(--border-soft)",
        "primary-soft": "var(--primary-soft)",
        overlay: "var(--overlay)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        "qr-ink": "var(--qr-ink)",
        "capsule-surface": "var(--capsule-surface)",
      },
      // Tailwind's spacing ramp in px (0.25rem steps), so h-11 is exactly 44px.
      spacing: {
        0: "0px",
        px: "1px",
        0.5: "2px",
        1: "4px",
        1.5: "6px",
        2: "8px",
        2.5: "10px",
        3: "12px",
        3.5: "14px",
        4: "16px",
        5: "20px",
        6: "24px",
        7: "28px",
        8: "32px",
        9: "36px",
        10: "40px",
        11: "44px",
        12: "48px",
        14: "56px",
        16: "64px",
        20: "80px",
        24: "96px",
        28: "112px",
        32: "128px",
        36: "144px",
        40: "160px",
        44: "176px",
        48: "192px",
        52: "208px",
        56: "224px",
        60: "240px",
        64: "256px",
        72: "288px",
        80: "320px",
        96: "384px",
      },
      // Tailwind's type ramp in px with its line heights.
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "28px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
      },
      // Radius ladder (design.md Section 2.1), in px so a font scale can never
      // move a corner radius.
      borderRadius: {
        sm: "8px",
        md: "10px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      // Inter, loaded as static weights: Android resolves weights by family
      // name, so each weight is its own family and `font-medium` etc. carry
      // both the family and the weight.
      fontFamily: {
        sans: ["Inter_400Regular"],
        medium: ["Inter_500Medium"],
        semibold: ["Inter_600SemiBold"],
        bold: ["Inter_700Bold"],
      },
      // Optical tracking from globals.css, in px (RN letterSpacing is px).
      letterSpacing: {
        label: "0.9px",
        micro: "0.7px",
        body: "-0.1px",
        title: "-0.6px",
        tight: "-0.3px",
      },
    },
  },
  plugins: [],
};
