// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Date formatting
// ═══════════════════════════════════════════════════════
// One formatter, used everywhere — the same stance src/utils/money.ts takes.
//
// There were three near-copies of this before, and they disagreed: the
// Companies one tolerated null, the Dashboard one did not, and the Analytics
// one dropped the year. Two of the three re-derived the same
// Number.isNaN(d.getTime()) guard, and only two handled null at all.
//
// Every formatter here answers an em dash rather than "Invalid Date" for
// anything it cannot read, so a missing timestamp reads as absent rather than
// as an error.

const EMPTY = '—';

/** Parses an API timestamp, or null if it is missing or unparseable. */
const parse = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** `12 Mar 2026` */
export const formatDate = (iso: string | null | undefined): string => {
  const d = parse(iso);
  return d
    ? d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : EMPTY;
};

/** `12 Mar` — for axis labels and other places the year is already implied. */
export const formatDayMonth = (iso: string | null | undefined): string => {
  const d = parse(iso);
  return d
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : EMPTY;
};

/** `12 Mar 2026, 14:30` — for audit-ish fields where the time matters. */
export const formatDateTime = (iso: string | null | undefined): string => {
  const d = parse(iso);
  return d
    ? d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : EMPTY;
};
