import { describe, expect, it } from 'vitest';

import {
  monthLabel,
  shareOfTotal,
  spansYears,
  toMonthlySeries,
  toRupees,
  trendPct,
  type RevenueMonth,
} from '@/models/revenue';

const m = (year: number, month: number, totalMinorUnits: number): RevenueMonth => ({
  year,
  month,
  totalMinorUnits,
});

describe('monthLabel', () => {
  // The server builds this field with getUTCMonth(), so 0 is January. Reading
  // it as 1-indexed shifts every label back by one and looks plausible.
  it('reads month as 0-indexed, the way the server sends it', () => {
    expect(monthLabel(m(2025, 0, 0))).toBe('Jan');
    expect(monthLabel(m(2025, 11, 0))).toBe('Dec');
  });

  it('adds the year only when asked', () => {
    expect(monthLabel(m(2025, 2, 0))).toBe('Mar');
    expect(monthLabel(m(2025, 2, 0), true)).toBe('Mar 2025');
  });

  it('does not throw on a month outside 0-11', () => {
    expect(monthLabel(m(2025, 12, 0))).toBe('—');
  });
});

describe('spansYears', () => {
  it('is true when the six-month window crosses a new year', () => {
    expect(spansYears([m(2024, 10, 0), m(2024, 11, 0), m(2025, 0, 0)])).toBe(true);
  });

  it('is false within one year, and for an empty series', () => {
    expect(spansYears([m(2025, 0, 0), m(2025, 1, 0)])).toBe(false);
    expect(spansYears([])).toBe(false);
  });
});

describe('toMonthlySeries', () => {
  it('converts minor units to rupees and keeps the server order', () => {
    const series = toMonthlySeries([m(2025, 0, 150_00), m(2025, 1, 300_00)]);
    expect(series.map((p) => p.value)).toEqual([150, 300]);
    expect(series.map((p) => p.label)).toEqual(['Jan', 'Feb']);
  });

  it('labels with the year once the window crosses one', () => {
    const series = toMonthlySeries([m(2024, 11, 0), m(2025, 0, 0)]);
    expect(series.map((p) => p.label)).toEqual(['Dec 2024', 'Jan 2025']);
  });

  it('survives a missing series rather than throwing', () => {
    expect(toMonthlySeries(undefined)).toEqual([]);
    expect(toMonthlySeries(null)).toEqual([]);
  });
});

describe('trendPct', () => {
  it('compares the latest month with the one before it', () => {
    expect(trendPct([m(2025, 0, 100_00), m(2025, 1, 150_00)])).toBe(50);
    expect(trendPct([m(2025, 0, 200_00), m(2025, 1, 150_00)])).toBe(-25);
  });

  // "Up 100%" from nothing says nothing, and dividing by zero says less.
  it('is null when the previous month collected nothing', () => {
    expect(trendPct([m(2025, 0, 0), m(2025, 1, 150_00)])).toBeNull();
  });

  it('is null when there is nothing to compare against', () => {
    expect(trendPct([m(2025, 1, 150_00)])).toBeNull();
    expect(trendPct([])).toBeNull();
    expect(trendPct(undefined)).toBeNull();
  });
});

describe('minor units', () => {
  it('divides paisa into rupees', () => {
    expect(toRupees(150_00)).toBe(150);
    expect(toRupees(1)).toBe(0.01);
  });
});

describe('shareOfTotal', () => {
  it('is a whole percentage', () => {
    expect(shareOfTotal(25, 100)).toBe(25);
  });

  it('is 0 rather than NaN when nothing has been collected', () => {
    expect(shareOfTotal(0, 0)).toBe(0);
  });
});
