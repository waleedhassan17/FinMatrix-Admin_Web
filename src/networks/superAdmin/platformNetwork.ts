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
  CompanyListItem,
  PaginatedList,
  PlatformStats,
  SubscriptionPlan,
} from '@/models/platform';

/**
 * A paginated list arrives as { data, pagination: { total } } INSIDE the
 * envelope. Both halves are defended: an older server, or an endpoint that
 * forgets the pagination block, should show an empty table rather than throw
 * on `.length` of undefined.
 */
const paginated = <T>(raw: unknown): PaginatedList<T> => {
  const body = raw as
    | { data?: T[]; pagination?: { total?: number } }
    | T[]
    | undefined;
  if (Array.isArray(body)) return { data: body, total: body.length };
  const data = Array.isArray(body?.data) ? body.data : [];
  return { data, total: body?.pagination?.total ?? data.length };
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
}

export const getCompanies = async (
  params: CompanyQueryParams = {},
): Promise<PaginatedList<CompanyListItem>> => {
  try {
    const response = await api.get('/super-admin/companies', { params });
    return paginated<CompanyListItem>(unwrapEnvelope(response.data));
  } catch (e) {
    throw toApiError(e);
  }
};

export const getCompanyDetail = async (id: string): Promise<CompanyListItem> => {
  try {
    const response = await api.get(`/super-admin/companies/${id}`);
    return unwrapEnvelope<CompanyListItem>(response.data);
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
): Promise<CompanyListItem> => {
  try {
    const response = await api.patch(`/super-admin/companies/${id}/status`, {
      status,
      ...(rejectionReason ? { rejectionReason } : {}),
    });
    return unwrapEnvelope<CompanyListItem>(response.data);
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
