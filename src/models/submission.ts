// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Payment submission model
// ═══════════════════════════════════════════════════════
// The reviewer's side of the manual bank-transfer flow: a tenant transfers the
// money, uploads a screenshot of the receipt, and this console decides it.
//
// A TRIAL row is the odd one out and the source of most of the rules below. It
// is a free-trial *request* sitting in the same queue: amount 0, no screenshot,
// and decided on who asked rather than on what was paid.

export type SubmissionKind = 'NEW' | 'RENEWAL' | 'UPGRADE' | 'TRIAL';
export type SubmissionStatus = 'submitted' | 'approved' | 'rejected';

/** Queue filter: a specific kind, or every non-trial payment. */
export type SubmissionKindFilter = SubmissionKind | 'PAYMENT';

export interface PaymentSubmissionView {
  id: string;
  companyId: string;
  companyName?: string;
  companyEmail?: string;
  plan: string;
  planLabel: string;
  kind: SubmissionKind;
  status: SubmissionStatus;
  amountMinorUnits: number;
  amountLabel: string;
  currency: string;
  hasScreenshot: boolean;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** Who asked. A trial row is decided on this, not on an amount. */
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  /** Hours waiting while still submitted; null once decided. */
  ageHours?: number | null;
}

export const isTrialSubmission = (
  s: PaymentSubmissionView | null | undefined,
): boolean => s?.kind === 'TRIAL';

/**
 * A trial row never has a receipt to show, and a payment row only has one if
 * the upload actually landed. Both conditions matter: offering a screenshot
 * link that 404s is worse than not offering one.
 */
export const hasViewableScreenshot = (s: PaymentSubmissionView): boolean =>
  !isTrialSubmission(s) && s.hasScreenshot;

// ─── Queue filters ──────────────────────────────────
export type KindKey = 'all' | 'payments' | 'trials';

export const KIND_FILTERS: { key: KindKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'payments', label: 'Payments' },
  { key: 'trials', label: 'Trials' },
];

/** `all` sends no kind param; the other two map onto the server's filter. */
export const KIND_PARAM: Record<KindKey, SubmissionKindFilter | undefined> = {
  all: undefined,
  payments: 'PAYMENT',
  trials: 'TRIAL',
};

export const isKindKey = (v: unknown): v is KindKey =>
  v === 'all' || v === 'payments' || v === 'trials';

export const STATUS_FILTERS: { key: SubmissionStatus; label: string }[] = [
  { key: 'submitted', label: 'Awaiting review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export const isSubmissionStatus = (v: unknown): v is SubmissionStatus =>
  v === 'submitted' || v === 'approved' || v === 'rejected';
