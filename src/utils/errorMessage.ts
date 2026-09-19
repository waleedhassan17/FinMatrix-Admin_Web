// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Error messages
// ═══════════════════════════════════════════════════════
// Five pages each wrote `(error as Error)?.message ?? '…'`. That cast is a
// lie — a rejected query can carry anything, including a string, a plain
// object from the API, or undefined — and `unknown -> string` belongs in one
// place rather than five.

/**
 * A sentence fit to show an operator, or the fallback.
 *
 * Blank messages fall through to the fallback too: an empty string renders as
 * an empty red box, which tells the reader less than the fallback would.
 */
export const messageOf = (error: unknown, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error.trim() || fallback;

  if (typeof error === 'object') {
    const e = error as { message?: unknown };
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
  }

  return fallback;
};
