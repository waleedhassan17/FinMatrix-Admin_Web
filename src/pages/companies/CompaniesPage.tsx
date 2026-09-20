// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Company management
// ═══════════════════════════════════════════════════════
// The app pages this list by infinite scroll. A browser gets a table and a
// pager instead: a reviewer working a queue wants to know how many are left and
// to come back to page 3, neither of which a scroll position gives them.
//
// The filter lives in the URL, so /companies?filter=pending is a link the
// dashboard can point at and a reviewer can bookmark.

import { useState } from 'react';
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, TablePager } from '@/components/ui/DataTable';
import { Textarea } from '@/components/ui/Field';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useSettle } from '@/features/platform/invalidation';
import { ErrorBanner } from '@/components/layout/PageState';
import { formatDate } from '@/utils/date';
import { Chip } from '@/components/ui/Chip';
import {
  COMPANY_FILTERS,
  isCompanyFilter,
  isTrialFilter,
  normalizeCompanyStatus,
  REJECT_REASONS,
  statusParamFor,
  TRIAL_FILTERS,
  trialParamFor,
  type CompanyFilter,
  type CompanyListItem,
  type TrialFilter,
} from '@/models/platform';
import {
  getCompanies,
  updateCompanyStatus,
} from '@/networks/superAdmin/platformNetwork';

const PAGE_SIZE = 20;


/**
 * The four decisions a reviewer can take, and the status each one sends.
 *
 * The console only ever sent 'active' and 'rejected' before, so the Inactive
 * filter chip listed a state nothing here could produce -- and nothing could
 * undo. The server accepts 'suspended' as a synonym but STORES 'inactive', so
 * 'inactive' is what gets sent; see normalizeCompanyStatus.
 */
const DECISIONS = {
  approve: { status: 'active', toast: 'Company approved' },
  reject: { status: 'rejected', toast: 'Company rejected' },
  suspend: { status: 'inactive', toast: 'Company suspended' },
  reactivate: { status: 'active', toast: 'Company reactivated' },
} as const;

type DecisionAction = keyof typeof DECISIONS;
type Decision = { company: CompanyListItem; action: DecisionAction };

