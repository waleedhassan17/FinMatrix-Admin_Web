import { Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useRouteError,
} from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import {
  RedirectIfAuthenticated,
  RequireSuperAdmin,
  SessionGate,
} from '@/features/auth/SessionGate';
import { AppLayout } from '@/features/shell/AppLayout';
import { reportError } from '@/app/observability';

import {
  AnalyticsPage,
  CompaniesPage,
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
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

function RouteError() {
  const error = useRouteError();
  reportError(error, { boundary: 'route' });
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-lg">
      <div className="w-full max-w-sm rounded-lg bg-surface p-xl text-center shadow-card">
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
          { path: 'payments', element: <PaymentsPage /> },
          { path: 'analytics', element: <AnalyticsPage /> },
          { path: 'plans', element: <PlansPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
