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
// document and reserves the title bar strip from it (--titlebar-h), so the
// window controls sit flush against the window edge with no layout shift.
if (window.desktop) {
  document.documentElement.dataset.shell = "desktop";
  document.documentElement.style.setProperty("--titlebar-h", "2.25rem");
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
