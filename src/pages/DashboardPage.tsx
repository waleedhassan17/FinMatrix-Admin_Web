// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Dashboard
// ═══════════════════════════════════════════════════════
// Answers "what do I need to do?" first, then "where do things stand?".
//
//   1. Awaiting approval — the queue itself, with Approve and Reject on each
//      row, so a routine approval never needs a second page.
//   2. One strip of counts, each a link to that slice of the Companies list.
//   3. Who signed up most recently, with the owner to contact.
//
// While billing is off there are no payments to verify and no subscriptions to
// count, so the tiles that only ever said 0 are gone.

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorBanner } from '@/components/layout/PageState';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BILLING_DISABLED_BUILD } from '@/config/featureFlags';
import { CompanyActions } from '@/features/companies/CompanyActions';
import { useCompanyDecision } from '@/features/companies/useCompanyDecision';
import { cn } from '@/lib/cn';
import {
  companyStatusLabel,
  isUnsubmitted,
  normalizeCompanyStatus,
  type PlatformStats,
} from '@/models/platform';
import { getCompanies, getPlatformStats } from '@/networks/superAdmin/platformNetwork';
import { getPlatformRevenue } from '@/networks/superAdmin/submissionNetwork';
import { formatDate } from '@/utils/date';

/** How many waiting companies the dashboard lists before "View all". */
const QUEUE_PREVIEW = 5;

type Registration = PlatformStats['recentRegistrations'][number];

const count = (n: number | undefined): string => (n ?? 0).toLocaleString('en-US');

