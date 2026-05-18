import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/api/auth";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const StockSearchPage = lazy(() => import("@/pages/StockSearchPage").then((m) => ({ default: m.StockSearchPage })));
const StockDetailPage = lazy(() => import("@/pages/StockDetailPage").then((m) => ({ default: m.StockDetailPage })));
const WatchlistsPage = lazy(() => import("@/pages/WatchlistsPage").then((m) => ({ default: m.WatchlistsPage })));
const WatchlistDetailPage = lazy(() => import("@/pages/WatchlistDetailPage").then((m) => ({ default: m.WatchlistDetailPage })));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const AlertsPage = lazy(() => import("@/pages/AlertsPage").then((m) => ({ default: m.AlertsPage })));

function PageLoader() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-accent" />
    </div>
  );
}

function App() {
  const { setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((user) => setUser(user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [setUser, setLoading, logout]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              <ErrorBoundary>
                <DashboardPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/stocks"
            element={
              <ErrorBoundary>
                <StockSearchPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/stocks/:symbol"
            element={
              <ErrorBoundary>
                <StockDetailPage />
              </ErrorBoundary>
            }
          />
        </Route>

        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route
              path="/watchlists"
              element={
                <ErrorBoundary>
                  <WatchlistsPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/watchlists/:id"
              element={
                <ErrorBoundary>
                  <WatchlistDetailPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/alerts"
              element={
                <ErrorBoundary>
                  <AlertsPage />
                </ErrorBoundary>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
