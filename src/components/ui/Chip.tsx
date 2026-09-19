// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Chip
// ═══════════════════════════════════════════════════════
// A pill-shaped toggle: status filters, kind filters, canned rejection
// reasons. There were three copies of this class expression before -- one real
// component in PaymentsPage and two inlined in CompaniesPage -- and the
// trial and subscription filters would have made five.
//
// Only the chip is extracted, not the row around it. One wrapper is a bordered
// table toolbar and another is a plain wrapping flex row; they differ for
// reasons that have nothing to do with the control.

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Chip({
  active,
  onClick,
  size = 'md',
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** `sm` for dense secondary rows, such as the canned rejection reasons. */
  size?: 'sm' | 'md';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // A filter chip is a toggle, and a screen reader should hear which one is
      // on. None of the three copies said so.
      aria-pressed={active}
      className={cn(
        'rounded-full px-sm py-xxs transition-colors',
        size === 'sm' ? 'text-label-sm' : 'text-label-md',
        active
          ? 'bg-primary text-text-inverse'
          : 'bg-neutral-100 text-text-secondary hover:bg-neutral-200',
      )}
    >
      {children}
    </button>
  );
}

export default Chip;
