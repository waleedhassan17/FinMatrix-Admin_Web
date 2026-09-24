import { Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useRouteError,
} from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { BILLING_DISABLED_BUILD } from '@/config/featureFlags';
import {
  RedirectIfAuthenticated,
  RequireSuperAdmin,
  SessionGate,
} from '@/features/auth/SessionGate';
import { AppLayout } from '@/features/shell/AppLayout';
import { reportError } from '@/app/observability';
import { Spinner } from '@/components/ui/Spinner';

import {
  AnalyticsPage,
  CompaniesPage,
  ResetPasswordPage,
  CompanyDetailPage,
  DashboardPage,
  LoginPage,
  NotFoundPage,
  PaymentsPage,
  PlansPage,
  SettingsPage,
} from './lazyPages';

function RouteFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      aria-busy="true"
    >
      <Spinner />
    </div>
  );
}

function RouteError() {
  const error = useRouteError();
  reportError(error, { boundary: 'route' });
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-lg">
      <div className="w-full max-w-form rounded-lg bg-surface p-xl text-center shadow-card">
        <h1 className="text-h3 text-text-primary">Something went wrong</h1>
        <p className="mt-xs text-body-sm text-text-secondary">
          The page could not be loaded.
        </p>
        <Button className="mt-lg" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}

/** Boot the session once, above everything that reads it. */
function Root() {
  return (
    <SessionGate>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </SessionGate>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      // No public landing page: an internal console has no front door.
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      {
        path: '/login',
        element: (
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        ),
      },
      // Outside the auth guard on purpose: someone who cannot sign in is
      // exactly who needs this page.
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        element: (
          <RequireSuperAdmin>
            <AppLayout />
          </RequireSuperAdmin>
        ),
        errorElement: <RouteError />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'companies', element: <CompaniesPage /> },
          { path: 'companies/:id', element: <CompanyDetailPage /> },
          // BILLING-DISABLED BUILD: the plan pages are routed away rather
          // than deleted — a bookmark lands on the dashboard, and flipping
          // the flag brings every page back untouched.
          {
            path: 'payments',
            element: BILLING_DISABLED_BUILD ? <Navigate to="/dashboard" replace /> : <PaymentsPage />,
          },
          {
            path: 'analytics',
            element: BILLING_DISABLED_BUILD ? <Navigate to="/dashboard" replace /> : <AnalyticsPage />,
          },
          {
            path: 'plans',
            element: BILLING_DISABLED_BUILD ? <Navigate to="/dashboard" replace /> : <PlansPage />,
          },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
