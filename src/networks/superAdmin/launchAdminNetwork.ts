// ═══════════════════════════════════════════════════════
// FinMatrix Admin — trials, approvals, demos, migrations, account control
// ═══════════════════════════════════════════════════════
// The launch endpoints. List payloads use `items` (the response envelope
// unwraps a top-level `data`), so each list keeps its pagination.
//
//   /admin/trials, /admin/trials/counts             Trials & approvals
//   /admin/companies/:id/{extend,end,grant}-trial   trial actions
//   /admin/companies/:id/{approve,activate,suspend,reinstate}
//   /admin/payment-submissions/:id/{approve,reject} held trials, activations
//   /admin/demo-requests…                           Book a Demo pipeline
//   /admin/migrations…                              read-only Migration Center
//   /admin/users…, /admin/companies/:id/…           suspend / delete / demo flag

import { api, toApiError, unwrapEnvelope } from '@/networks/network/apiHelpers';

const call = async <T>(p: Promise<{ data: unknown }>): Promise<T> => {
  try {
    return unwrapEnvelope<T>((await p).data);
  } catch (e) {
    throw toApiError(e);
  }
};

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ── Plan terms ──

/** What approving or activating a company needs: a plan and an end date, or a trial. */
export interface PlanTerms {
  plan?: string;
  startDate?: string;
  endDate?: string;
  asTrial?: boolean;
}

export interface OfferedPlan {
  key: string;
  label: string;
}

export const getOfferedPlans = async (): Promise<OfferedPlan[]> => {
  const raw = await call<unknown>(api.get('/super-admin/plans/public'));
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { plans?: unknown[] })?.plans)
      ? (raw as { plans: unknown[] }).plans
      : [];
  return list
    .map((p) => p as { key?: string; id?: string; label?: string; name?: string })
    .map((p) => ({ key: p.key ?? p.id ?? '', label: p.label ?? p.name ?? '' }))
    .filter((p) => p.key && p.label);
};

export const approveCompany = (id: string, terms: PlanTerms) =>
  call(api.patch(`/admin/companies/${id}/approve`, terms));
export const activateCompany = (id: string, terms: PlanTerms) =>
  call(api.patch(`/admin/companies/${id}/activate`, terms));
export const rejectCompany = (id: string, reason: string) =>
  call(api.patch(`/admin/companies/${id}/reject`, { reason }));
export const suspendCompany = (id: string, reason: string) =>
  call(api.patch(`/admin/companies/${id}/suspend`, { reason }));
export const reinstateCompany = (id: string) => call(api.patch(`/admin/companies/${id}/reinstate`, {}));

// ── Trials & approvals ──

export type TrialView = 'active' | 'held' | 'approvals' | 'activations' | 'ended';

export interface TrialRow {
  companyId: string;
  companyName: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerEmailVerified: boolean;
  phone: string | null;
  businessType: string | null;
  status: string;
  isDemo: boolean;
  fromDemo: boolean;
  autoApproved: boolean;
  startedAt: string | null;
  endsAt: string | null;
  daysLeft: number | null;
  plan: string;
  planLabel: string;
  requestedPlan: string | null;
  requestedPlanLabel: string | null;
  approvalNote: string | null;
  submittedAt: string | null;
  submissionId: string | null;
  holdReason: string | null;
  activationRequestedPlan: string | null;
  activationRequestedPlanLabel: string | null;
  activationNote: string | null;
  matchedClaims: Array<Record<string, unknown>>;
}

export interface TrialList {
  view: TrialView;
  items: TrialRow[];
  pagination: Pagination;
}

export const listTrials = (params: { view: TrialView; search?: string; page?: number; limit?: number }) =>
  call<TrialList>(api.get('/admin/trials', { params }));

export interface TrialCounts {
  activeTrials: number;
  trialsEndingIn7Days: number;
  heldTrials: number;
  approvalRequests: number;
  activationRequests: number;
}

export const getTrialCounts = () => call<TrialCounts>(api.get('/admin/trials/counts'));

export const extendTrial = (id: string, days: number, reason: string) =>
  call(api.post(`/admin/companies/${id}/extend-trial`, { days, reason }));
export const endTrial = (id: string, reason: string) =>
  call(api.post(`/admin/companies/${id}/end-trial`, { reason }));
export const grantTrial = (id: string, reason: string) =>
  call(api.post(`/admin/companies/${id}/grant-trial`, { reason }));

