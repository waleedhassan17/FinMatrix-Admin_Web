// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Platform overview
// ═══════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { StatTile } from '@/components/ui/StatTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/cn';
import { ErrorBanner } from '@/components/layout/PageState';
import { formatDate } from '@/utils/date';
import { getPlatformStats } from '@/networks/superAdmin/platformNetwork';
import { getPlatformRevenue } from '@/networks/superAdmin/submissionNetwork';

/** StatTile takes a pre-formatted string, so the caller owns the unit. */
const count = (n: number | undefined): string => (n ?? 0).toLocaleString('en-US');


type Registration = {
  id: string;
  name: string;
  industry: string | null;
  email: string | null;
  status: string;
  createdAt: string;
};

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['platform', 'stats'],
    queryFn: getPlatformStats,
  });

  // pendingSubmissions is a SQL COUNT on the revenue summary. Same query key
  // the sidebar badge uses, so this costs nothing extra and the two can never
  // disagree.
  const { data: revenue, isLoading: waitingLoading } = useQuery({
    queryKey: ['revenue', 'summary'],
    queryFn: getPlatformRevenue,
  });
  const waiting = revenue?.pendingSubmissions;

  const companies = data?.companies;
  const subscriptions = data?.subscriptions;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Platform overview"
        description="Every business running on FinMatrix, at a glance."
      />

      {isError && (
        <ErrorBanner
          error={error}
          fallback="Could not load platform statistics."
          onRetry={refetch}
        />
      )}

      {/* What needs a decision, first.
          This page used to open with four stat tiles, then four quick-action
          cards, then a table, then three more mini-stats -- eleven cards
          before anything you could act on. A console's first screen should
          answer "what do I do now?", and only then "how are we doing?". */}
      <section className="grid gap-md lg:grid-cols-2">
        <WorkCard
          to="/companies?filter=pending"
          icon={<Clock className="size-5" />}
          title="Companies awaiting approval"
          count={companies?.pending ?? 0}
          loading={isLoading}
          empty="Nothing waiting for review."
          cta="Review them"
          urgent={!!companies?.pending}
        />
        <WorkCard
          to="/payments"
          icon={<CreditCard className="size-5" />}
          title="Payments to verify"
          count={waiting ?? 0}
          loading={waitingLoading}
          empty="The queue is clear."
          cta="Open the queue"
          urgent={!!waiting}
        />
      </section>

      {/* One strip, not three grids. Everything here is a number you read
          rather than act on, so it is sized and grouped accordingly. */}
      <section>
        <h2 className="mb-sm text-h4 text-text-primary">At a glance</h2>
        <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Total companies"
            value={count(companies?.total)}
            loading={isLoading}
            hint={
              companies?.recentWeek
                ? `${companies.recentWeek} joined this week`
                : undefined
            }
          />
          <StatTile
            label="Active"
            value={count(companies?.active)}
            loading={isLoading}
            tone="success"
          />
          <StatTile
            label="Active subscriptions"
            value={count(subscriptions?.activeSubscriptions)}
            loading={isLoading}
            hint={`of ${subscriptions?.totalSubscriptions ?? 0} total`}
          />
          <StatTile
            label="Inactive or rejected"
            value={count((companies?.suspended ?? 0) + (companies?.rejected ?? 0))}
            loading={isLoading}
            tone={
              (companies?.suspended ?? 0) + (companies?.rejected ?? 0)
                ? 'danger'
                : 'default'
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-h4 text-text-primary">Recent registrations</h2>
          <Link
            to="/companies"
            className="text-label-md text-primary hover:underline"
          >
            All companies
          </Link>
        </div>
        <DataTable<Registration>
          isLoading={isLoading}
          data={data?.recentRegistrations ?? []}
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
              cell: ({ row }) => <StatusBadge status={row.original.status} />,
            },
            {
              header: 'Registered',
              accessorKey: 'createdAt',
              cell: ({ row }) => formatDate(row.original.createdAt),
            },
          ]}
        />
      </section>
    </div>
  );
}



/**
 * One piece of outstanding work.
 *
 * A count with somewhere to go. The empty state matters as much as the count:
 * "The queue is clear" is a useful answer, and a bare 0 is not -- it reads
 * like a number that failed to load.
 */
function WorkCard({
  to,
  icon,
  title,
  count,
  loading,
  empty,
  cta,
  urgent,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  count: number;
  loading?: boolean;
  empty: string;
  cta: string;
  urgent?: boolean;
}) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-sm p-lg transition-colors',
        urgent && 'border-warning-light bg-warning-lighter',
      )}
    >
      <div className="flex items-center gap-sm">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            urgent ? 'bg-warning text-text-inverse' : 'bg-primary-tint text-primary',
          )}
        >
          {icon}
        </span>
        <p className="text-label-lg text-text-primary">{title}</p>
      </div>

      {loading ? (
        <Skeleton className="h-10 w-20" />
      ) : count > 0 ? (
        <p className="text-h1 text-text-primary tabular">{count}</p>
      ) : (
        <p className="text-body-md text-text-secondary">{empty}</p>
      )}

      <Link
        to={to}
        className="mt-auto inline-flex items-center gap-xxs text-label-md text-primary hover:underline"
      >
        {cta}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </Card>
  );
}

export default DashboardPage;
