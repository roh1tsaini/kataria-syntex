import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Single source of truth for the app version across both shells (web/PWA,
// Electron). Baked into the renderer as __APP_VERSION__.
const APP_VERSION = (
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, "package.json"), "utf8"),
  ) as { version: string }
).version;

// Copies the canonical Inter TTFs into dist/fonts so the Worker's ASSETS
// binding can serve them to the server PDF renderer.
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

// Injects the backend origin into the CSP at build time. Installed shells
// (Electron app://bundle, standalone PWA) may not be same-origin with the
// API, so the built HTML allowlists APP_URL / VITE_API_URL. Local builds
// with neither set drop the placeholder and stay same-origin only.
function appOrigin(): Plugin {
  return {
    name: "kataria-app-origin",
    transformIndexHtml(html) {
      const raw = process.env.APP_URL ?? process.env.VITE_API_URL ?? "";
      if (!raw) return html.replace(" https://CHANGE_ME_APP_ORIGIN", "");
      const origin = `https://${raw.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
      return html.replaceAll("https://CHANGE_ME_APP_ORIGIN", origin);
    },
  };
}

// Web/PWA build — served same-origin by the Hono server in production.
// Electron packages the same renderer output (see electron/build.ts for
// main/preload).
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    appOrigin(),
    interFonts(),
    react(),
    tailwindcss(),
    VitePWA({
      // Updates are user-applied: a new deploy installs in the background and
      // the update banner (update-surface.tsx) applies it on click. The
      // service worker never force-reloads a tab mid-edit.
      registerType: "prompt",
      manifest: {
        name: "Kataria Syntex Biz App",
        short_name: "KS Biz App",
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
        // /releases/* must bypass the SPA fallback too: the fallback would
        // answer installer/APK downloads with cached index.html (users get
        // an .htm file instead of the app).
        navigateFallbackDenylist: [/^\/api\//, /^\/releases\//],
        // Precache every JS/CSS chunk: the app is offline-capable by design
        // (lib/offline queues challans against cached masters/session), so
        // every route chunk must load with no network. This is the standard
        // workbox shape for offline SPAs — do NOT narrow it to "the shell";
        // lazy routes would 404 offline. TTFs are the one deliberate
        // exception (runtime cache below); the plugin auto-adds the four
        // small manifest icons.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        runtimeCaching: [
          {
            // Inter TTFs (~1.6 MB, fetched only when rendering a challan
            // PDF) cache on first use instead of riding every release's
            // precache diff. Content-hashed URLs + versioned cache name: a
            // new app version starts fresh and cleanupOutdatedCaches
            // removes the old one.
            urlPattern: /\.ttf$/,
            handler: "CacheFirst",
            options: {
              cacheName: "app-runtime-v1",
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 30 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
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
