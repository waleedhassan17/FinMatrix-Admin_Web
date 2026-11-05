// ═══════════════════════════════════════════════════════
// FinMatrix Admin — the brand mark
// ═══════════════════════════════════════════════════════
// A rounded "m" over a red rule: the FinMatrix logo. The same geometry as the
// customer site's src/components/brand/Logo.tsx, the apps' BrandMark and the
// launcher icons: one stroke of width 20, three stems 40 apart, arches with a
// centreline radius of 20, round ends, and the rule beneath. Change one,
// change all of them.
//
// COLOUR: the "m" is `currentColor`, so the parent sets it with a text colour
// class (white on this console's dark sidebar and sign-in panel). The rule is
// always the logo's red, through the `brand-red` token —
// scripts/check-design-tokens.js fails the build on a hex in a .tsx file.

import { cn } from '@/lib/cn';

type LogoMarkProps = {
  /** Sizing utility for the square mark, e.g. `size-9`. */
  className?: string;
};

/**
 * `aria-hidden` because the name beside it ("FinMatrix Admin") carries the
 * meaning; where it stands alone, the caller supplies the label.
 */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    // The mark's box is x -3.86…103.86, y 0…91.61; the square viewBox centres it
    // with a little air, so it sits in a `size-*` square like any icon.
    <svg
      viewBox="-12 -16.2 124 124"
      fill="none"
      aria-hidden="true"
      className={cn('size-8 shrink-0', className)}
    >
      <path
        d="M10 62.36V30a20 20 0 0 1 40 0v32.36M50 30a20 20 0 0 1 40 0v32.36"
        stroke="currentColor"
        strokeWidth="20"
        strokeLinecap="round"
      />
      <rect
        x="-3.86"
        y="79.25"
        width="107.72"
        height="12.36"
        rx="6.18"
        className="fill-brand-red"
      />
    </svg>
  );
}

export default LogoMark;
