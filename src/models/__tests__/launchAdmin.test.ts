import { describe, expect, it } from 'vitest';

import {
  addMonths,
  buildPlanTerms,
  bulkDeleteAllowed,
  confirmationMatches,
  DEMO_TRANSITIONS,
  pktDate,
  schedulingFor,
  statusMovesFor,
  waLink,
} from '@/models/launchAdmin';

const TODAY = '2026-11-26';

describe('buildPlanTerms', () => {
  const draft = { asTrial: false, plan: 'warehouse_scale_1yr', startDate: '', endDate: '2027-11-26' };

  it('a trial needs nothing else', () => {
    expect(buildPlanTerms({ ...draft, plan: '', endDate: '', asTrial: true }, TODAY)).toEqual({ ok: true, terms: { asTrial: true } });
  });
  it('a plan with an end date; the start defaults to today on the server', () => {
    expect(buildPlanTerms(draft, TODAY)).toEqual({ ok: true, terms: { plan: 'warehouse_scale_1yr', endDate: '2027-11-26' } });
    expect(buildPlanTerms({ ...draft, startDate: '2026-12-01' }, TODAY)).toEqual({
      ok: true,
      terms: { plan: 'warehouse_scale_1yr', startDate: '2026-12-01', endDate: '2027-11-26' },
    });
  });
  it('refuses what the server would refuse', () => {
    expect(buildPlanTerms({ ...draft, plan: '' }, TODAY).ok).toBe(false);
    expect(buildPlanTerms({ ...draft, plan: 'free' }, TODAY).ok).toBe(false);
    expect(buildPlanTerms({ ...draft, endDate: '' }, TODAY).ok).toBe(false);
    expect(buildPlanTerms({ ...draft, endDate: TODAY }, TODAY).ok).toBe(false);
    expect(buildPlanTerms({ ...draft, startDate: '2027-12-01' }, TODAY).ok).toBe(false);
  });
});

describe('dates', () => {
  it('adds calendar months, clamping to the month end', () => {
    expect(addMonths('2026-11-26', 1)).toBe('2026-12-26');
    expect(addMonths('2026-11-26', 12)).toBe('2027-11-26');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
  });
  it('today is the Karachi calendar day', () => {
    expect(pktDate(new Date('2026-11-26T19:30:00.000Z'))).toBe('2026-11-27'); // 00:30 PKT
    expect(pktDate(new Date('2026-11-26T18:59:00.000Z'))).toBe('2026-11-26');
  });
});

describe('demo pipeline', () => {
  it('mirrors the server state machine', () => {
    expect(DEMO_TRANSITIONS.new).toEqual(['contacted', 'scheduled', 'lost']);
    expect(DEMO_TRANSITIONS.converted).toEqual([]);
    expect(DEMO_TRANSITIONS.lost).toEqual([]);
  });
  it('status buttons leave scheduling to the scheduling form', () => {
    expect(statusMovesFor('new')).toEqual(['contacted', 'lost']);
    expect(statusMovesFor('scheduled')).toEqual(['completed', 'no_show', 'lost']);
    expect(schedulingFor('new')).toBe('schedule');
    expect(schedulingFor('scheduled')).toBe('reschedule');
    expect(schedulingFor('no_show')).toBe('reschedule');
    expect(schedulingFor('completed')).toBeNull();
  });
  it('WhatsApp links use digits only', () => {
    expect(waLink('+92 300-123 4567')).toBe('https://wa.me/923001234567');
  });
});

describe('deleting', () => {
  it('needs the name typed exactly', () => {
    expect(confirmationMatches('Karachi Traders', 'Karachi Traders')).toBe(true);
    expect(confirmationMatches('  Karachi Traders ', 'Karachi Traders')).toBe(true);
    expect(confirmationMatches('karachi traders', 'Karachi Traders')).toBe(false);
    expect(confirmationMatches('', '')).toBe(false);
  });
  it('bulk delete only when every selected company is demo/test', () => {
    expect(bulkDeleteAllowed([{ isDemo: true }, { isDemo: true }])).toBe(true);
    expect(bulkDeleteAllowed([{ isDemo: true }, { isDemo: false }])).toBe(false);
    expect(bulkDeleteAllowed([{}])).toBe(false);
    expect(bulkDeleteAllowed([])).toBe(false);
  });
});
