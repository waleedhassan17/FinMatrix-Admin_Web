// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Sidebar
// ═══════════════════════════════════════════════════════
// The customer site's navy sidebar, flattened: six links, no accordions, no
// capability filtering. The gradient and the brand row are kept so the two
// products read as one.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { LogoMark } from '@/components/brand/LogoMark';
import { BILLING_DISABLED_BUILD } from '@/config/featureFlags';
import { NAV_ITEMS } from '@/config/nav';
import { cn } from '@/lib/cn';
import { getPlatformStats } from '@/networks/superAdmin/platformNetwork';
import { getPlatformRevenue } from '@/networks/superAdmin/submissionNetwork';
import { SIDEBAR_GRADIENT } from '@/theme/tokens';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  // Not persisted, matching the customer site. A collapsed sidebar is a
  // per-session preference, not a setting.
  const [collapsed, setCollapsed] = useState(false);

  // The drawer closes from the events that close it: the nav links below, the
  // X button, and the scrim. It used to close from an effect keyed on the path
  // AND on onCloseMobile -- and because the prop was an inline arrow, every
  // parent render gave it a fresh identity. Opening the drawer re-rendered the
  // parent, which re-fired the effect, which closed the drawer in the frame it
  // opened. It could never open on a phone, where this is the only navigation
  // there is.

  // How many submissions are waiting. Polled rather than invalidated, because
  // the queue changes when a tenant pays, not when this console does anything.
  //
  // This used to fetch the whole submitted list every 60s just to read
  // rows.length -- and that endpoint has no server-side limit, so it was a
  // full table scan and a full JSON payload per minute, per open tab, forever.
  // It also used a key of its own, so deciding a submission did not move the
  // badge.
  //
  // The revenue summary already carries pendingSubmissions as a SQL COUNT.
  // Reading it here gives a fixed-size payload, dedupes with AnalyticsPage's
  // identical key, and moves the badge the moment a decision settles, because
  // afterSubmissionDecision already invalidates ['revenue'].
  //
  // Taken deliberately: the refetchInterval now applies to that shared cache
  // entry, so Analytics inherits a 60s poll. For a live revenue view that is
  // defensible -- and it is a decision, not a side effect nobody noticed.
  const { data: waiting } = useQuery({
    queryKey: ['revenue', 'summary'],
    queryFn: getPlatformRevenue,
    refetchInterval: 60_000,
    select: (summary) => summary.pendingSubmissions,
    // BILLING-DISABLED BUILD: there is no Payments page to badge.
    enabled: !BILLING_DISABLED_BUILD,
  });

  // BILLING-DISABLED BUILD: the queue is companies awaiting approval. Same key
  // as the dashboard's stats, so the two never disagree, and a decision moves
  // the badge because afterCompanyDecision invalidates ['platform'].
  const { data: pendingCompanies } = useQuery({
    queryKey: ['platform', 'stats'],
    queryFn: getPlatformStats,
    refetchInterval: 60_000,
    select: (stats) => stats.companies.pending,
    enabled: BILLING_DISABLED_BUILD,
  });

  return (
    <>
      {/* Tap-outside-to-dismiss. Hidden from assistive tech on purpose: it
          duplicates the X button below, and two controls reading "Close
          navigation" is worse than one. */}
      {mobileOpen && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Reserves the width on desktop so `main` is never under the aside. */}
      <div
        className={cn(
          'hidden shrink-0 transition-all duration-300 lg:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      />

      <aside
        id="admin-sidebar"
        style={{ background: SIDEBAR_GRADIENT }}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-72 flex-col text-white shadow-xl transition-all duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-md">
          <div className="flex min-w-0 items-center gap-sm">
            <LogoMark className="size-9" />
            {!collapsed && (
              <span className="truncate text-h4 text-white">FinMatrix Admin</span>
            )}
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="rounded-sm p-xxs text-white/70 hover:text-white lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-sm py-md">
          <ul className="space-y-[2px]">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const count =
                item.badge === 'submissions'
                  ? (waiting ?? 0)
                  : item.badge === 'pendingCompanies'
                    ? (pendingCompanies ?? 0)
                    : 0;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    title={collapsed ? item.title : undefined}
                    // Closes the drawer on the tap that navigates. Doing it here
                    // rather than from an effect on the path keeps it tied to the
                    // event that caused it, and leaves the drawer with no
                    // dependency on any render-identity staying stable.
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-sm rounded-lg px-sm py-[10px] text-label-md transition-colors',
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white',
                      )
                    }
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                    {!collapsed && count > 0 && (
                      <span className="ml-auto rounded-full bg-warning px-[6px] py-[1px] text-label-sm text-white tabular">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="absolute -right-3 top-20 hidden size-6 items-center justify-center rounded-full border-2 border-border bg-[color:var(--color-sidebar-from)] text-white lg:flex"
        >
          <ChevronLeft
            className={cn('size-3 transition-transform', collapsed && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </aside>
    </>
  );
}

export default Sidebar;
