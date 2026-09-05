import { lazy, Suspense, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth, isPackerOnlyWorkspace } from "@/store/auth";
import { ProtectedRoute } from "@/ui/components/protected-route";
import { AppShell } from "@/ui/components/app-shell";
import { Toaster } from "@/ui/components/toast";
import { Skeleton } from "@/ui/components/motion";
import { ErrorBoundary } from "@/ui/components/error-boundary";
import { TitleBar } from "@/ui/components/title-bar";
import { NotFoundPage } from "@/ui/pages/not-found";

const AuthPage = lazy(() =>
  import("@/ui/pages/auth").then((m) => ({ default: m.AuthPage })),
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

function RouteLoader() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-56" />
      <div className="mt-6 grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

function Home() {
  const ws = useAuth((s) => s.workspace);
  if (isPackerOnlyWorkspace(ws)) {
    return <PackingPage />;
  }
  return <Dashboard />;
}

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <>
      <ErrorBoundary>
        <TitleBar />
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/login/scan/:code" element={<ScanApprovePage />} />
            <Route
              path="/challans/:id/print"
              element={
                <ProtectedRoute>
                  <ChallanPrintPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/outward/:id/print"
              element={
                <ProtectedRoute>
                  <OutwardChallanPrintPage />
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
              <Route index element={<Home />} />
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
      </ErrorBoundary>
      <Toaster />
    </>
  );
}
