// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Platform revenue model
// ═══════════════════════════════════════════════════════
// What GET /admin/payment-submissions/revenue/summary returns, and the pure
// logic the Analytics page draws from it.
//
// EVERY amount here is in MINOR UNITS (paisa). The server also sends
// pre-formatted `*Label` strings for the headline figures; prefer those, and
// use `toRupees` only where a number is needed — a chart axis, a percentage.

export interface RevenueEntry {
  id: string;
  submissionId: string;
  companyId: string;
  companyName: string;
  plan: string;
  planLabel: string;
  amountMinorUnits: number;
  amountLabel: string;
  currency: string;
  recordedAt: string;
}

export interface RevenueByPlan {
  plan: string;
  planLabel: string;
  payments: number;
  totalMinorUnits: number;
}

export interface RevenueByCompany {
  companyId: string;
  companyName: string;
  payments: number;
  totalMinorUnits: number;
  lastPlan: string;
}

/**
 * One month of collected revenue.
 *
 * `month` is 0-INDEXED. The server builds it with `getUTCMonth()`
 * (billing.service.ts), so January is 0 — feeding it to a 1-indexed formatter
 * shifts every label back by one and nothing looks obviously broken.
 */
export interface RevenueMonth {
  year: number;
  month: number;
  totalMinorUnits: number;
}

export interface RevenueSummary {
  totalMinorUnits: number;
  totalLabel: string;
  thisMonthMinorUnits: number;
  thisMonthLabel: string;
  paymentsCount: number;
  pendingSubmissions: number;
  byPlan: RevenueByPlan[];
  byCompany: RevenueByCompany[];
  /** Exactly six months, oldest first, gap-filled, ending this month. */
  monthly: RevenueMonth[];
  /** The server caps this at the 50 most recent. */
  entries: RevenueEntry[];
}

/** Minor units (paisa) to rupees. */
export const toRupees = (minorUnits: number): number => minorUnits / 100;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * "Mar" for the chart axis, or "Mar 2025" when the series crosses a year.
 * Reads `month` as the 0-indexed value the server sends.
 */
export const monthLabel = (m: RevenueMonth, withYear = false): string => {
  const name = MONTH_NAMES[m.month] ?? '—';
  return withYear ? `${name} ${m.year}` : name;
};

/** A six-month window can straddle a new year; say so when it does. */
export const spansYears = (months: RevenueMonth[]): boolean =>
  months.length > 0 && months.some((m) => m.year !== months[0].year);

export interface MonthlyPoint {
  label: string;
  value: number;
  minorUnits: number;
}

/** The series the chart draws: rupees, labelled, oldest first. */
export const toMonthlySeries = (
  months: RevenueMonth[] | null | undefined,
): MonthlyPoint[] => {
  const list = months ?? [];
  const withYear = spansYears(list);
  return list.map((m) => ({
    label: monthLabel(m, withYear),
    value: toRupees(m.totalMinorUnits),
    minorUnits: m.totalMinorUnits,
  }));
};

/**
 * Change from the previous month to the latest, as a whole percentage.
 *
 * null when there is no previous month to compare against, or when that month
 * collected nothing — "up 100%" from zero says nothing, and "up ∞%" says less.
 */
export const trendPct = (months: RevenueMonth[] | null | undefined): number | null => {
  const list = months ?? [];
  if (list.length < 2) return null;
  const latest = list[list.length - 1].totalMinorUnits;
  const previous = list[list.length - 2].totalMinorUnits;
  if (previous <= 0) return null;
  return Math.round(((latest - previous) / previous) * 100);
};

/** Each plan's share of total collected revenue, for the breakdown bars. */
export const shareOfTotal = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) : 0;
