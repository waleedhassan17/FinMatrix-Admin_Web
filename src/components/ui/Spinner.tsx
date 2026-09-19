// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Spinner
// ═══════════════════════════════════════════════════════
// A separate file from Skeleton on purpose: a pulse placeholder stands in for
// content whose shape is known, a spinner says "waiting, shape unknown". They
// also want different accessibility -- a skeleton is decoration, a spinner is
// a live region.
//
// Four lines feels small to extract, but the exact border recipe is the part
// that drifts, and check:tokens cannot catch a wrong-but-tokenised colour.
// There were three byte-identical copies.

import { cn } from '@/lib/cn';

export function Spinner({
  size = 'md',
  label = 'Loading',
  className,
}: {
  size?: 'sm' | 'md';
  /** Announced to screen readers; the ring itself is decorative. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'animate-spin rounded-full border-2 border-border border-t-primary',
        size === 'sm' ? 'size-4' : 'size-8',
        className,
      )}
    />
  );
}

export default Spinner;
