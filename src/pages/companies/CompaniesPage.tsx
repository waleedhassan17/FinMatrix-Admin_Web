// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Company management
// ═══════════════════════════════════════════════════════
// The app pages this list by infinite scroll. A browser gets a table and a
// pager instead: a reviewer working a queue wants to know how many are left and
// to come back to page 3, neither of which a scroll position gives them.
//
// The filter lives in the URL, so /companies?filter=pending is a link the
// dashboard can point at and a reviewer can bookmark.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, TablePager } from '@/components/ui/DataTable';
import { Textarea } from '@/components/ui/Field';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/cn';
import {
  COMPANY_FILTERS,
  isCompanyFilter,
  REJECT_REASONS,
  statusParamFor,
  type CompanyFilter,
  type CompanyListItem,
} from '@/models/platform';
import {
  getCompanies,
  updateCompanyStatus,
} from '@/networks/superAdmin/platformNetwork';

const PAGE_SIZE = 20;

const dateOf = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
};

type Decision = { company: CompanyListItem; action: 'approve' | 'reject' };

export function CompaniesPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const raw = params.get('filter');
  const filter: CompanyFilter = isCompanyFilter(raw) ? raw : 'all';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');

  const setFilter = (next: CompanyFilter) => {
    // Changing the filter resets to page 1: page 3 of "all" is rarely page 3
    // of "pending", and landing on an empty page reads as "nothing here".
    setParams(next === 'all' ? {} : { filter: next });
  };

  const setPage = (next: number) => {
    const q: Record<string, string> = { page: String(next) };
    if (filter !== 'all') q.filter = filter;
    setParams(q);
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['companies', 'list', { filter, page }],
    queryFn: () =>
      getCompanies({
        page,
        limit: PAGE_SIZE,
        status: statusParamFor(filter),
      }),
    // Keeps the current page on screen while the next one loads, so the table
    // does not collapse to a skeleton on every pager click.
    placeholderData: keepPreviousData,
  });

  const decide = useMutation({
    mutationFn: ({ company, action }: Decision & { reason?: string }) =>
      updateCompanyStatus(
        company.id,
        action === 'approve' ? 'active' : 'rejected',
        action === 'reject' ? reason.trim() : undefined,
      ),
    onSuccess: (_updated, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      // The dashboard's pending count comes from a different endpoint.
      queryClient.invalidateQueries({ queryKey: ['platform'] });
      toast.success(
        variables.action === 'approve' ? 'Company approved' : 'Company rejected',
        { description: variables.company.name },
      );
      setDecision(null);
      setReason('');
    },
    onError: (e: Error) =>
      toast.error('Could not update the company', { description: e.message }),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns = useMemo(
    () => [
      {
        header: 'Company',
        accessorKey: 'name',
        cell: ({ row }: { row: { original: CompanyListItem } }) => (
          <div className="min-w-0">
            <p className="truncate text-label-lg text-text-primary">
              {row.original.name}
            </p>
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
            <StatusBadge status={row.original.status} />
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
        cell: ({ row }: { row: { original: CompanyListItem } }) =>
          row.original.planName ?? '—',
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
          dateOf(row.original.createdAt),
      },
      {
        header: '',
        id: 'actions',
        meta: { align: 'right' },
        cell: ({ row }: { row: { original: CompanyListItem } }) => {
          const c = row.original;
          // Only a company still waiting can be decided. An active or already
          // rejected one needs a different action, not these two.
          const pending = c.status === 'pending' || c.status === 'pending_approval';
          if (!pending) return null;
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
        },
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Companies"
        description="Every business registered on the platform."
        meta={[total > 0 ? `${total} total` : null]}
      />

      {isError && (
        <div role="alert" className="rounded-md bg-danger-lighter p-sm">
          <p className="text-body-sm text-danger">
            {(error as Error)?.message ?? 'Could not load companies.'}
          </p>
        </div>
      )}

      <div>
        <DataTable<CompanyListItem>
          isLoading={isLoading}
          data={rows}
          columns={columns as never}
          empty={
            <span className="text-body-sm text-text-tertiary">
              {filter === 'all'
                ? 'No companies have registered yet.'
                : `No ${filter} companies.`}
            </span>
          }
          toolbar={
            <div className="flex flex-wrap items-center gap-sm border-b border-border-light p-md">
              {COMPANY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    'rounded-full px-sm py-xxs text-label-md transition-colors',
                    filter === f.value
                      ? 'bg-primary text-text-inverse'
                      : 'bg-neutral-100 text-text-secondary hover:bg-neutral-200',
                  )}
                >
                  {f.label}
                </button>
              ))}
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
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  'rounded-full px-sm py-xxs text-label-sm transition-colors',
                  reason === r
                    ? 'bg-primary text-text-inverse'
                    : 'bg-neutral-100 text-text-secondary hover:bg-neutral-200',
                )}
              >
                {r}
              </button>
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
