// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Platform model
// ═══════════════════════════════════════════════════════
// The shapes /super-admin/* returns, carried over from the app's
// models/superAdminModel.ts so both consoles read the API identically.

export interface PlatformStats {
  companies: {
    total: number;
    pending: number;
    active: number;
    suspended: number;
    rejected: number;
    recentWeek: number;
  };
  subscriptions: {
    totalPlans: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
  };
  recentRegistrations: {
    id: string;
    name: string;
    industry: string | null;
    email: string | null;
    status: string;
    createdAt: string;
  }[];
}

export interface CompanyListItem {
  id: string;
  name: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  rejectionReason: string | null;
  memberCount: number;
  planName: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  maxUsers: number;
  maxInvoices: number | null;
  features: string[] | null;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  // Three-tier model, served from the server's PLAN_CONFIG.
  companyType?: 'small_business' | 'large_org' | 'warehouse' | null;
  durationMonths?: number | null;
  monthlyLabel?: string;
  totalLabel?: string;
  currency?: string;
  deliveryPersonnelLimit?: number;
}

/** A page of a paginated list, already unwrapped from the server envelope. */
export interface PaginatedList<T> {
  data: T[];
  total: number;
}

// ─── Company status ─────────────────────────────────
/**
 * The statuses the Companies filter offers. `all` is a client-side concept —
 * it means "send no status param" — which is why it is separated below.
 */
export const COMPANY_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Rejected', value: 'rejected' },
] as const;

export type CompanyFilter = (typeof COMPANY_FILTERS)[number]['value'];

export const isCompanyFilter = (v: unknown): v is CompanyFilter =>
  COMPANY_FILTERS.some((f) => f.value === v);

/** `all` is not a server value — it means "no status filter". */
export const statusParamFor = (filter: CompanyFilter): string | undefined =>
  filter === 'all' ? undefined : filter;

/**
 * The canned rejection reasons, carried over verbatim from the app. A reviewer
 * picks one or types their own; the reason reaches the owner, so the wording is
 * chosen rather than improvised at 2am.
 */
export const REJECT_REASONS = [
  'Incomplete documentation',
  'Invalid business information',
  'Duplicate registration',
  'Policy violation',
  'Suspicious activity',
] as const;
