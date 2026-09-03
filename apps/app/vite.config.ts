import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Copies the canonical Inter TTFs into dist/fonts so the Pages Functions
// ASSETS binding can serve them to the server PDF renderer.
function interFonts(): Plugin {
  return {
    name: "kataria-inter-fonts",
    apply: "build",
    closeBundle() {
      const out = resolve(import.meta.dirname, "dist/fonts");
      mkdirSync(out, { recursive: true });
      for (const file of ["Inter-Regular.ttf", "Inter-Bold.ttf"]) {
        copyFileSync(
          resolve(import.meta.dirname, "src/shared/fonts", file),
          `${out}/${file}`,
        );
      }
    },
  };
}

// Web/PWA build — served same-origin by the Hono server in production.
// Capacitor/Android reuses this bundle via `cap sync`; Electron packages the
// same renderer output (see electron/build.ts for main/preload).
export default defineConfig({
  plugins: [
    interFonts(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "theme-init.js"],
      manifest: {
        name: "Kataria Challan",
        short_name: "Kataria",
        description:
          "Sales challans, job work, stock and packing for Kataria Syntex.",
        lang: "en",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        theme_color: "#141210",
        background_color: "#0a0a0a",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // API calls are never cached — offline queuing is handled in-app
        // (lib/offline) against explicit user intent, not a stale SW cache.
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ttf}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src/main"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: false,
      },
    },
  },
  preview: {
    port: 1420,
    host: "0.0.0.0",
    allowedHosts: [".trycloudflare.com"],
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
