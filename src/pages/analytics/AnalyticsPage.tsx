// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Revenue analytics
// ═══════════════════════════════════════════════════════
// Every figure from the API is in MINOR UNITS (paisa). The headline numbers use
// the server's pre-formatted *Label strings; the chart converts, because an
// axis needs a number.

import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionHeader } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { StatTile } from '@/components/ui/StatTile';
import { ErrorBanner } from '@/components/layout/PageState';
import { formatDayMonth } from '@/utils/date';
import { cn } from '@/lib/cn';
import {
  shareOfTotal,
  toMonthlySeries,
  toRupees,
  trendPct,
  type RevenueByCompany,
  type RevenueByPlan,
  type RevenueEntry,
} from '@/models/revenue';
import { getPlatformRevenue } from '@/networks/superAdmin/submissionNetwork';
import { CHART_SERIES, colors, typography } from '@/theme/tokens';
import { compactMoney, formatMoney } from '@/utils/money';

// Read from tokens rather than inlined, which is also what keeps
// scripts/check-design-tokens.js quiet.
const AXIS_TICK = {
  fill: colors.textTertiary,
  fontSize: typography.caption.fontSize,
} as const;


export function AnalyticsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['revenue', 'summary'],
    queryFn: getPlatformRevenue,
  });

  const series = toMonthlySeries(data?.monthly);
  const trend = trendPct(data?.monthly);
  const total = data?.totalMinorUnits ?? 0;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Revenue"
        description="Collected from approved payment submissions."
      />

      {isError && (
        <ErrorBanner
          error={error}
          fallback="Could not load revenue."
          onRetry={refetch}
        />
      )}

      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Collected all time"
          value={data?.totalLabel ?? formatMoney(0)}
          loading={isLoading}
        />
        <StatTile
          label="This month"
          value={data?.thisMonthLabel ?? formatMoney(0)}
          loading={isLoading}
          hint={
            trend === null
              ? undefined
              : `${trend >= 0 ? '+' : ''}${trend}% on last month`
          }
          tone={trend === null ? 'default' : trend >= 0 ? 'success' : 'danger'}
        />
        <StatTile
          label="Payments"
          value={String(data?.paymentsCount ?? 0)}
          loading={isLoading}
        />
        <StatTile
          label="Awaiting review"
          value={String(data?.pendingSubmissions ?? 0)}
          loading={isLoading}
          tone={data?.pendingSubmissions ? 'warning' : 'default'}
        />
      </div>

      <Card className="p-lg">
        <div className="flex items-start justify-between">
          <SectionHeader title="Last six months" />
          {trend !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-xxs text-label-md',
                trend >= 0 ? 'text-success' : 'text-danger',
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="size-4" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-4" aria-hidden="true" />
              )}
              {trend >= 0 ? '+' : ''}
              {trend}%
            </span>
          )}
        </div>
        <div className="mt-md h-64">
          {isLoading ? (
            <div className="size-full animate-pulse rounded-md bg-neutral-100" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={CHART_SERIES[0]}
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="100%"
                      stopColor={CHART_SERIES[0]}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={colors.borderLight} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={AXIS_TICK}
                  tickFormatter={(v: number) => compactMoney(v)}
                />
                <Tooltip
                  formatter={(v) => formatMoney(v as number)}
                  contentStyle={{
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_SERIES[0]}
                  strokeWidth={2}
                  fill="url(#revFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid gap-md xl:grid-cols-2">
        <Card className="p-lg">
          <SectionHeader title="By plan" />
          <div className="mt-md flex flex-col gap-sm">
            {(data?.byPlan ?? []).length === 0 ? (
              <p className="text-body-sm text-text-tertiary">
                Nothing collected yet.
              </p>
            ) : (
              (data?.byPlan ?? []).map((p: RevenueByPlan, i: number) => (
                <div key={p.plan} className="flex flex-col gap-xxs">
                  <div className="flex items-baseline justify-between gap-sm">
                    <span className="min-w-0 truncate text-label-md text-text-primary">
                      {p.planLabel}
                    </span>
                    <span className="shrink-0 text-body-sm text-text-secondary tabular">
                      {formatMoney(toRupees(p.totalMinorUnits))} · {p.payments}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${shareOfTotal(p.totalMinorUnits, total)}%`,
                        backgroundColor:
                          CHART_SERIES[i % CHART_SERIES.length],
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-lg">
          <SectionHeader title="Top companies" />
          <div className="mt-md flex flex-col gap-sm">
            {(data?.byCompany ?? []).length === 0 ? (
              <p className="text-body-sm text-text-tertiary">
                Nothing collected yet.
              </p>
            ) : (
              (data?.byCompany ?? [])
                .slice(0, 8)
                .map((c: RevenueByCompany) => (
                  <div
                    key={c.companyId}
                    className="flex items-baseline justify-between gap-sm"
                  >
                    <span className="min-w-0 truncate text-label-md text-text-primary">
                      {c.companyName}
                    </span>
                    <span className="shrink-0 text-body-sm text-text-secondary tabular">
                      {formatMoney(toRupees(c.totalMinorUnits))}
                    </span>
                  </div>
                ))
            )}
          </div>
        </Card>
      </div>

      <section className="flex flex-col gap-sm">
        <h2 className="text-h4 text-text-primary">Recent payments</h2>
        <DataTable<RevenueEntry>
          isLoading={isLoading}
          data={data?.entries ?? []}
          empty={
            <span className="text-body-sm text-text-tertiary">
              No payments have been collected yet.
            </span>
          }
          columns={[
            {
              header: 'Company',
              accessorKey: 'companyName',
            },
            {
              header: 'Plan',
              accessorKey: 'planLabel',
            },
            {
              header: 'Recorded',
              accessorKey: 'recordedAt',
              cell: ({ row }) => formatDayMonth(row.original.recordedAt),
            },
            {
              header: 'Amount',
              accessorKey: 'amountLabel',
              meta: { align: 'right' },
              cell: ({ row }) => row.original.amountLabel,
            },
          ]}
        />
      </section>
    </div>
  );
}

export default AnalyticsPage;
