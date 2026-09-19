// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Deferred pages
// ═══════════════════════════════════════════════════════
// Dynamic import is the only thing that actually defers a module: a statically
// imported page is in the entry graph no matter which chunk it lands in. So the
// console's pages — and with them recharts and TanStack Table — load on demand
// rather than before sign-in can paint.
//
// LoginPage is deferred too. Unlike the customer site there is no public
// landing page competing for the first paint, and sign-in is a small page that
// nobody reaches twice in a session.
//
// The <Suspense> boundaries these resolve against are in Root (full screen) and
// AppLayout (inside <main>, so the sidebar does not flicker on navigation).

import { lazyWithReload } from './lazyWithReload';

export const LoginPage = lazyWithReload(() => import('@/pages/auth/LoginPage'));
export const ResetPasswordPage = lazyWithReload(
  () => import('@/pages/auth/ResetPasswordPage'),
);
export const DashboardPage = lazyWithReload(
  () => import('@/pages/DashboardPage'),
);
export const CompaniesPage = lazyWithReload(
  () => import('@/pages/companies/CompaniesPage'),
);
export const CompanyDetailPage = lazyWithReload(
  () => import('@/pages/companies/CompanyDetailPage'),
);
export const PaymentsPage = lazyWithReload(
  () => import('@/pages/payments/PaymentsPage'),
);
export const AnalyticsPage = lazyWithReload(
  () => import('@/pages/analytics/AnalyticsPage'),
);
export const PlansPage = lazyWithReload(() => import('@/pages/plans/PlansPage'));
export const SettingsPage = lazyWithReload(
  () => import('@/pages/settings/SettingsPage'),
);
export const NotFoundPage = lazyWithReload(
  () => import('@/pages/NotFoundPage'),
);
