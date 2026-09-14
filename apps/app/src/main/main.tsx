import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { configureToasts } from "@kataria-syntex/app-core";
import { toast } from "sonner";
import { App } from "@/ui/App";
import { initTheme } from "@/ui/hooks/use-theme";
import {
  configureWebCore,
  desktopBridge,
  detectHost,
  hydrateAndroidStorage,
} from "@/lib/platform";
import "@/ui/globals.css";

initTheme();

// Shell boot: adapter (host/token/storage/network seam) + toast sink before
// the first render, so no store or API call can run unconfigured.
configureWebCore(__APP_VERSION__);
// Android's sync storage is a session map over async Preferences — hydrate it
// before the first render so the offline engine never reads an empty store.
if (detectHost() === "android") await hydrateAndroidStorage();
configureToasts({
  success: (title, description) =>
    toast.success(title, { description, duration: 4000 }),
  error: (title, description) =>
    toast.error(title, { description, duration: 8000 }),
});

// The entry document is always the "/" route: any shell that hands it a
// literal /index.html path would land the router on the 404 route.
if (location.pathname.endsWith("/index.html")) {
  history.replaceState(
    null,
    "",
    location.pathname.slice(0, -"index.html".length),
  );
}

// Desktop shell markers go on <html> before first paint: the CSS pins the
// document (overflow hidden, .app-scroll owns scrolling) and --wc-w reserves
// the top-right corner for the floating window controls, so header content
// never slides beneath them and there is no layout shift.
const desktop = desktopBridge();
if (desktop) {
  document.documentElement.dataset.shell = "desktop";
  if (desktop.platform !== "darwin") {
    document.documentElement.style.setProperty(
      "--wc-w",
      "calc(var(--wc-btn-w) * 3)",
    );
  } else {
    // Clear the native traffic-light strip above the sidebar brand.
    document.documentElement.style.setProperty("--tl-inset", "2.25rem");
  }
}

// PWA service worker registration lives in store/updates.ts. The app://
// scheme in Electron has no service-worker privilege, so nothing registers
// there.

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