export function CompaniesPage() {
  const [params, setParams] = useSearchParams();
  const { afterCompanyDecision } = useSettle();

  const navigate = useNavigate();

  const raw = params.get('filter');
  const filter: CompanyFilter = isCompanyFilter(raw) ? raw : 'all';
  const rawTrial = params.get('trial');
  const trial: TrialFilter = isTrialFilter(rawTrial) ? rawTrial : 'all';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');

  // Changing any filter resets to page 1: page 3 of "all" is rarely page 3 of
  // "pending", and landing on an empty page reads as "nothing here".
  const setFilter = (next: CompanyFilter) => {
    const q: Record<string, string> = {};
    if (next !== 'all') q.filter = next;
    if (trial !== 'all') q.trial = trial;
    setParams(q);
  };

  const setTrial = (next: TrialFilter) => {
    const q: Record<string, string> = {};
    if (filter !== 'all') q.filter = filter;
    if (next !== 'all') q.trial = next;
    setParams(q);
  };

  const setPage = (next: number) => {
    const q: Record<string, string> = { page: String(next) };
    if (filter !== 'all') q.filter = filter;
    if (trial !== 'all') q.trial = trial;
    setParams(q);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['companies', 'list', { filter, trial, page }],
    queryFn: () =>
      getCompanies({
        page,
        limit: PAGE_SIZE,
        status: statusParamFor(filter),
        isTrial: trialParamFor(trial),
      }),
    // Keeps the current page on screen while the next one loads, so the table
    // does not collapse to a skeleton on every pager click.
    placeholderData: keepPreviousData,
  });

  const decide = useMutation({
    mutationFn: ({ company, action }: Decision) =>
      updateCompanyStatus(
        company.id,
        DECISIONS[action].status,
        action === 'reject' ? reason.trim() : undefined,
      ),
    onSuccess: (_updated, variables) => {
      afterCompanyDecision(variables.company.id);
      toast.success(DECISIONS[variables.action].toast, {
        description: variables.company.name,
      });
      setDecision(null);
      setReason('');
    },
    onError: (e: Error) =>
      toast.error('Could not update the company', { description: e.message }),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  // From the server's pagination block rather than recomputed, so a short page
  // or a changed server-side limit cannot drift the pager.
  const totalPages = data?.pages ?? Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Not memoised: the cells close over setDecision and setReason, and an
  // empty dep array made React Compiler skip optimising the whole component
  // rather than trust the mismatch. Building five column defs is cheap.
  const columns = [
      {
        header: 'Company',
        accessorKey: 'name',
        cell: ({ row }: { row: { original: CompanyListItem } }) => (
          <div className="min-w-0">
            <Link
              to={`/companies/${row.original.id}`}
              className="truncate text-label-lg text-text-primary hover:text-primary hover:underline"
            >
              {row.original.name}
            </Link>
            <p className="truncate text-body-sm text-text-secondary">
              {row.original.email ?? row.original.industry ?? '—'}
            </p>
          </div>
        ),
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }: { row: { original: CompanyListItem } }) => (
          <div className="flex flex-col items-start gap-xxs">
            <StatusBadge status={normalizeCompanyStatus(row.original.status)} />
            {row.original.rejectionReason && (
              <span className="text-caption text-text-tertiary">
                {row.original.rejectionReason}
              </span>
            )}
          </div>
        ),
      },
      {
        header: 'Plan',
        accessorKey: 'planName',
        cell: ({ row }: { row: { original: CompanyListItem } }) => (
          <div className="flex flex-col items-start gap-xxs">
            <span>{row.original.planName ?? '—'}</span>
            {/* The server has always sent isTrial; nothing rendered it, so a
                trial company was indistinguishable from a paying one. */}
            {row.original.isTrial && (
              <span className="rounded-full bg-warning-lighter px-xs text-caption text-warning">
                {row.original.trialConvertedAt ? 'Converted' : 'On trial'}
              </span>
            )}
          </div>
        ),
      },
      {
        header: 'Members',
        accessorKey: 'memberCount',
        meta: { align: 'right' },
        cell: ({ row }: { row: { original: CompanyListItem } }) =>
          row.original.memberCount ?? 0,
      },
      {
        header: 'Registered',
        accessorKey: 'createdAt',
        cell: ({ row }: { row: { original: CompanyListItem } }) =>
          formatDate(row.original.createdAt),
      },
      {
        header: '',
        id: 'actions',
        meta: { align: 'right' },
        cell: ({ row }: { row: { original: CompanyListItem } }) => {
          const c = row.original;
          const status = normalizeCompanyStatus(c.status);

          // Every state the filters can reach now has a way out of it. Before
          // this, only 'pending' had actions -- so the Inactive chip listed
          // companies the console could neither produce nor restore.
          if (status === 'pending') {
            return (
              <div className="flex justify-end gap-xs">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setReason('');
                    setDecision({ company: c, action: 'reject' });
                  }}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => setDecision({ company: c, action: 'approve' })}
                >
                  Approve
                </Button>
              </div>
            );
          }

          if (status === 'active') {
            return (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDecision({ company: c, action: 'suspend' })}
                >
                  Suspend
                </Button>
              </div>
            );
          }

          // Inactive or rejected: both can be put back to active.
          return (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDecision({ company: c, action: 'reactivate' })}
              >
                Reactivate
              </Button>
            </div>
          );
        },
      },
  ];

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Companies"
        description="Every business registered on the platform."
        meta={[total > 0 ? `${total} total` : null]}
      />

      {isError && (
        <ErrorBanner
          error={error}
          fallback="Could not load companies."
          onRetry={refetch}
        />
      )}

      <div>
        <DataTable<CompanyListItem>
          isLoading={isLoading}
          data={rows}
          columns={columns as never}
          onRowClick={(c: CompanyListItem) => navigate(`/companies/${c.id}`)}
          empty={
            <span className="text-body-sm text-text-tertiary">
              {filter === 'all'
                ? 'No companies have registered yet.'
                : `No ${filter} companies.`}
            </span>
          }
          toolbar={
            <div className="flex flex-col gap-sm border-b border-border-light p-md">
              <div className="flex flex-wrap items-center gap-sm">
                {COMPANY_FILTERS.map((f) => (
                  <Chip
                    key={f.value}
                    active={filter === f.value}
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-xs">
                <span className="text-label-sm text-text-tertiary">Trial</span>
                {TRIAL_FILTERS.map((f) => (
                  <Chip
                    key={f.value}
                    size="sm"
                    active={trial === f.value}
                    onClick={() => setTrial(f.value)}
                  >
                    {f.label}
                  </Chip>
                ))}
              </div>
            </div>
          }
        />
        <TablePager
          page={page}
          totalPages={totalPages}
          total={total}
          onPage={setPage}
        />
      </div>

      <ConfirmDialog
        open={decision?.action === 'approve'}
        onOpenChange={(open) => !open && setDecision(null)}
        title="Approve this company?"
        description={`${decision?.company.name ?? ''} will be able to sign in and start using FinMatrix.`}
        confirmLabel="Approve"
        busy={decide.isPending}
        onConfirm={() => decision && decide.mutate({ ...decision })}
      />

      <ConfirmDialog
        open={decision?.action === 'suspend'}
        onOpenChange={(open) => !open && setDecision(null)}
        title="Suspend this company?"
        description={`${decision?.company.name ?? ''} will be blocked from signing in until it is reactivated. Its data is kept.`}
        confirmLabel="Suspend"
        destructive
        busy={decide.isPending}
        onConfirm={() => decision && decide.mutate({ ...decision })}
      />

      <ConfirmDialog
        open={decision?.action === 'reactivate'}
        onOpenChange={(open) => !open && setDecision(null)}
        title="Reactivate this company?"
        description={`${decision?.company.name ?? ''} will be able to sign in again.`}
        confirmLabel="Reactivate"
        busy={decide.isPending}
        onConfirm={() => decision && decide.mutate({ ...decision })}
      />

      <ConfirmDialog
        open={decision?.action === 'reject'}
        onOpenChange={(open) => {
          if (!open) {
            setDecision(null);
            setReason('');
          }
        }}
        title="Reject this company?"
        description={`${decision?.company.name ?? ''} will be told why. This reason reaches the owner, so write it for them.`}
        confirmLabel="Reject"
        destructive
        busy={decide.isPending}
        confirmDisabled={reason.trim().length < 3}
        onConfirm={() => decision && decide.mutate({ ...decision })}
      >
        <div className="flex flex-col gap-sm">
          <div className="flex flex-wrap gap-xs">
            {REJECT_REASONS.map((r) => (
              <Chip key={r} active={reason === r} size="sm" onClick={() => setReason(r)}>
                {r}
              </Chip>
            ))}
          </div>
          {/* Page-managed rather than ConfirmDialog's built-in `reason` slot:
              the chips above have to write into it, and that slot keeps its
              text to itself. confirmDisabled enforces the same 3-char floor. */}
          <Textarea
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Pick one above, or write the reason"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

export default CompaniesPage;
