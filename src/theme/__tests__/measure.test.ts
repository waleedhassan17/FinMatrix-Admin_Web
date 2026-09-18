// ═══════════════════════════════════════════════════════
// The measure scale must stay reachable
// ═══════════════════════════════════════════════════════
// Tailwind resolves a width utility against --max-width, then --spacing, then
// --container, and takes the FIRST namespace that has the name. Our spacing
// scale is t-shirt sized, so it owns xs…xxxxl outright: `max-w-sm` compiles to
// `max-width: var(--spacing-sm)` — 12px — and nothing anywhere errors. That is
// how the sign-in form shipped 12px wide.
//
// check:tokens stops anyone writing a t-shirt-sized width, and cross-checks
// these names against the real --spacing and --container declarations in
// index.css (which a vitest `?raw` import cannot see — Vite stubs CSS in the
// node environment and hands back an empty string). What is left for here is
// the tokens.ts half of the invariant.

import { describe, expect, it } from 'vitest';

import { measure, spacing } from '@/theme/tokens';

describe('the measure scale', () => {
  it('shares no name with the spacing scale', () => {
    const collisions = Object.keys(measure).filter((name) =>
      Object.prototype.hasOwnProperty.call(spacing, name),
    );
    expect(collisions).toEqual([]);
  });

  // `prose` is a static Tailwind utility (65ch) and wins over the theme, so a
  // measure named for it would be declared, pass every other check, and still
  // never take effect. Same for the other static max-w-* names.
  it('avoids the names Tailwind already defines as static utilities', () => {
    const TAILWIND_STATIC = ['none', 'full', 'min', 'max', 'fit', 'prose', 'screen'];
    const taken = Object.keys(measure).filter((n) => TAILWIND_STATIC.includes(n));
    expect(taken).toEqual([]);
  });

  it('is a plain px scale, ascending, with no duplicate values', () => {
    const values = Object.values(measure);
    expect(values.every((v) => Number.isInteger(v) && v > 0)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });
});
