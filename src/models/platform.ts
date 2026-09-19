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
  // The server has always sent these three and neither console modelled them,
  // so a company on a free trial looked identical to a paying one.
  isTrial: boolean;
  trialStartedAt: string | null;
  trialConvertedAt: string | null;
}

export type CompanyType = 'small_business' | 'large_org' | 'warehouse';

/** A member row on the company detail payload. */
export interface CompanyMember {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
  joinedAt: string | null;
}

/** A row of the legacy company_subscriptions table. */
export interface CompanySubscription {
  id: string;
  companyId: string;
  planId: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt?: string;
  // Present on /super-admin/subscriptions, which joins the company in.
  companyName?: string;
  companyEmail?: string;
  plan?: SubscriptionPlan | null;
}

/**
 * GET /super-admin/companies/:id. This is the company ENTITY plus a status and
 * two joined collections -- NOT a CompanyListItem, which is what the call was
 * typed as. memberCount and planName do not exist here, so a detail view built
 * against the list type renders undefined in two columns.
 */
export interface CompanyDetail {
  id: string;
  name: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdBy: string | null;
  inviteCode: string | null;
  companyType: CompanyType | null;
  inventoryEnabled: boolean | null;
  allFeaturesUnlocked: boolean | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiryDate: string | null;
  paymentStatus: string | null;
  isTrial: boolean;
  trialStartedAt: string | null;
  trialConvertedAt: string | null;
  members: CompanyMember[];
  subscriptions: CompanySubscription[];
}

/** What PATCH /super-admin/companies/:id/status actually returns. */
export interface CompanyStatusResult {
  id: string;
  name: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

/**
 * PATCH /super-admin/companies/:id/feature-override. Every field is optional --
 * the server applies only what it is sent. allFeaturesUnlocked is a kill
 * switch: it bypasses the feature guard before any plan logic runs.
 */
export interface FeatureOverrideInput {
  allFeaturesUnlocked?: boolean;
  companyType?: CompanyType;
  inventoryEnabled?: boolean;
}

export interface FeatureOverrideResult {
  id: string;
  name: string;
  companyType: CompanyType | null;
  inventoryEnabled: boolean | null;
  allFeaturesUnlocked: boolean | null;
}

/** POST /super-admin/subscriptions. Dates are ISO strings. */
export interface AssignSubscriptionInput {
  companyId: string;
  planId: string;
  startDate: string;
  endDate?: string;
  status?: 'active' | 'expired' | 'cancelled' | 'trial';
  notes?: string;
}

/** POST /admin/payment-submissions/run-expiry-scan. */
export interface ExpiryScanResult {
  remindersSent: number;
  expiringMarked: number;
  deactivated: number;
  scanned: number;
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

/**
 * A page of a paginated list, already unwrapped from the server envelope.
 *
 * The server's admin pagination block is { page, limit, total, pages }. Note
 * `pages` -- the rest of the API spells the same idea `totalPages`, so this is
 * an easy one to read straight past.
 */
export interface PaginatedList<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
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

// ─── Trial filter ───────────────────────────────────
/**
 * The server takes ?isTrial=true|false and ignores anything else. `all` means
 * "send no param", the same shape as the status filter above.
 */
export const TRIAL_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'On trial', value: 'trial' },
  { label: 'Never on trial', value: 'never' },
] as const;

export type TrialFilter = (typeof TRIAL_FILTERS)[number]['value'];

export const isTrialFilter = (v: unknown): v is TrialFilter =>
  TRIAL_FILTERS.some((f) => f.value === v);

export const trialParamFor = (filter: TrialFilter): boolean | undefined =>
  filter === 'all' ? undefined : filter === 'trial';

/**
 * The server ACCEPTS 'suspended' but STORES 'inactive', and the two render in
 * different colours -- suspended is danger-red, inactive neutral grey. Both
 * consoles say 'inactive' so a deactivated company reads the same everywhere;
 * 'suspended' stays accepted on the way in.
 */
export const normalizeCompanyStatus = (status: string | null | undefined): string =>
  status === 'suspended' ? 'inactive' : status === 'approved' ? 'active' : (status ?? 'pending');

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
