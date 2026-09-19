// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Topbar
// ═══════════════════════════════════════════════════════
// The customer site's topbar minus everything that needs a tenant: no global
// search (nothing to search across), no company chip (no company), no
// notifications (no per-company events). What is left is who you are and how
// to leave.

import { LogOut, Menu, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useSignOut } from '@/features/auth/useSignOut';
import { selectUser } from '@/store/authSlice';
import { useAppSelector } from '@/store/store';
import { initialsOf } from '@/utils/initials';

interface TopbarProps {
  onOpenMobileNav: () => void;
  /** Reported as aria-expanded -- this button is the drawer's disclosure control. */
  mobileNavOpen: boolean;
}

export function Topbar({ onOpenMobileNav, mobileNavOpen }: TopbarProps) {
  const user = useAppSelector(selectUser);
  const signOut = useSignOut();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-md border-b border-border bg-surface px-md lg:px-lg">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        aria-expanded={mobileNavOpen}
        aria-controls="admin-sidebar"
        className="rounded-sm p-xxs text-text-secondary hover:text-text-primary lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <span className="text-label-md text-text-secondary">Platform console</span>

      <div className="ml-auto flex items-center gap-xs">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex size-9 items-center justify-center rounded-full bg-primary-tint text-label-md text-primary"
            >
              {initialsOf(user?.displayName ?? user?.email ?? 'A')}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <span className="block truncate text-label-md text-text-primary">
                {user?.displayName ?? 'Administrator'}
              </span>
              <span className="block truncate text-caption text-text-secondary">
                {user?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* onSelect rather than asChild: asChild hands Radix's Slot a
                single child, and the icon would be a second one. */}
            <DropdownMenuItem
              icon={<User className="size-4" />}
              onSelect={() => navigate('/settings')}
            >
              Console settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              icon={<LogOut className="size-4" />}
              onSelect={signOut}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Topbar;
