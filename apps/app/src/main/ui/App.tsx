import { Suspense, useEffect, useRef } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@kataria-syntex/app-core";
import { initUpdateChecks } from "@/store/updates";
import { lazyRoute } from "@/lib/lazy-route";
import { isNative, isPlainBrowser } from "@/lib/platform";
import { GuestRoute, ProtectedRoute } from "@/ui/components/protected-route";
import { AppShell } from "@/ui/components/app-shell";
import { Toaster } from "@/ui/components/toast";
import { UpdateSurface } from "@/ui/components/update-surface";
import { ErrorBoundary } from "@/ui/components/error-boundary";
import { ChromeDragStrip, WindowControls } from "@/ui/components/title-bar";
import {
  AuthSkeleton,
  ScanApproveSkeleton,
} from "@/ui/components/page-skeletons";
import { NotFoundPage } from "@/ui/pages/not-found";

const AuthPage = lazyRoute(() =>
  import("@/ui/pages/auth").then((m) => ({ default: m.AuthPage })),
);
const EntryPage = lazyRoute(() =>
  import("@/ui/pages/entry").then((m) => ({ default: m.EntryPage })),
);
const DownloadPage = lazyRoute(() =>
  import("@/ui/pages/download").then((m) => ({ default: m.DownloadPage })),
);
const ScanApprovePage = lazyRoute(() =>
  import("@/ui/pages/scan-approve").then((m) => ({
    default: m.ScanApprovePage,
  })),
);
const DevicesPage = lazyRoute(() =>
  import("@/ui/pages/devices").then((m) => ({ default: m.DevicesPage })),
);
const SettingsPage = lazyRoute(() =>
  import("@/ui/pages/settings").then((m) => ({ default: m.SettingsPage })),
);

function Home() {
  return <div className="min-h-[60vh]" />;
}

/** "/" when signed out — the two-path entry screen (plain browser only).
 * Native shells (Electron, Android) ARE the app: they
 * skip the marketing screen and go straight to sign-in. Signed-in users get
 * the full shell (this route sits outside the layout's guest redirect). */
function EntryOrHome() {
  const status = useAuth((s) => s.status);
  if (status === "guest") {
    if (!isPlainBrowser()) return <Navigate to="/auth" replace />;
    return <EntryPage />;
  }
  return (
    <ProtectedRoute>
      <AppShell>
        <Home />
      </AppShell>
    </ProtectedRoute>
  );
}

/** Native shells ARE the installed app — /download has nothing to offer
 * them, so it sends them to sign-in instead. Browsers keep the page. */
function DownloadOrAuth() {
  if (isNative()) return <Navigate to="/auth" replace />;
  return <DownloadPage />;
}

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    // Bootstrap is fully self-contained: catches network errors, 401s, and
    // falls back to cached session or guest status (no unhandled rejections).
    void bootstrap();
    // Update wiring for every host: the boot manifest check + 4h poll (a web
    // deploy applies itself on the next navigation — no surface, no reload);
    // the Android bundle check, native pollers and Electron events start here.
    initUpdateChecks();
  }, [bootstrap]);

  // The desktop shell scrolls the routed view in .app-scroll (the document
  // itself never scrolls there) — reset it on navigation. On web this div
  // has no own scroll, so this is a no-op and AppShell's window.scrollTo
  // stays the one that matters.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <>
      <ErrorBoundary>
        {/* FIRST element in the app root, always: the window's only drag rect
            (title-bar.tsx explains why that position is the fix). */}
        <ChromeDragStrip />
        <UpdateSurface />
        <div ref={scrollRef} className="app-scroll">
          {/* Shell routes never reach this boundary — AppShell's inner
               Suspense (page-skeletons.tsx routeSkeleton) sits closer to the
               lazy page and shows a page-shaped fallback inside the chrome.
               Only standalone routes below carry their own fallbacks. */}
          <Suspense fallback={null}>
            <Routes>
              <Route
                path="/auth"
                element={
                  <Suspense fallback={<AuthSkeleton />}>
                    <GuestRoute>
                      <AuthPage />
                    </GuestRoute>
                  </Suspense>
                }
              />
              <Route
                path="/login/scan/:code"
                element={
                  <Suspense fallback={<ScanApproveSkeleton />}>
                    <ScanApprovePage />
                  </Suspense>
                }
              />
              <Route
                path="/download"
                element={
                  <Suspense fallback={null}>
                    <DownloadOrAuth />
                  </Suspense>
                }
              />
              <Route
                path="/"
                element={
                  <Suspense fallback={null}>
                    <EntryOrHome />
                  </Suspense>
                }
              />

              {/* Persistent In-App Layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route path="devices" element={<DevicesPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
        {/* Mounted last: a fixed overlay above every route, so its no-drag
            rect is collected after whatever it covers. */}
        <WindowControls />
      </ErrorBoundary>
      <Toaster />
    </>
  );
}
