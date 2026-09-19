// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Platform network (/super-admin/*)
// ═══════════════════════════════════════════════════════
// Plain async functions, no hooks — pages call these from useQuery/useMutation.
// Every response goes through unwrapEnvelope, because the server wraps
// successes as { success: true, data } (response-envelope.interceptor.ts).

import {
  api,
  toApiError,
  unwrapEnvelope,
} from '@/networks/network/apiHelpers';
import type {
  AssignSubscriptionInput,
  CompanyDetail,
  CompanyListItem,
  CompanyStatusResult,
  CompanySubscription,
  FeatureOverrideInput,
  FeatureOverrideResult,
  PaginatedList,
  PlatformStats,
  SubscriptionPlan,
} from '@/models/platform';

/**
 * A paginated list arrives as { data, pagination: { page, limit, total, pages } }
 * INSIDE the envelope. Every half is defended: an older server, or an endpoint
 * that forgets the pagination block, should show an empty table rather than
 * throw on `.length` of undefined.
 *
 * The page-count key is `pages`. Most of this API spells the same idea
 * `totalPages`, so both are read -- but `pages` is what the admin endpoints
 * actually send, and reading only `totalPages` yields a silent NaN.
 */
const paginated = <T>(raw: unknown, fallbackLimit = 20): PaginatedList<T> => {
  const body = raw as
    | {
        data?: T[];
        pagination?: {
          page?: number;
          limit?: number;
          total?: number;
          pages?: number;
          totalPages?: number;
        };
      }
    | T[]
    | undefined;

  if (Array.isArray(body)) {
    return {
      data: body,
      total: body.length,
      page: 1,
      limit: body.length || fallbackLimit,
      pages: 1,
    };
  }

  const data = Array.isArray(body?.data) ? body.data : [];
  const p = body?.pagination;
  const total = p?.total ?? data.length;
  const limit = p?.limit ?? fallbackLimit;
  return {
    data,
    total,
    page: p?.page ?? 1,
    limit,
    pages: p?.pages ?? p?.totalPages ?? Math.max(1, Math.ceil(total / (limit || 1))),
  };
};

/**
 * page/limit go through the server's ParseIntPipe, which has no clamp and
 * throws 400 on an empty string. Anything undefined is dropped rather than
 * serialised as `?page=`.
 */
const cleanParams = (
  params: Record<string, unknown> | object,
): Record<string, string | number> => {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = typeof value === 'boolean' ? String(value) : (value as string | number);
  }
  return out;
};

export const getPlatformStats = async (): Promise<PlatformStats> => {
  try {
    const response = await api.get('/super-admin/stats');
    return unwrapEnvelope<PlatformStats>(response.data);
  } catch (e) {
    throw toApiError(e);
  }
};

export interface CompanyQueryParams {
  page?: number;
  limit?: number;
  /** Omit for "all" — the server treats a missing status as no filter. */
  status?: string;
  /** Omit for "all". Serialised as the strings 'true'/'false'. */
  isTrial?: boolean;
}

export const getCompanies = async (
  params: CompanyQueryParams = {},
): Promise<PaginatedList<CompanyListItem>> => {
  try {
    const response = await api.get('/super-admin/companies', {
      params: cleanParams(params),
    });
    return paginated<CompanyListItem>(unwrapEnvelope(response.data), params.limit ?? 20);
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * The company ENTITY plus a status and two joined collections — see
 * CompanyDetail. This was typed as CompanyListItem, which promises a
 * memberCount and a planName the endpoint does not send.
 */
export const getCompanyDetail = async (id: string): Promise<CompanyDetail> => {
  try {
    const response = await api.get(`/super-admin/companies/${id}`);
    return unwrapEnvelope<CompanyDetail>(response.data);
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Approve, reject, suspend or restore a company.
 *
 * `rejectionReason` reaches the owner verbatim, so it is required by the UI on
 * a rejection even though the server tolerates its absence.
 */
export const updateCompanyStatus = async (
  id: string,
  status: string,
  rejectionReason?: string,
): Promise<CompanyStatusResult> => {
  try {
    const response = await api.patch(`/super-admin/companies/${id}/status`, {
      status,
      ...(rejectionReason ? { rejectionReason } : {}),
    });
    return unwrapEnvelope<CompanyStatusResult>(response.data);
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * The feature kill switch.
 *
 * `allFeaturesUnlocked` bypasses the server's FeatureGuard before any plan or
 * company-type logic runs, so a company with it set sees everything regardless
 * of what it pays for. Every caller should confirm first and describe it by
 * effect rather than by field name.
 */
export const updateFeatureOverride = async (
  id: string,
  input: FeatureOverrideInput,
): Promise<FeatureOverrideResult> => {
  try {
    const response = await api.patch(
      `/super-admin/companies/${id}/feature-override`,
      input,
    );
    return unwrapEnvelope<FeatureOverrideResult>(response.data);
  } catch (e) {
    throw toApiError(e);
  }
};

export const listSubscriptions = async (
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedList<CompanySubscription>> => {
  try {
    const response = await api.get('/super-admin/subscriptions', {
      params: cleanParams(params),
    });
    return paginated<CompanySubscription>(
      unwrapEnvelope(response.data),
      params.limit ?? 20,
    );
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Assign a plan to a company, cancelling whatever active subscription it had.
 *
 * Worth knowing at the call site: this writes the legacy company_subscriptions
 * table, which is decoupled from the companies.subscription_plan columns that
 * actually gate access. Assigning here does NOT by itself activate a company.
 */
export const assignSubscription = async (
  input: AssignSubscriptionInput,
): Promise<CompanySubscription> => {
  try {
    const response = await api.post('/super-admin/subscriptions', input);
    return unwrapEnvelope<CompanySubscription>(response.data);
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * The plan catalogue. Read-only in practice: the server refuses writes with
 * PLANS_CONFIG_DEFINED because plans live in its own plan-config.ts, not in a
 * table an admin can edit.
 */
export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  try {
    const response = await api.get('/super-admin/plans');
    const body = unwrapEnvelope<SubscriptionPlan[] | { data?: SubscriptionPlan[] }>(
      response.data,
    );
    if (Array.isArray(body)) return body;
    return Array.isArray(body?.data) ? body.data : [];
  } catch (e) {
    throw toApiError(e);
  }
};
