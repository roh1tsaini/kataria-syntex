import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Single source of truth for the app version across both shells (web,
// Electron). Baked into the renderer as __APP_VERSION__.
const APP_VERSION = (
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, "package.json"), "utf8"),
  ) as { version: string }
).version;

// Injects the backend origin into the CSP at build time. Installed shells
// (Electron app://bundle) may not be same-origin with the
// API, so the built HTML allowlists APP_URL / VITE_API_URL. Local builds
// with neither set drop the placeholder and stay same-origin only.
function appOrigin(): Plugin {
  return {
    name: "kataria-app-origin",
    transformIndexHtml(html) {
      const raw = process.env.APP_URL ?? process.env.VITE_API_URL ?? "";
      if (!raw) {
        return html.replace(" https://CHANGE_ME_APP_ORIGIN", "");
      }
      const origin = `https://${raw.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
      return html.replaceAll("https://CHANGE_ME_APP_ORIGIN", origin);
    },
  };
}

// Web build — served same-origin by the Hono server in production.
// Electron packages the same renderer output (see electron/build.ts for
// main/preload).
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [appOrigin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src/main"),
    },
    // Bun can physically nest react under apps/app even when versions match,
    // which splits react (nested) from react-dom (hoisted) into two instances
    // — hooks then crash with "Cannot read properties of null (reading
    // 'useRef')". Pin every react import to one copy.
    dedupe: ["react", "react-dom"],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.KC_DEV_LAN === "1" ? "0.0.0.0" : "localhost",
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: false,
      },
    },
  },
  preview: {
    port: 1420,
    host: process.env.KC_DEV_LAN === "1" ? "0.0.0.0" : "localhost",
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: false,
      },
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
});
