// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Trials & approvals
// ═══════════════════════════════════════════════════════
// Five queues, one per tab (in the URL, so the dashboard links straight in):
//   Active               running trials — days left, from a demo, auto/held
//   Held                 trials our risk checks held — approve or reject
//                        (optionally blocking future trials); matched claims
//   Approval requests    path B — approve with a plan and dates, or as a trial
//   Activation requests  "switch my plan on" — approve with plan terms
//   Ended                trials that ran out — data kept; extend or activate
// Every decision goes through the server, which re-checks it.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorBanner } from '@/components/layout/PageState';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, TablePager } from '@/components/ui/DataTable';
import { Textarea } from '@/components/ui/Field';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useCompanyDecision } from '@/features/companies/useCompanyDecision';
import { PlanTermsDialog } from '@/features/launch/PlanTermsDialog';
import { useSettle } from '@/features/platform/invalidation';
import {
  approveSubmission,
  getTrialCounts,
  listTrials,
  rejectSubmission,
  type PlanTerms,
  type TrialRow,
  type TrialView,
} from '@/networks/superAdmin/launchAdminNetwork';
import { formatDate, formatDateTime } from '@/utils/date';

const TABS: Array<{ view: TrialView; label: string; count: keyof Awaited<ReturnType<typeof getTrialCounts>> | null }> = [
  { view: 'active', label: 'Active', count: 'activeTrials' },
  { view: 'held', label: 'Held', count: 'heldTrials' },
  { view: 'approvals', label: 'Approval requests', count: 'approvalRequests' },
  { view: 'activations', label: 'Activation requests', count: 'activationRequests' },
  { view: 'ended', label: 'Ended', count: null },
];
const isView = (v: string | null): v is TrialView => TABS.some((t) => t.view === v);
const PAGE_SIZE = 20;

type Row = { row: { original: TrialRow } };
type Decision = { row: TrialRow; kind: 'approve-held' | 'reject-held' | 'approve-activation' | 'reject-activation' };

