// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Navigation
// ═══════════════════════════════════════════════════════
// Flat: six links, no accordions. The customer site groups ~90 routes into
// expandable sections; the console has six pages, one per bottom tab in the
// Android console, and nesting six items would be ceremony.
//
// Icons are the lucide equivalents of the app's Feather names, so someone who
// knows one console recognises the other.

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
  badge?: 'submissions';
}

export const NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
  { title: 'Companies', path: '/companies', icon: Briefcase },
  { title: 'Payments', path: '/payments', icon: CheckSquare, badge: 'submissions' },
  { title: 'Analytics', path: '/analytics', icon: BarChart2 },
  { title: 'Plans', path: '/plans', icon: CreditCard },
  { title: 'Settings', path: '/settings', icon: Settings },
];
