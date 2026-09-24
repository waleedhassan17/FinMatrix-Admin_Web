// ═══════════════════════════════════════════════════════
// FinMatrix Admin — What can be done to a company
// ═══════════════════════════════════════════════════════
// Shared by the list, the detail page and the dashboard, so an action means
// the same thing — and sends the same status — wherever it is taken.

import { companyStage } from '@/models/platform';

/**
 * Each action and the status it sends. Deactivating sends `inactive`: the
 * server accepts `suspended` as a synonym but stores `inactive`.
 */
export const DECISIONS = {
  approve: { status: 'active', toast: 'Company approved' },
  reject: { status: 'rejected', toast: 'Company rejected' },
  deactivate: { status: 'inactive', toast: 'Company deactivated' },
  activate: { status: 'active', toast: 'Company activated' },
} as const;

export type CompanyAction = keyof typeof DECISIONS;

/** The minimum a decision needs to know about its company. */
export interface DecidableCompany {
  id: string;
  name: string;
  status: string;
}

/**
 * The actions a company's current state allows, primary first.
 *
 * Every state has a way out: awaiting approval → approve or reject; active →
 * deactivate; deactivated → activate; rejected → approve (a rejection can be
 * reconsidered without the owner registering again).
 */
export const actionsFor = (status: string): CompanyAction[] => {
  switch (companyStage(status)) {
    case 'pending':
      return ['approve', 'reject'];
    case 'active':
      return ['deactivate'];
    case 'inactive':
      return ['activate'];
    case 'rejected':
      return ['approve'];
  }
};

export const ACTION_LABEL: Record<CompanyAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  deactivate: 'Deactivate',
  activate: 'Activate',
};
