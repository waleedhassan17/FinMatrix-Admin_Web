// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Company management
// ═══════════════════════════════════════════════════════
// The app pages this list by infinite scroll. A browser gets a table and a
// pager instead: a reviewer working a queue wants to know how many are left and
// to come back to page 3, neither of which a scroll position gives them.
//
// Filter, search and page all live in the URL, so /companies?filter=pending is
// a link the dashboard can point at and a reviewer can bookmark.

import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorBanner } from '@/components/layout/PageState';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { DataTable, TablePager } from '@/components/ui/DataTable';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BILLING_DISABLED_BUILD } from '@/config/featureFlags';
import { CompanyActions } from '@/features/companies/CompanyActions';
import { useCompanyDecision } from '@/features/companies/useCompanyDecision';
import {
  COMPANY_FILTERS,
  companyStatusLabel,
  isCompanyFilter,
  isTrialFilter,
  normalizeCompanyStatus,
  statusParamFor,
  TRIAL_FILTERS,
  trialParamFor,
  type CompanyFilter,
  type CompanyListItem,
  type TrialFilter,
} from '@/models/platform';
import { bulkDeleteAllowed } from '@/models/launchAdmin';
import { bulkCompanies } from '@/networks/superAdmin/launchAdminNetwork';
import { getCompanies } from '@/networks/superAdmin/platformNetwork';
import { formatDate } from '@/utils/date';

const PAGE_SIZE = 20;
/** Long enough that typing a name is one request, not one per letter. */
const SEARCH_DEBOUNCE_MS = 300;

type Row = { row: { original: CompanyListItem } };

