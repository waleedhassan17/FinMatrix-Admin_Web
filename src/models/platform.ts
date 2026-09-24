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
    /** Who registered it. Optional: a server predating the field omits it. */
    ownerName?: string | null;
    ownerEmail?: string | null;
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
  // The owner — who an administrator actually calls about a company. Optional
  // so a server that predates them still type-checks; the UI falls back to the
  // company's own email.
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  ownerEmailVerified?: boolean | null;
}

/** The person who registered the company (its `createdBy`). */
export interface CompanyOwner {
  id: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  isEmailVerified: boolean;
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
  /** Absent from a server that predates it. */
  owner?: CompanyOwner | null;
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

/**
 * What the console may change on a plan, in MINOR UNITS (paisa).
 *
 * Narrow on purpose. The plan key is a foreign key in every company row;
 * durationMonths is baked into the key ("_6mo") and into what existing
 * customers were sold; companyType moves the plan to another tier ladder; and
 * currency would silently reprice every past quote. None of those are here.
 *
 * Minor units all the way to the wire: converting a decimal rupee amount into
 * paisa at the boundary is how someone gets charged a rupee more than the
 * price they were shown.
 */
export interface UpdatePlanInput {
  label?: string;
  monthlyMinorUnits?: number;
  priceMinorUnits?: number;
  deliveryPersonnelLimit?: number;
  /** false retires the plan: sold to nobody new, unchanged for everyone on it. */
  isOffered?: boolean;
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
  /** Per-month price in MINOR UNITS — the editable number, not the label. */
  monthlyMinorUnits?: number;
  /** TOTAL charged up front for the period, in minor units. */
  totalMinorUnits?: number;
  monthlyLabel?: string;
  totalLabel?: string;
  currency?: string;
  deliveryPersonnelLimit?: number;
  /** Still sold to new customers. A retired plan keeps working for its members. */
  isOffered?: boolean;
  /** Whether an admin has changed anything from the configured default. */
  isEdited?: boolean;
  /** Which fields carry an override, for showing what was changed. */
  editedFields?: string[];
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
// Labelled for the decision, not the database value: "Awaiting approval" is
// the queue to work, "Deactivated" is what an administrator did to it.
export const COMPANY_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Awaiting approval', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Deactivated', value: 'inactive' },
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
 * What a company is waiting on, for deciding what can be done to it.
 *
 * A company that was created but never submitted (`email_verified`, `draft`,
 * `unverified`) sits in the same queue as a submitted one — the server's
 * "pending" filter includes it — and it needs the same decision. It used to
 * fall through every check and be offered "Reactivate".
 */
export type CompanyStage = 'pending' | 'active' | 'inactive' | 'rejected';

export const companyStage = (status: string | null | undefined): CompanyStage => {
  const s = normalizeCompanyStatus(status);
  if (s === 'active' || s === 'inactive' || s === 'rejected') return s;
  return 'pending';
};

/** A never-submitted company: in the queue, but the owner did not finish. */
export const isUnsubmitted = (status: string | null | undefined): boolean =>
  status === 'email_verified' || status === 'draft' || status === 'unverified';

/**
 * The badge wording for a company status. The database words ("inactive",
 * "email_verified") are not what an administrator did or is being asked to do.
 */
export const companyStatusLabel = (status: string | null | undefined): string => {
  if (isUnsubmitted(status)) return 'Not submitted';
  switch (companyStage(status)) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Deactivated';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Awaiting approval';
  }
};

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
