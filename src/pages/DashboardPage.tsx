// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Platform overview
// ═══════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getPlatformStats } from '@/networks/superAdmin/platformNetwork';

/** StatTile takes a pre-formatted string, so the caller owns the unit. */
const count = (n: number | undefined): string => (n ?? 0).toLocaleString('en-US');

const dateOf = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
};

type Registration = {
  id: string;
  name: string;
  industry: string | null;
  email: string | null;
  status: string;
  createdAt: string;
};

export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['platform', 'stats'],
    queryFn: getPlatformStats,
  });

  const companies = data?.companies;
  const subscriptions = data?.subscriptions;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Platform overview"
        description="Every business running on FinMatrix, at a glance."
      />

      {isError && (
        <div role="alert" className="rounded-md bg-danger-lighter p-sm">
          <p className="text-body-sm text-danger">
            {(error as Error)?.message ?? 'Could not load platform statistics.'}
          </p>
        </div>
      )}

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
          label="Awaiting approval"
          value={count(companies?.pending)}
          loading={isLoading}
          tone={companies?.pending ? 'warning' : 'default'}
        />
        <StatTile
          label="Active"
          value={count(companies?.active)}
          loading={isLoading}
          tone="success"
        />
        <StatTile
          label="Rejected"
          value={count(companies?.rejected)}
          loading={isLoading}
          tone={companies?.rejected ? 'danger' : 'default'}
        />
      </div>

      {/* Real links, not the app's six `navigate('Companies' as any)` casts —
          a URL a reviewer can bookmark, and one TypeScript can check. */}
      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
        <QuickAction
          to="/companies?filter=pending"
          icon={<Clock className="size-4" />}
          label="Review pending companies"
          count={companies?.pending}
        />
        <QuickAction
          to="/payments"
          icon={<CreditCard className="size-4" />}
          label="Payment submissions"
        />
        <QuickAction
          to="/analytics"
          icon={<TrendingUp className="size-4" />}
          label="Revenue analytics"
        />
        <QuickAction
          to="/plans"
          icon={<Building2 className="size-4" />}
          label={`Plans (${subscriptions?.totalPlans ?? 0})`}
        />
      </div>

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
              cell: ({ row }) => dateOf(row.original.createdAt),
            },
          ]}
        />
      </section>

      <section className="grid gap-md sm:grid-cols-3">
        <MiniStat
          icon={<CheckCircle2 className="size-4 text-success" />}
          label="Active subscriptions"
          value={subscriptions?.activeSubscriptions ?? 0}
        />
        <MiniStat
          icon={<CreditCard className="size-4 text-primary" />}
          label="Total subscriptions"
          value={subscriptions?.totalSubscriptions ?? 0}
        />
        <MiniStat
          icon={<XCircle className="size-4 text-neutral-400" />}
          label="Suspended companies"
          value={companies?.suspended ?? 0}
        />
      </section>
    </div>
  );
}

function QuickAction({
  to,
  icon,
  label,
  count,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-sm rounded-lg bg-surface p-md shadow-card transition-colors hover:bg-surface-hover"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-label-md text-text-primary">
        {label}
      </span>
      {count ? (
        <span className="rounded-full bg-warning px-[6px] py-[1px] text-label-sm text-text-inverse tabular">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex items-center gap-sm p-md">
      {icon}
      <span className="flex-1 text-body-sm text-text-secondary">{label}</span>
      <span className="text-h4 text-text-primary tabular">{value}</span>
    </Card>
  );
}

export default DashboardPage;
