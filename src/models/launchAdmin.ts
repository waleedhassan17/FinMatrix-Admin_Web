// ═══════════════════════════════════════════════════════
// FinMatrix Admin — launch rules the console checks before asking the server
// ═══════════════════════════════════════════════════════
// Pure, so the dialogs and their tests agree. The server re-checks every one
// of these; the console checks first so an administrator is not sent a 400
// for something a form could have said.

import type { DemoStatus, PlanTerms } from '@/networks/superAdmin/launchAdminNetwork';

/** YYYY-MM-DD in Asia/Karachi (UTC+5, no daylight saving). */
export const pktDate = (d: Date = new Date()): string =>
  new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

/** `date` plus `months` calendar months (clamped to the month's last day). */
export const addMonths = (date: string, months: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
};

/** One-click end dates on the approve and activate dialogs. */
export const END_DATE_PRESETS = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
] as const;

export interface TermsDraft {
  asTrial: boolean;
  plan: string;
  startDate: string;
  endDate: string;
}

/**
 * The body for approve/activate, or the reason it cannot be sent yet. A
 * company is never switched on without either a trial or a plan with an end
 * date — the server refuses that too (PLAN_REQUIRED_FOR_APPROVAL).
 */
export function buildPlanTerms(
  draft: TermsDraft,
  today: string = pktDate(),
): { ok: true; terms: PlanTerms } | { ok: false; error: string } {
  if (draft.asTrial) return { ok: true, terms: { asTrial: true } };
  if (!draft.plan) return { ok: false, error: 'Choose a plan.' };
  if (draft.plan === 'free') return { ok: false, error: 'Free is not a plan you can approve onto any more.' };
  if (!draft.endDate) return { ok: false, error: 'Choose an end date.' };
  const start = draft.startDate || today;
  if (draft.endDate <= start) return { ok: false, error: 'The end date must be after the start date.' };
  if (draft.endDate <= today) return { ok: false, error: 'The end date must be in the future.' };
  return {
    ok: true,
    terms: {
      plan: draft.plan,
      ...(draft.startDate ? { startDate: draft.startDate } : {}),
      endDate: draft.endDate,
    },
  };
}

/** The demo pipeline's allowed moves — the server's DEMO_TRANSITIONS. */
export const DEMO_TRANSITIONS: Record<DemoStatus, readonly DemoStatus[]> = {
  new: ['contacted', 'scheduled', 'lost'],
  contacted: ['scheduled', 'lost'],
  scheduled: ['completed', 'no_show', 'rescheduled', 'lost'],
  rescheduled: ['scheduled', 'lost'],
  no_show: ['rescheduled', 'lost'],
  completed: ['converted', 'lost'],
  converted: [],
  lost: [],
};

export const DEMO_STATUS_LABEL: Record<DemoStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  scheduled: 'Scheduled',
  rescheduled: 'Rescheduled',
  no_show: 'No-show',
  completed: 'Completed',
  converted: 'Converted',
  lost: 'Lost',
};

/** Status buttons in the drawer: moves made by a plain status change. */
export const statusMovesFor = (s: DemoStatus): DemoStatus[] =>
  DEMO_TRANSITIONS[s].filter((t) => t !== 'scheduled' && t !== 'rescheduled');

/** Whether a scheduling form applies: first scheduling, or a new time. */
export const schedulingFor = (s: DemoStatus): 'schedule' | 'reschedule' | null =>
  DEMO_TRANSITIONS[s].includes('scheduled')
    ? s === 'rescheduled' || s === 'no_show'
      ? 'reschedule'
      : 'schedule'
    : DEMO_TRANSITIONS[s].includes('rescheduled')
      ? 'reschedule'
      : null;

/** Typed confirmation for a permanent delete: exact match, nothing looser. */
export const confirmationMatches = (typed: string, expected: string): boolean =>
  typed.trim() === expected.trim() && expected.trim().length > 0;

/** Bulk delete is only for companies flagged demo/test (the server refuses otherwise). */
export const bulkDeleteAllowed = (rows: Array<{ isDemo?: boolean }>): boolean =>
  rows.length > 0 && rows.every((r) => r.isDemo === true);

/** WhatsApp link for a Pakistani number in any spelling. */
export const waLink = (phone: string): string => `https://wa.me/${phone.replace(/\D/g, '')}`;
