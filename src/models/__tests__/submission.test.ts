import { describe, expect, it } from 'vitest';

import {
  hasViewableScreenshot,
  isTrialSubmission,
  KIND_PARAM,
  type PaymentSubmissionView,
} from '@/models/submission';
import { isOverdue, TRIAL_REVIEW_WARN_HOURS, waitingLabel } from '@/models/trial';

const submission = (
  over: Partial<PaymentSubmissionView> = {},
): PaymentSubmissionView => ({
  id: 's1',
  companyId: 'c1',
  companyName: 'Metro Traders',
  plan: 'warehouse_growth_6mo',
  planLabel: 'Growth · 6 months',
  kind: 'NEW',
  status: 'submitted',
  amountMinorUnits: 4500_00,
  amountLabel: 'Rs 4,500.00',
  currency: 'Rs ',
  hasScreenshot: true,
  rejectionReason: null,
  reviewedAt: null,
  createdAt: '2025-03-01T00:00:00.000Z',
  ...over,
});

describe('trial rows are not payment rows', () => {
  it('recognises a trial by kind', () => {
    expect(isTrialSubmission(submission({ kind: 'TRIAL' }))).toBe(true);
    expect(isTrialSubmission(submission({ kind: 'NEW' }))).toBe(false);
  });

  // The regression this screen keeps having: a trial rendered as a payment,
  // showing "Rs 0" and a screenshot link that 404s. A trial has neither.
  it('never offers a screenshot for a trial, even if the flag is set', () => {
    expect(
      hasViewableScreenshot(submission({ kind: 'TRIAL', hasScreenshot: true })),
    ).toBe(false);
  });

  it('offers a screenshot for a payment only when one was uploaded', () => {
    expect(hasViewableScreenshot(submission({ hasScreenshot: true }))).toBe(true);
    expect(hasViewableScreenshot(submission({ hasScreenshot: false }))).toBe(false);
  });
});

describe('queue filters', () => {
  // 'all' must send NO kind param — sending kind=all would filter everything out.
  it('maps all to no parameter', () => {
    expect(KIND_PARAM.all).toBeUndefined();
    expect(KIND_PARAM.payments).toBe('PAYMENT');
    expect(KIND_PARAM.trials).toBe('TRIAL');
  });
});

describe('waitingLabel', () => {
  it('reads minutes under the hour, never "0 min"', () => {
    expect(waitingLabel(0.5)).toBe('30 min');
    expect(waitingLabel(0)).toBe('1 min');
  });

  it('reads whole hours under a day', () => {
    expect(waitingLabel(3.8)).toBe('3 h');
    expect(waitingLabel(23.9)).toBe('23 h');
  });

  it('reads days and hours beyond that, dropping a zero hour', () => {
    expect(waitingLabel(25)).toBe('1 d 1 h');
    expect(waitingLabel(48)).toBe('2 d');
  });
});

describe('isOverdue', () => {
  // Owners are promised activation within 24 hours; flag it before that breaks.
  it('flags a request at the warn threshold', () => {
    expect(isOverdue(TRIAL_REVIEW_WARN_HOURS)).toBe(true);
    expect(isOverdue(TRIAL_REVIEW_WARN_HOURS - 1)).toBe(false);
  });

  it('is false when the age is unknown', () => {
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue(undefined)).toBe(false);
  });
});
