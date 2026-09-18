// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Free-trial review helpers
// ═══════════════════════════════════════════════════════
// Ported verbatim from the app's src/utils/trial.ts so both consoles describe
// the same wait the same way.

/** "35 min", "3 h", "1 d 4 h". */
export const waitingLabel = (hours: number): string => {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${Math.floor(hours)} h`;
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours - d * 24);
  return h ? `${d} d ${h} h` : `${d} d`;
};

/**
 * Owners are told a trial is activated within 24 hours, so a request is flagged
 * before that promise is broken rather than after.
 */
export const TRIAL_REVIEW_WARN_HOURS = 20;

/** Has this request waited long enough to be worth chasing? */
export const isOverdue = (ageHours: number | null | undefined): boolean =>
  typeof ageHours === 'number' && ageHours >= TRIAL_REVIEW_WARN_HOURS;
