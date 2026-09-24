// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Navigation
// ═══════════════════════════════════════════════════════
// Flat links, no accordions. While billing is off (BILLING_DISABLED_BUILD)
// the plan pages are dropped and three remain: Dashboard, Companies, Settings.
//
// Originally: six links, no accordions. The customer site groups ~90 routes into
// expandable sections; the console has six pages, one per bottom tab in the
// Android console, and nesting six items would be ceremony.
//
// Icons are the lucide equivalents of the app's Feather names, so someone who
// knows one console recognises the other.

import { BILLING_DISABLED_BUILD } from '@/config/featureFlags';
import {
  BarChart2,
  Briefcase,
  CheckSquare,
  CreditCard,
  LayoutGrid,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
  /** Marks the queue whose waiting count is shown as a badge. */
  badge?: 'submissions' | 'pendingCompanies';
}

/** The pages that exist only to sell plans. See BILLING_DISABLED_BUILD. */
export const BILLING_ONLY_PATHS = ['/payments', '/analytics', '/plans'] as const;

const ALL_NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
  // With nothing to pay, the queue that needs an administrator is the
  // companies awaiting approval, so that is where the waiting count goes.
  {
    title: 'Companies',
    path: '/companies',
    icon: Briefcase,
    ...(BILLING_DISABLED_BUILD ? { badge: 'pendingCompanies' as const } : {}),
  },
  { title: 'Payments', path: '/payments', icon: CheckSquare, badge: 'submissions' },
  { title: 'Analytics', path: '/analytics', icon: BarChart2 },
  { title: 'Plans', path: '/plans', icon: CreditCard },
  { title: 'Settings', path: '/settings', icon: Settings },
];

export const NAV_ITEMS: NavItem[] = BILLING_DISABLED_BUILD
  ? ALL_NAV_ITEMS.filter(
      (item) => !(BILLING_ONLY_PATHS as readonly string[]).includes(item.path),
    )
  : ALL_NAV_ITEMS;