export function DashboardPage() {
  const navigate = useNavigate();
  const { request, dialogs } = useCompanyDecision();

  const stats = useQuery({
    queryKey: ['platform', 'stats'],
    queryFn: getPlatformStats,
  });

  // The queue, oldest decisions first would be fairer — but the server sorts
  // newest first and the total tells the reviewer how deep it goes.
  const queue = useQuery({
    queryKey: ['companies', 'list', { filter: 'pending', trial: 'all', q: '', page: 1, preview: true }],
    queryFn: () => getCompanies({ page: 1, limit: QUEUE_PREVIEW, status: 'pending' }),
  });

  // Only when payments are real: the revenue summary carries the count.
  const revenue = useQuery({
    queryKey: ['revenue', 'summary'],
    queryFn: getPlatformRevenue,
    enabled: !BILLING_DISABLED_BUILD,
  });

  const companies = stats.data?.companies;
  const waiting = queue.data?.data ?? [];
  const waitingTotal = queue.data?.total ?? companies?.pending ?? 0;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Dashboard"
        description="Approve new companies, and see who is active on FinMatrix."
      />

      {stats.isError && (
        <ErrorBanner
          error={stats.error}
          fallback="Could not load platform statistics."
          onRetry={stats.refetch}
        />
      )}

      {/* 1 ── The queue ───────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-md border-b border-border-light px-lg py-md">
          <div className="min-w-0">
            <h2 className="text-h4 text-text-primary">Awaiting approval</h2>
            <p className="text-body-sm text-text-secondary">
              {queue.isLoading
                ? 'Loading…'
                : waitingTotal > 0
                  ? `${waitingTotal} ${waitingTotal === 1 ? 'company is' : 'companies are'} waiting for a decision.`
                  : 'Nothing is waiting for a decision.'}
            </p>
          </div>
          {waitingTotal > QUEUE_PREVIEW && (
            <Link
              to="/companies?filter=pending"
              className="inline-flex shrink-0 items-center gap-xxs text-label-md text-primary hover:underline"
            >
              View all {waitingTotal}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>

        {queue.isLoading ? (
          <div className="flex flex-col gap-sm p-lg">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : queue.isError ? (
          <div className="p-lg">
            <ErrorBanner
              error={queue.error}
              fallback="Could not load the approval queue."
              onRetry={queue.refetch}
            />
          </div>
        ) : waiting.length === 0 ? (
          <div className="flex items-center gap-sm px-lg py-xl">
            <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
            <p className="text-body-md text-text-secondary">
              All caught up. New registrations appear here the moment they are submitted.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-light">
            {waiting.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-sm px-lg py-md sm:flex-row sm:items-center sm:gap-lg"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/companies/${c.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-xs">
                    <span className="truncate text-label-lg text-text-primary hover:text-primary hover:underline">
                      {c.name}
                    </span>
                    {isUnsubmitted(c.status) && (
                      <StatusBadge status="draft" label="Not submitted" />
                    )}
                  </span>
                  <span className="block truncate text-body-sm text-text-secondary">
                    {[c.ownerName, c.ownerEmail ?? c.email].filter(Boolean).join(' · ') || '—'}
                  </span>
                  <span className="block text-caption text-text-tertiary">
                    Registered {formatDate(c.createdAt)}
                  </span>
                </button>
                <CompanyActions company={c} onRequest={request} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 2 ── Where things stand ──────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* Six cells fill 2, 3 or 6 columns exactly, so a 1px gap over the
            hairline colour draws every divider with no stray edge. */}
        <div className="grid grid-cols-2 gap-px bg-border-light sm:grid-cols-3 xl:grid-cols-6">
          <CountCell
            to="/companies"
            label="Companies"
            value={count(companies?.total)}
            loading={stats.isLoading}
          />
          <CountCell
            to="/companies?filter=active"
            label="Active"
            value={count(companies?.active)}
            tone="success"
            loading={stats.isLoading}
          />
          <CountCell
            to="/companies?filter=pending"
            label="Awaiting approval"
            value={count(companies?.pending)}
            tone={companies?.pending ? 'warning' : 'default'}
            loading={stats.isLoading}
          />
          <CountCell
            to="/companies?filter=inactive"
            label="Deactivated"
            value={count(companies?.suspended)}
            loading={stats.isLoading}
          />
          <CountCell
            to="/companies?filter=rejected"
            label="Rejected"
            value={count(companies?.rejected)}
            loading={stats.isLoading}
          />
          <CountCell
            to="/companies"
            label="New this week"
            value={count(companies?.recentWeek)}
            loading={stats.isLoading}
          />
        </div>
        {!BILLING_DISABLED_BUILD && (
          <Link
            to="/payments"
            className="flex items-center justify-between gap-md px-lg py-sm text-body-sm text-text-secondary hover:bg-surface-2"
          >
            <span>
              Payments to verify:{' '}
              <span className="text-label-md text-text-primary">
                {count(revenue.data?.pendingSubmissions)}
              </span>
            </span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </Card>

      {/* 3 ── Recent sign-ups ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-h4 text-text-primary">Recent sign-ups</h2>
          <Link to="/companies" className="text-label-md text-primary hover:underline">
            All companies
          </Link>
        </div>
        <DataTable<Registration>
          isLoading={stats.isLoading}
          data={stats.data?.recentRegistrations ?? []}
          onRowClick={(r) => navigate(`/companies/${r.id}`)}
          empty={
            <span className="text-body-sm text-text-tertiary">
              No companies have registered yet.
            </span>
          }
          columns={[
            {
              header: 'Company',
              accessorKey: 'name',
              cell: ({ row }) => (
                <div className="min-w-0">
                  <p className="truncate text-label-lg text-text-primary">{row.original.name}</p>
                  <p className="truncate text-body-sm text-text-secondary">
                    {row.original.industry ?? '—'}
                  </p>
                </div>
              ),
            },
            {
              header: 'Owner',
              id: 'owner',
              cell: ({ row }) => (
                <div className="min-w-0">
                  <p className="truncate text-body-sm text-text-primary">
                    {row.original.ownerName ?? '—'}
                  </p>
                  <p className="truncate text-body-sm text-text-secondary">
                    {row.original.ownerEmail ?? row.original.email ?? '—'}
                  </p>
                </div>
              ),
            },
            {
              header: 'Status',
              accessorKey: 'status',
              cell: ({ row }) => (
                <StatusBadge
                  status={normalizeCompanyStatus(row.original.status)}
                  label={companyStatusLabel(row.original.status)}
                />
              ),
            },
            {
              header: 'Registered',
              accessorKey: 'createdAt',
              cell: ({ row }) => formatDate(row.original.createdAt),
            },
          ]}
        />
      </section>

      {dialogs}
    </div>
  );
}

/**
 * One count, and the list it is a count of. A number you can click through is
 * worth more than a tile you can only read.
 */
function CountCell({
  to,
  label,
  value,
  tone = 'default',
  loading,
}: {
  to: string;
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
  loading?: boolean;
}): ReactNode {
  return (
    <Link
      to={to}
      className="group flex min-w-0 flex-col gap-xxs bg-surface px-lg py-md transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
    >
      <span className="truncate text-label-md text-text-secondary group-hover:text-primary">
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-7 w-14" />
      ) : (
        <span
          className={cn(
            'text-h2 tabular',
            tone === 'success'
              ? 'text-success'
              : tone === 'warning'
                ? 'text-warning'
                : 'text-text-primary',
          )}
        >
          {value}
        </span>
      )}
    </Link>
  );
}

export default DashboardPage;
