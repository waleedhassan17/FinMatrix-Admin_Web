// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Payment submission review (/admin/payment-submissions/*)
// ═══════════════════════════════════════════════════════

import {
  api,
  authedBlobUrl,
  toApiError,
  unwrapEnvelope,
} from '@/networks/network/apiHelpers';
import type {
  PaymentSubmissionView,
  SubmissionKindFilter,
  SubmissionStatus,
} from '@/models/submission';
import type { RevenueSummary } from '@/models/revenue';

export interface SubmissionQueryParams {
  status?: SubmissionStatus;
  kind?: SubmissionKindFilter;
  order?: 'asc' | 'desc';
}

export const listPaymentSubmissions = async (
  params: SubmissionQueryParams = {},
): Promise<PaymentSubmissionView[]> => {
  try {
    const response = await api.get('/admin/payment-submissions', { params });
    const body = unwrapEnvelope<
      PaymentSubmissionView[] | { data?: PaymentSubmissionView[] }
    >(response.data);
    if (Array.isArray(body)) return body;
    return Array.isArray(body?.data) ? body.data : [];
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPlatformRevenue = async (): Promise<RevenueSummary> => {
  try {
    const response = await api.get(
      '/admin/payment-submissions/revenue/summary',
    );
    return unwrapEnvelope<RevenueSummary>(response.data);
  } catch (e) {
    throw toApiError(e);
  }
};

export const approvePaymentSubmission = async (
  id: string,
): Promise<PaymentSubmissionView> => {
  try {
    const response = await api.patch(
      `/admin/payment-submissions/${id}/approve`,
    );
    return unwrapEnvelope<PaymentSubmissionView>(response.data);
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Reject a submission.
 *
 * `blockFutureTrials` applies to TRIAL requests only: false (the default) frees
 * the email and phone to ask again, true refuses them permanently. It is a
 * separate decision from the rejection itself, which is why the dialog asks for
 * it rather than inferring it.
 */
export const rejectPaymentSubmission = async (
  id: string,
  reason: string,
  blockFutureTrials?: boolean,
): Promise<PaymentSubmissionView> => {
  try {
    const response = await api.patch(`/admin/payment-submissions/${id}/reject`, {
      reason,
      ...(blockFutureTrials ? { blockFutureTrials: true } : {}),
    });
    return unwrapEnvelope<PaymentSubmissionView>(response.data);
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * An object URL for the transfer screenshot.
 *
 * The endpoint is auth-gated — the controller calls guardSuperAdmin, then pipes
 * the bytes with a Content-Type header. A plain <img src="…/screenshot"> sends
 * no Authorization header and gets a 401, so the image has to be fetched as a
 * blob with the interceptor's token and handed to <img> as a blob: URL.
 *
 * The caller owns the URL and MUST URL.revokeObjectURL it once the image is
 * gone, or every screenshot opened stays in memory for the life of the tab.
 */
export const getScreenshotUrl = async (id: string): Promise<string> => {
  try {
    return await authedBlobUrl(`/admin/payment-submissions/${id}/screenshot`);
  } catch (e) {
    throw toApiError(e);
  }
};
