import { lazy, Suspense, useEffect, useRef } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth, isPackerOnlyWorkspace } from "@/store/auth";
import { initUpdateChecks } from "@/store/updates";
import { isNative, isPlainBrowser } from "@/lib/platform";
import { ProtectedRoute } from "@/ui/components/protected-route";
import { AppShell } from "@/ui/components/app-shell";
import { Toaster } from "@/ui/components/toast";
import { UpdateSurface } from "@/ui/components/update-surface";
import { ErrorBoundary } from "@/ui/components/error-boundary";
import { TitleBar, WindowControls } from "@/ui/components/title-bar";
import {
  AuthSkeleton,
  PrintSkeleton,
  ScanApproveSkeleton,
} from "@/ui/components/page-skeletons";
import { NotFoundPage } from "@/ui/pages/not-found";

const AuthPage = lazy(() =>
  import("@/ui/pages/auth").then((m) => ({ default: m.AuthPage })),
);
const EntryPage = lazy(() =>
  import("@/ui/pages/entry").then((m) => ({ default: m.EntryPage })),
);
const DownloadPage = lazy(() =>
  import("@/ui/pages/download").then((m) => ({ default: m.DownloadPage })),
);
const ScanApprovePage = lazy(() =>
  import("@/ui/pages/scan-approve").then((m) => ({
    default: m.ScanApprovePage,
  })),
);
const Dashboard = lazy(() =>
  import("@/ui/pages/dashboard").then((m) => ({ default: m.Dashboard })),
);
const DevicesPage = lazy(() =>
  import("@/ui/pages/devices").then((m) => ({ default: m.DevicesPage })),
);
const MembersPage = lazy(() =>
  import("@/ui/pages/members").then((m) => ({ default: m.MembersPage })),
);
const SettingsPage = lazy(() =>
  import("@/ui/pages/settings").then((m) => ({ default: m.SettingsPage })),
);
const MastersPage = lazy(() =>
  import("@/ui/pages/masters").then((m) => ({ default: m.MastersPage })),
);
const ColorsPage = lazy(() =>
  import("@/ui/pages/colors").then((m) => ({ default: m.ColorsPage })),
);
const ChallansPage = lazy(() =>
  import("@/ui/pages/challans").then((m) => ({ default: m.ChallansPage })),
);
const ChallanEditorPage = lazy(() =>
  import("@/ui/pages/challans").then((m) => ({ default: m.ChallanEditorPage })),
);
const ChallanDetailPage = lazy(() =>
  import("@/ui/pages/challans").then((m) => ({ default: m.ChallanDetailPage })),
);
const ChallanPrintPage = lazy(() =>
  import("@/ui/pages/challans").then((m) => ({ default: m.ChallanPrintPage })),
);
const OutwardChallansPage = lazy(() =>
  import("@/ui/pages/outward").then((m) => ({
    default: m.OutwardChallansPage,
  })),
);
const OutwardChallanEditorPage = lazy(() =>
  import("@/ui/pages/outward").then((m) => ({
    default: m.OutwardChallanEditorPage,
  })),
);
const OutwardChallanDetailPage = lazy(() =>
  import("@/ui/pages/outward").then((m) => ({
    default: m.OutwardChallanDetailPage,
  })),
);
const OutwardChallanPrintPage = lazy(() =>
  import("@/ui/pages/outward").then((m) => ({
    default: m.OutwardChallanPrintPage,
  })),
);
const ReturnsPage = lazy(() =>
  import("@/ui/pages/returns").then((m) => ({ default: m.ReturnsPage })),
);
const RawMaterialPage = lazy(() =>
  import("@/ui/pages/raw-material").then((m) => ({
    default: m.RawMaterialPage,
  })),
);
const StockPage = lazy(() =>
  import("@/ui/pages/stock").then((m) => ({ default: m.StockPage })),
);
const PackingPage = lazy(() =>
  import("@/ui/pages/packing").then((m) => ({ default: m.PackingPage })),
);
const ReportsPage = lazy(() =>
  import("@/ui/pages/reports").then((m) => ({ default: m.ReportsPage })),
);

function Home() {
  const ws = useAuth((s) => s.workspace);
  if (isPackerOnlyWorkspace(ws)) {
    return <PackingPage />;
  }
  return <Dashboard />;
}

/** "/" when signed out — the two-path entry screen (plain browser only).
 * Installed contexts (Electron, Capacitor, standalone PWA) ARE the app: they
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
 * them, so it sends them to sign-in instead. Browsers (and the web PWA
 * flow) keep the page. */
function DownloadOrAuth() {
  if (isNative()) return <Navigate to="/auth" replace />;
  return <DownloadPage />;
}

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    void bootstrap();
    // Update pollers (native) + Electron status events — idempotent, and the
    // web host is a no-op there.
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
        <TitleBar />
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
                    <AuthPage />
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
              <Route
                path="/challans/:id/print"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PrintSkeleton />}>
                      <ChallanPrintPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/outward/:id/print"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PrintSkeleton />}>
                      <OutwardChallanPrintPage />
                    </Suspense>
                  </ProtectedRoute>
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
                <Route
                  path="devices"
                  element={
                    <ProtectedRoute requirePermission="manage_settings">
                      <DevicesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="members"
                  element={
                    <ProtectedRoute requirePermission="manage_members">
                      <MembersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="masters"
                  element={
                    <ProtectedRoute requirePermission="manage_masters">
                      <MastersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="colors"
                  element={
                    <ProtectedRoute requirePermission="manage_masters">
                      <ColorsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <ProtectedRoute requirePermission="manage_settings">
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="challans" element={<ChallansPage />} />
                <Route
                  path="challans/new"
                  element={
                    <ProtectedRoute requirePermission="create_challan">
                      <ChallanEditorPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="challans/:id" element={<ChallanDetailPage />} />
                <Route
                  path="challans/:id/edit"
                  element={
                    <ProtectedRoute requirePermission="edit_challan">
                      <ChallanEditorPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="outward" element={<OutwardChallansPage />} />
                <Route
                  path="outward/new"
                  element={
                    <ProtectedRoute requirePermission="create_challan">
                      <OutwardChallanEditorPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="outward/:id"
                  element={<OutwardChallanDetailPage />}
                />
                <Route
                  path="outward/:id/edit"
                  element={
                    <ProtectedRoute requirePermission="edit_challan">
                      <OutwardChallanEditorPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="returns"
                  element={
                    <ProtectedRoute requirePermission="create_return">
                      <ReturnsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="raw-material"
                  element={
                    <ProtectedRoute requirePermission="create_raw_material">
                      <RawMaterialPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="stock/raw"
                  element={
                    <ProtectedRoute requirePermission="view_stock">
                      <StockPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="stock/dyed"
                  element={
                    <ProtectedRoute requirePermission="view_stock">
                      <StockPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="packing"
                  element={
                    <ProtectedRoute requirePermission="create_packing">
                      <PackingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <ProtectedRoute requirePermission="view_reports">
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="reports/:reportId"
                  element={
                    <ProtectedRoute requirePermission="view_reports">
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
        {/* Mounted last: its no-drag rect is the final subtraction from the
            drag region (app-region resolves in DOM order, z-index ignored). */}
        <WindowControls />
      </ErrorBoundary>
      <Toaster />
    </>
  );
}