/** Held trials and activation requests are review-queue submissions. */
export const approveSubmission = (submissionId: string, terms: PlanTerms = {}) =>
  call(api.patch(`/admin/payment-submissions/${submissionId}/approve`, terms));
export const rejectSubmission = (submissionId: string, reason: string, blockFutureTrials = false) =>
  call(api.patch(`/admin/payment-submissions/${submissionId}/reject`, { reason, blockFutureTrials }));

export interface TrialClaim {
  id: string;
  status: string;
  source: string | null;
  releaseReason: string | null;
  createdAt: string;
  companyName: string | null;
  sameCompany: boolean;
  sameUser: boolean;
}

export const getTrialClaims = (companyId: string) =>
  call<TrialClaim[] | { items: TrialClaim[] }>(api.get(`/admin/companies/${companyId}/trial-claims`)).then((r) =>
    Array.isArray(r) ? r : (r.items ?? []),
  );

export interface AdminEligibility {
  eligible: boolean;
  reason: string | null;
  message: string | null;
}

export const getAdminTrialEligibility = (companyId: string) =>
  call<AdminEligibility>(api.get(`/admin/companies/${companyId}/trial-eligibility`));

// ── Book a Demo ──

export type DemoStatus =
  | 'new'
  | 'contacted'
  | 'scheduled'
  | 'rescheduled'
  | 'no_show'
  | 'completed'
  | 'converted'
  | 'lost';

export interface DemoRequest {
  id: string;
  createdAt: string;
  status: DemoStatus;
  fullName: string;
  businessName: string;
  phone: string;
  email: string;
  city: string;
  businessType: string;
  teamSize: string | null;
  currentSystem: string | null;
  preferredSlotAt: string | null;
  message: string | null;
  utm: Record<string, string> | null;
  referrer: string | null;
  landingPath: string | null;
  source: string | null;
  scheduledAt: string | null;
  meetingLink: string | null;
  assignedTo: string | null;
  lostReason: string | null;
  convertedCompanyId: string | null;
  convertedAt: string | null;
  inviteSentAt: string | null;
  reminderSentAt: string | null;
}

export interface DemoDetail extends DemoRequest {
  notes: Array<{ id: string; body: string; authorId: string | null; createdAt: string }>;
  history: Array<{ action: string; at: string; actorUserId: string | null; details: unknown; reason: string | null }>;
  suggestedCompanies: Array<{ id: string; name: string; status: string }>;
}

export interface DemoList {
  items: DemoRequest[];
  counts: Partial<Record<DemoStatus, number>>;
  pagination: Pagination;
}

