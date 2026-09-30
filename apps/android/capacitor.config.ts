import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.katariasyntex.bizapp",
  appName: "Kataria Syntex",
  webDir: "../app/dist",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: "#0a0a0a",
      showSpinner: false,
      launchAutoHide: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0a",
      overlaysWebView: false,
    },
    Camera: {
      // QR scanning reads the live preview, not a captured still — no
      // saveToGallery, no photo permissions beyond the camera itself.
      permissions: ["camera"],
    },
  },
};

export default config;