export function CompaniesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { request, dialogs } = useCompanyDecision();

  const raw = params.get('filter');
  const filter: CompanyFilter = isCompanyFilter(raw) ? raw : 'all';
  const rawTrial = params.get('trial');
  const trial: TrialFilter =
    !BILLING_DISABLED_BUILD && isTrialFilter(rawTrial) ? rawTrial : 'all';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  // Demo/test companies: all, only them (bulk work), or real customers only.
  const demo = (['only', 'hide'] as const).find((d) => d === params.get('demo')) ?? 'all';
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<string, CompanyListItem>>({});
  const [bulk, setBulk] = useState<'suspend' | 'delete' | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkTyped, setBulkTyped] = useState('');

  // Every change resets to page 1: page 3 of "all" is rarely page 3 of a
  // search, and landing on an empty page reads as "nothing here".
  const setQuery = (next: { filter?: CompanyFilter; trial?: TrialFilter; page?: number }) => {
    const f = next.filter ?? filter;
    const t = next.trial ?? trial;
    const out: Record<string, string> = {};
    if (f !== 'all') out.filter = f;
    if (t !== 'all') out.trial = t;
    if (q) out.q = q;
    if (demo !== 'all') out.demo = demo;
    if (next.page && next.page > 1) out.page = String(next.page);
    setParams(out);
  };
  const setDemo = (d: 'all' | 'only' | 'hide') => {
    const out = new URLSearchParams(params);
    if (d === 'all') out.delete('demo');
    else out.set('demo', d);
    out.delete('page');
    setParams(out);
    setSelected({});
  };

  // The field updates on every keystroke; the URL (and the request) follows
  // once typing pauses.
  const [text, setText] = useState(q);
  useEffect(() => {
    const next = text.trim();
    if (next === q) return;
    const t = setTimeout(() => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next) out.set('q', next);
          else out.delete('q');
          out.delete('page');
          return out;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text, q, setParams]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['companies', 'list', { filter, trial, q, page, demo }],
    queryFn: () =>
      getCompanies({
        page,
        limit: PAGE_SIZE,
        status: statusParamFor(filter),
        isTrial: trialParamFor(trial),
        search: q || undefined,
        isDemo: demo === 'only' ? true : demo === 'hide' ? false : undefined,
      }),
    // Keeps the current page on screen while the next one loads, so the table
    // does not collapse to a skeleton on every pager click.
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  // From the server's pagination block rather than recomputed, so a short page
  // or a changed server-side limit cannot drift the pager.
  const totalPages = data?.pages ?? Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectedRows = Object.values(selected);
  const toggle = (c: CompanyListItem) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[c.id]) delete next[c.id];
      else next[c.id] = c;
      return next;
    });

  const runBulk = useMutation({
    mutationFn: () =>
      bulkCompanies({ action: bulk!, ids: selectedRows.map((c) => c.id), reason: bulkReason.trim() }),
    onSuccess: () => {
      toast.success(bulk === 'delete' ? `Deleting ${selectedRows.length} companies` : `${selectedRows.length} companies suspended`);
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
      setSelected({});
      setBulk(null);
      setBulkReason('');
      setBulkTyped('');
    },
    onError: (e: Error) => toast.error('The bulk action failed', { description: e.message }),
  });

  const columns = [
    {
      header: '',
      id: 'select',
      cell: ({ row }: Row) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.original.name}`}
          checked={!!selected[row.original.id]}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggle(row.original)}
        />
      ),
    },
    {
      header: 'Company',
      accessorKey: 'name',
      cell: ({ row }: Row) => (
        <div className="min-w-0">
          <Link
            to={`/companies/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate text-label-lg text-text-primary hover:text-primary hover:underline"
          >
            {row.original.name}
          </Link>
          {row.original.isDemo && <StatusBadge status="draft" label="Demo" />}
          <p className="truncate text-body-sm text-text-secondary">
            {row.original.industry || row.original.phone || '—'}
          </p>
        </div>
      ),
    },
    {
      // Who to call about it. The company's own email is often blank; the
      // owner's is the one every approval email goes to.
      header: 'Owner',
      id: 'owner',
      cell: ({ row }: Row) => {
        const c = row.original;
        return (
          <div className="min-w-0">
            <p className="truncate text-body-sm text-text-primary">
              {c.ownerName ?? '—'}
            </p>
            <p className="truncate text-body-sm text-text-secondary">
              {c.ownerEmail ?? c.email ?? '—'}
            </p>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }: Row) => (
        <div className="flex flex-col items-start gap-xxs">
          <StatusBadge
            status={normalizeCompanyStatus(row.original.status)}
            label={companyStatusLabel(row.original.status)}
          />
          {row.original.rejectionReason && (
            <span className="text-caption text-text-tertiary">
              {row.original.rejectionReason}
            </span>
          )}
        </div>
      ),
    },
    // BILLING-DISABLED BUILD: nothing is sold, so every row read "—" here.
    ...(BILLING_DISABLED_BUILD
      ? []
      : [
          {
            header: 'Plan',
            accessorKey: 'planName',
            cell: ({ row }: Row) => (
              <div className="flex flex-col items-start gap-xxs">
                <span>{row.original.planName ?? '—'}</span>
                {row.original.isTrial && (
                  <span className="rounded-full bg-warning-lighter px-xs text-caption text-warning">
                    {row.original.trialConvertedAt ? 'Converted' : 'On trial'}
                  </span>
                )}
              </div>
            ),
          },
        ]),
    {
      header: 'Team',
      accessorKey: 'memberCount',
      meta: { align: 'right' },
      cell: ({ row }: Row) => row.original.memberCount ?? 0,
    },
    {
      header: 'Registered',
      accessorKey: 'createdAt',
      cell: ({ row }: Row) => formatDate(row.original.createdAt),
    },
    {
      header: '',
      id: 'actions',
      meta: { align: 'right' },
      cell: ({ row }: Row) => <CompanyActions company={row.original} onRequest={request} />,
    },
  ];

  const emptyText = q
    ? `No company matches “${q}”.`
    : filter === 'all'
      ? 'No companies have registered yet.'
      : `No companies are ${COMPANY_FILTERS.find((f) => f.value === filter)?.label.toLowerCase()}.`;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Companies"
        description="Find a company, then approve, activate or deactivate it."
        meta={[total > 0 ? `${total} ${q || filter !== 'all' ? 'matching' : 'total'}` : null]}
      />

      {isError && (
        <ErrorBanner error={error} fallback="Could not load companies." onRetry={refetch} />
      )}

      <div>
        <DataTable<CompanyListItem>
          isLoading={isLoading}
          data={rows}
          columns={columns as never}
          onRowClick={(c: CompanyListItem) => navigate(`/companies/${c.id}`)}
          empty={<span className="text-body-sm text-text-tertiary">{emptyText}</span>}
          toolbar={
            <div className="flex flex-col gap-sm border-b border-border-light p-md">
              <SearchInput
                value={text}
                onValueChange={setText}
                placeholder="Search by company, owner or email"
                aria-label="Search companies"
                aria-busy={isFetching}
                containerClassName="max-w-[28rem]"
              />
              <div className="flex flex-wrap items-center gap-sm">
                {COMPANY_FILTERS.map((f) => (
                  <Chip
                    key={f.value}
                    active={filter === f.value}
                    onClick={() => setQuery({ filter: f.value })}
                  >
                    {f.label}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-xs">
                <span className="text-label-sm text-text-tertiary">Demo/test</span>
                {(
                  [
                    ['all', 'All'],
                    ['only', 'Demo only'],
                    ['hide', 'Real customers'],
                  ] as const
                ).map(([value, label]) => (
                  <Chip key={value} size="sm" active={demo === value} onClick={() => setDemo(value)}>
                    {label}
                  </Chip>
                ))}
              </div>
              {selectedRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-sm rounded-md bg-background-alt p-sm" data-testid="bulk-bar">
                  <span className="text-label-md text-text-primary">{selectedRows.length} selected</span>
                  <Button size="sm" variant="secondary" onClick={() => setBulk('suspend')}>
                    Suspend selected
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!bulkDeleteAllowed(selectedRows)}
                    title={bulkDeleteAllowed(selectedRows) ? undefined : 'Only companies flagged demo/test can be deleted in bulk'}
                    onClick={() => setBulk('delete')}
                  >
                    Delete selected
                  </Button>
                  {!bulkDeleteAllowed(selectedRows) && (
                    <span className="text-caption text-text-secondary">Bulk delete is only for demo/test companies.</span>
                  )}
                  <Button size="sm" variant="text" onClick={() => setSelected({})}>
                    Clear
                  </Button>
                </div>
              )}
              {!BILLING_DISABLED_BUILD && (
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="text-label-sm text-text-tertiary">Trial</span>
                  {TRIAL_FILTERS.map((f) => (
                    <Chip
                      key={f.value}
                      size="sm"
                      active={trial === f.value}
                      onClick={() => setQuery({ trial: f.value })}
                    >
                      {f.label}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          }
        />
        <TablePager
          page={page}
          totalPages={totalPages}
          total={total}
          onPage={(next) => setQuery({ page: next })}
        />
      </div>

      <ConfirmDialog
        open={bulk !== null}
        onOpenChange={(o) => {
          if (!o) {
            setBulk(null);
            setBulkReason('');
            setBulkTyped('');
          }
        }}
        title={bulk === 'delete' ? `Delete ${selectedRows.length} demo companies?` : `Suspend ${selectedRows.length} companies?`}
        description={
          bulk === 'delete'
            ? 'Permanent. Each is suspended, purged and recorded in Deleted accounts.'
            : 'Every member is signed out at once. Nothing is deleted.'
        }
        confirmLabel={bulk === 'delete' ? 'Delete permanently' : 'Suspend'}
        destructive
        busy={runBulk.isPending}
        confirmDisabled={
          bulkReason.trim().length < 3 || (bulk === 'delete' && bulkTyped.trim() !== `DELETE ${selectedRows.length}`)
        }
        onConfirm={() => runBulk.mutate()}
      >
        <div className="flex flex-col gap-sm">
          <Textarea label="Reason (audited)" rows={2} value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
          {bulk === 'delete' && (
            <Input
              label={`Type DELETE ${selectedRows.length} to confirm`}
              value={bulkTyped}
              onChange={(e) => setBulkTyped(e.target.value)}
              autoComplete="off"
            />
          )}
        </div>
      </ConfirmDialog>

      {dialogs}
    </div>
  );
}

export default CompaniesPage;