export interface DemoFilter {
  status?: string;
  city?: string;
  businessType?: string;
  currentSystem?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export const listDemoRequests = (params: DemoFilter) => call<DemoList>(api.get('/admin/demo-requests', { params }));
export const getDemoRequest = (id: string) => call<DemoDetail>(api.get(`/admin/demo-requests/${id}`));
export const setDemoStatus = (id: string, status: DemoStatus, reason?: string) =>
  call<DemoRequest>(api.patch(`/admin/demo-requests/${id}/status`, { status, ...(reason ? { reason } : {}) }));
export const scheduleDemo = (id: string, scheduledAt: string, meetingLink?: string, reschedule = false) =>
  call<DemoRequest>(
    api.post(`/admin/demo-requests/${id}/${reschedule ? 'reschedule' : 'schedule'}`, {
      scheduledAt,
      ...(meetingLink ? { meetingLink } : {}),
    }),
  );
export const addDemoNote = (id: string, body: string) => call(api.post(`/admin/demo-requests/${id}/notes`, { body }));
export const linkDemoCompany = (id: string, companyId: string) =>
  call(api.post(`/admin/demo-requests/${id}/link-company`, { companyId }));
export const sendDemoTrialInvite = (id: string) =>
  call<DemoRequest & { signupUrl: string; trialEligible: boolean }>(api.post(`/admin/demo-requests/${id}/trial-invite`, {}));

/** The CSV of the current filter, as a download. */
export const exportDemoCsv = async (params: DemoFilter): Promise<Blob> => {
  try {
    const res = await api.get('/admin/demo-requests/export.csv', { params, responseType: 'blob' });
    return res.data as Blob;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── Migration Center (read-only) ──

export interface MigrationSummary {
  id: string;
  reference: string;
  companyId: string;
  companyName: string | null;
  sourceSystem: string;
  cutoverDate: string;
  status: string;
  readiness: number;
  files: number;
  openIssues: number;
  checksPassed: number | null;
  checksTotal: number | null;
  stuck: boolean;
  aiCalls: number;
  createdAt: string;
  updatedAt: string;
  signedOffAt: string | null;
}

export interface MigrationDetail extends MigrationSummary {
  issuesByCode: Array<{ code: string; severity: string; open: number; resolved: number }>;
  checks: Array<{ code: string; label: string; expected: string; actual: string; difference: string; passed: boolean }>;
}

export const listMigrations = (params: { status?: string; stuck?: boolean; q?: string; companyId?: string; page?: number; limit?: number }) =>
  call<{ items: MigrationSummary[]; pagination: Pagination }>(api.get('/admin/migrations', { params }));
export const getMigrationCounts = () =>
  call<{ inProgress: number; stuck: number; awaitingClose: number }>(api.get('/admin/migrations/counts'));
export const getMigration = (id: string) => call<MigrationDetail>(api.get(`/admin/migrations/${id}`));

// ── Users and account control ──

export interface AdminUser {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  memberships: Array<{ companyId: string; companyName: string; role: string }> | null;
}

export const searchUsers = (params: { q?: string; page?: number; limit?: number }) =>
  call<{ items: AdminUser[]; pagination: Pagination }>(api.get('/admin/users', { params }));
export const suspendUser = (id: string, reason: string) => call(api.patch(`/admin/users/${id}/suspend`, { reason }));
export const reinstateUser = (id: string) => call(api.patch(`/admin/users/${id}/reinstate`, {}));
export const deleteUser = (id: string, input: { confirmEmail: string; reason: string; allowNewTrial: boolean }) =>
  call(api.delete(`/admin/users/${id}`, { data: input }));

export const setCompanyDemo = (id: string, isDemo: boolean) =>
  call<{ id: string; name: string; isDemo: boolean }>(api.patch(`/admin/companies/${id}/demo`, { isDemo }));

export interface DeletionPreview {
  companyId: string;
  companyName: string;
  isDemo: boolean;
  rowCounts: Record<string, number>;
  totalRows: number;
  files: number;
  postedEntries: number;
  finalBackup: boolean;
  usersDeleted: number;
  membershipsRemoved: number;
  allowNewTrialDefault: boolean;
}

export const getDeletionPreview = (id: string) =>
  call<DeletionPreview>(api.get(`/admin/companies/${id}/deletion-preview`));

export interface DeletionJob {
  id: string;
  companyId: string;
  companyName: string;
  status: string;
  backupRequired: boolean;
  finalBackupId: string | null;
  rowCounts: Record<string, number> | null;
  filesDeleted: number | null;
  filesFailed: number | null;
  usersDeleted: number | null;
  membershipsRemoved: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export const deleteCompany = (id: string, input: { confirmName: string; reason: string; allowNewTrial: boolean }) =>
  call<DeletionJob>(api.delete(`/admin/companies/${id}`, { data: input }));
export const getDeletionJob = (jobId: string) => call<DeletionJob>(api.get(`/admin/company-deletions/${jobId}`));

export const bulkCompanies = (input: { action: 'suspend' | 'delete'; ids: string[]; reason: string }) =>
  call<{ action: 'suspend' | 'delete'; jobs?: DeletionJob[]; results?: Array<Record<string, unknown>> }>(
    api.post('/admin/companies/bulk', input),
  );

export interface DeletedAccount {
  id: string;
  action: string;
  at: string;
  actorUserId: string | null;
  actorLabel: string | null;
  companyId: string | null;
  companyName: string | null;
  reason: string | null;
  details: Record<string, unknown> | null;
  finalBackup: { id: string; sizeBytes: number; expiresAt: string } | null;
}

export const listDeletedAccounts = () =>
  call<DeletedAccount[] | { items: DeletedAccount[] }>(api.get('/admin/deleted-accounts')).then((r) =>
    Array.isArray(r) ? r : (r.items ?? []),
  );

export const downloadFinalBackup = async (backupId: string): Promise<Blob> => {
  try {
    const res = await api.get(`/admin/deleted-accounts/backups/${backupId}/download`, { responseType: 'blob' });
    return res.data as Blob;
  } catch (e) {
    throw toApiError(e);
  }
};
