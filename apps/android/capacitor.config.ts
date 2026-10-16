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
  },
};

export default config;