export function TrialsPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { afterCompanyDecision } = useSettle();
  const { request, dialogs } = useCompanyDecision();
  const view: TrialView = isView(params.get('view')) ? (params.get('view') as TrialView) : 'active';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [block, setBlock] = useState(false);

  useEffect(() => {
    const next = text.trim();
    if (next === q) return;
    const t = setTimeout(() => setParams({ view, ...(next ? { q: next } : {}) }, { replace: true }), 300);
    return () => clearTimeout(t);
  }, [text, q, view, setParams]);

  const counts = useQuery({ queryKey: ['trials', 'counts'], queryFn: getTrialCounts });
  const list = useQuery({
    queryKey: ['trials', 'list', { view, page, q }],
    queryFn: () => listTrials({ view, page, limit: PAGE_SIZE, search: q || undefined }),
    placeholderData: keepPreviousData,
  });

  const settle = (companyId: string) => {
    afterCompanyDecision(companyId);
    void queryClient.invalidateQueries({ queryKey: ['trials'] });
  };

  const decide = useMutation({
    mutationFn: async ({ d, terms }: { d: Decision; terms?: PlanTerms | null }) => {
      const id = d.row.submissionId;
      if (!id) throw new Error('This request has no submission to decide on.');
      if (d.kind === 'approve-held') return approveSubmission(id);
      if (d.kind === 'approve-activation') return approveSubmission(id, terms ?? {});
      return rejectSubmission(id, reason.trim(), d.kind === 'reject-held' && block);
    },
    onSuccess: (_r, { d }) => {
      toast.success(d.kind.startsWith('approve') ? 'Approved' : 'Rejected', { description: d.row.companyName });
      settle(d.row.companyId);
      setDecision(null);
      setReason('');
      setBlock(false);
    },
    onError: (e: Error) => toast.error('Could not record the decision', { description: e.message }),
  });

  const owner = (r: TrialRow) => (
    <div className="min-w-0">
      <p className="truncate text-body-sm text-text-primary">{r.ownerName ?? '—'}</p>
      <p className="truncate text-caption text-text-secondary">
        {r.ownerEmail ?? '—'}
        {r.phone ? ` · ${r.phone}` : ''}
      </p>
    </div>
  );

  const company = {
    header: 'Company',
    id: 'company',
    cell: ({ row }: Row) => (
      <div className="min-w-0">
        <Link to={`/companies/${row.original.companyId}`} className="block truncate text-label-lg text-text-primary hover:text-primary hover:underline">
          {row.original.companyName}
        </Link>
        <p className="flex flex-wrap gap-xxs text-caption text-text-secondary">
          {row.original.businessType ?? ''}
          {row.original.fromDemo && <StatusBadge status="active" label="From demo" />}
          {row.original.isDemo && <StatusBadge status="draft" label="Demo" />}
        </p>
      </div>
    ),
  };

  const columnsFor = (v: TrialView) => {
    const base = [company, { header: 'Owner', id: 'owner', cell: ({ row }: Row) => owner(row.original) }];
    if (v === 'active' || v === 'ended') {
      return [
        ...base,
        { header: 'Started', id: 'started', cell: ({ row }: Row) => (row.original.startedAt ? formatDate(row.original.startedAt) : '—') },
        { header: 'Ends', id: 'ends', cell: ({ row }: Row) => (row.original.endsAt ? formatDate(row.original.endsAt) : '—') },
        {
          header: v === 'active' ? 'Days left' : 'Path',
          id: 'days',
          cell: ({ row }: Row) =>
            v === 'active' ? (
              <span className={row.original.daysLeft !== null && row.original.daysLeft <= 3 ? 'text-warning' : ''}>
                {row.original.daysLeft ?? '—'}
              </span>
            ) : row.original.autoApproved ? (
              'Instant'
            ) : (
              'Reviewed'
            ),
        },
        {
          header: '',
          id: 'actions',
          cell: ({ row }: Row) => (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/companies/${row.original.companyId}`}>{v === 'active' ? 'Extend / end' : 'Extend / activate'}</Link>
            </Button>
          ),
        },
      ];
    }
    if (v === 'held') {
      return [
        ...base,
        { header: 'Requested', id: 'when', cell: ({ row }: Row) => (row.original.submittedAt ? formatDateTime(row.original.submittedAt) : '—') },
        {
          header: 'Why held',
          id: 'hold',
          cell: ({ row }: Row) => (
            <div className="max-w-card text-body-sm text-text-primary">
              {row.original.holdReason ?? '—'}
              {row.original.matchedClaims.length > 0 && (
                <p className="text-caption text-text-secondary">{row.original.matchedClaims.length} matching claim(s)</p>
              )}
            </div>
          ),
        },
        {
          header: '',
          id: 'actions',
          cell: ({ row }: Row) => (
            <div className="flex gap-xs">
              <Button size="sm" onClick={() => setDecision({ row: row.original, kind: 'approve-held' })}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDecision({ row: row.original, kind: 'reject-held' })}>
                Reject
              </Button>
            </div>
          ),
        },
      ];
    }
    if (v === 'approvals') {
      return [
        ...base,
        { header: 'Plan asked for', id: 'plan', cell: ({ row }: Row) => row.original.requestedPlanLabel ?? '—' },
        { header: 'Note', id: 'note', cell: ({ row }: Row) => <span className="line-clamp-2 max-w-card text-body-sm">{row.original.approvalNote ?? '—'}</span> },
        { header: 'Submitted', id: 'when', cell: ({ row }: Row) => (row.original.submittedAt ? formatDateTime(row.original.submittedAt) : '—') },
        {
          header: '',
          id: 'actions',
          cell: ({ row }: Row) => (
            <div className="flex gap-xs">
              <Button
                size="sm"
                onClick={() =>
                  request(
                    { id: row.original.companyId, name: row.original.companyName, status: row.original.status, requestedPlan: row.original.requestedPlan },
                    'approve',
                  )
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => request({ id: row.original.companyId, name: row.original.companyName, status: row.original.status }, 'reject')}
              >
                Reject
              </Button>
            </div>
          ),
        },
      ];
    }
    return [
      ...base,
      { header: 'Plan asked for', id: 'plan', cell: ({ row }: Row) => row.original.activationRequestedPlanLabel ?? '—' },
      { header: 'Current', id: 'current', cell: ({ row }: Row) => `${row.original.planLabel}${row.original.endsAt ? ` · ends ${formatDate(row.original.endsAt)}` : ''}` },
      { header: 'Note', id: 'note', cell: ({ row }: Row) => <span className="line-clamp-2 max-w-card text-body-sm">{row.original.activationNote ?? '—'}</span> },
      {
        header: '',
        id: 'actions',
        cell: ({ row }: Row) => (
          <div className="flex gap-xs">
            <Button size="sm" onClick={() => setDecision({ row: row.original, kind: 'approve-activation' })}>
              Activate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDecision({ row: row.original, kind: 'reject-activation' })}>
              Reject
            </Button>
          </div>
        ),
      },
    ];
  };

  const rows = list.data?.items ?? [];
  const pagination = list.data?.pagination;
  const rejecting = decision?.kind === 'reject-held' || decision?.kind === 'reject-activation';

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Trials & approvals"
        description="Free trials, held trials, approval requests and activation requests. Nothing is paid online: plans are switched on here."
      />

      <div className="flex flex-wrap gap-xs" role="tablist" aria-label="Queues">
        {TABS.map((t) => {
          const n = t.count && counts.data ? counts.data[t.count] : null;
          return (
            <Chip key={t.view} active={view === t.view} onClick={() => setParams({ view: t.view })}>
              {t.label}
              {n !== null && n !== undefined ? ` (${n})` : ''}
            </Chip>
          );
        })}
      </div>

      {list.isError && <ErrorBanner error={list.error} fallback="The list could not be loaded." onRetry={() => list.refetch()} />}

      <DataTable
        columns={columnsFor(view) as never}
        data={rows}
        isLoading={list.isLoading}
        toolbar={<SearchInput value={text} onValueChange={setText} placeholder="Company, owner, email or phone" aria-label="Search" size="sm" />}
        empty={<p className="p-lg text-body-sm text-text-tertiary">Nothing in this queue.</p>}
      />
      {pagination && pagination.pages > 1 && (
        <TablePager
          page={page}
          totalPages={pagination.pages}
          total={pagination.total}
          onPage={(p) => setParams({ view, ...(q ? { q } : {}), page: String(p) })}
        />
      )}

      <ConfirmDialog
        open={decision?.kind === 'approve-held'}
        onOpenChange={(o) => !o && setDecision(null)}
        title={`Start ${decision?.row.companyName ?? ''}'s trial?`}
        description="The trial starts now for the full trial length, and the owner is emailed."
        confirmLabel="Approve"
        busy={decide.isPending}
        onConfirm={() => decision && decide.mutate({ d: decision })}
      />

      <PlanTermsDialog
        open={decision?.kind === 'approve-activation'}
        onOpenChange={(o) => !o && setDecision(null)}
        title={`Activate ${decision?.row.companyName ?? ''}`}
        description="The plan and its end date. A running trial ends as converted. Nothing is charged or posted to the books."
        confirmLabel="Activate"
        requestedPlan={decision?.row.activationRequestedPlan}
        busy={decide.isPending}
        onConfirm={(terms) => decision && decide.mutate({ d: decision, terms })}
      />

      <ConfirmDialog
        open={rejecting}
        onOpenChange={(o) => {
          if (!o) {
            setDecision(null);
            setReason('');
            setBlock(false);
          }
        }}
        title={`Reject ${decision?.row.companyName ?? ''}?`}
        description="The owner is emailed this reason."
        confirmLabel="Reject"
        destructive
        busy={decide.isPending}
        confirmDisabled={reason.trim().length < 3}
        onConfirm={() => decision && decide.mutate({ d: decision })}
      >
        <div className="flex flex-col gap-sm">
          <Textarea label="Reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          {decision?.kind === 'reject-held' && (
            <label className="flex items-start gap-sm text-body-sm text-text-primary">
              <input type="checkbox" className="mt-[3px]" checked={block} onChange={(e) => setBlock(e.target.checked)} />
              Block future trials for this email and phone (abuse)
            </label>
          )}
        </div>
      </ConfirmDialog>

      {dialogs}
    </div>
  );
}

export default TrialsPage;
