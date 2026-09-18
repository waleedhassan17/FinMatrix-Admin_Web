// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Sidebar
// ═══════════════════════════════════════════════════════
// The customer site's navy sidebar, flattened: six links, no accordions, no
// capability filtering. The gradient and the brand row are kept so the two
// products read as one.

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ShieldCheck, X } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { NAV_ITEMS } from '@/config/nav';
import { cn } from '@/lib/cn';
import { listPaymentSubmissions } from '@/networks/superAdmin/submissionNetwork';
import { SIDEBAR_GRADIENT } from '@/theme/tokens';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  // Not persisted, matching the customer site. A collapsed sidebar is a
  // per-session preference, not a setting.
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // The drawer must close on navigation, or a tap on mobile leaves the scrim up
  // over the page it just opened.
  useEffect(() => {
    onCloseMobile();
  }, [location.pathname, onCloseMobile]);

  // How many submissions are waiting. Polled rather than invalidated, because
  // the queue changes when a tenant pays, not when this console does anything.
  const { data: waiting } = useQuery({
    queryKey: ['submissions', 'waiting-count'],
    queryFn: () => listPaymentSubmissions({ status: 'submitted' }),
    refetchInterval: 60_000,
    select: (rows) => rows.length,
  });

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
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
        style={{ background: SIDEBAR_GRADIENT }}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-72 flex-col text-white shadow-xl transition-all duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-md">
          <div className="flex min-w-0 items-center gap-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
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
              const count = item.badge === 'submissions' ? (waiting ?? 0) : 0;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    title={collapsed ? item.title : undefined}
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
