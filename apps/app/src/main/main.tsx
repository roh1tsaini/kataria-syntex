import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "@/ui/App";
import { initTheme } from "@/ui/hooks/use-theme";
import "@/ui/globals.css";

initTheme();

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
if (window.desktop) {
  document.documentElement.dataset.shell = "desktop";
  if (window.desktop.platform !== "darwin") {
    document.documentElement.style.setProperty("--wc-w", "120px");
  } else {
    // Clear the native traffic-light strip above the sidebar brand.
    document.documentElement.style.setProperty("--tl-inset", "2.25rem");
  }
}

// PWA service worker (web/Android builds; the app:// scheme in Electron has
// no service-worker privilege, so registration is never attempted there).
if (!window.desktop) registerSW({ immediate: true });

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
