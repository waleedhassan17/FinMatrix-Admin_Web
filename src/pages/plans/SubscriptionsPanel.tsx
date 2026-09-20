// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Manual subscriptions
// ═══════════════════════════════════════════════════════
// GET and POST /super-admin/subscriptions. Neither had a UI.
//
// This sits as a tab beside the plan catalogue rather than as a seventh nav
// item: "what we sell" and "who we put on what" are the same question asked
// twice, and a console with six destinations is easier to hold than one with
// seven.
//
// READ-ONLY, and that is not a simplification -- assignment cannot currently
// be done correctly from here. There are two disjoint plan universes on the
// server:
//
//   plan-config.ts      warehouse/small_business/large_org tiers, priced in
//                       PKR, ids like 'warehouse_starter_6mo'. This is what
//                       the catalogue lists, what a customer is charged on
//                       submit, and what deliveryPersonnelLimit comes from.
//
//   subscription_plans  a UUID-keyed table seeded with Free / Starter /
//                       Professional / Enterprise at $0 / $29 / $290 -- an
//                       earlier design, in the wrong currency, that nothing
//                       customer-facing reads.
//
// POST /super-admin/subscriptions resolves dto.planId against the TABLE.
// Feeding it a catalogue id fails outright; feeding it a table id assigns a
// company to a dollar-priced plan FinMatrix does not sell. And the row it
// writes is decoupled from companies.subscription_plan, which is what
// actually gates access, so even a successful write changes nothing a
// customer experiences.
//
// The list below is real -- these are rows that exist -- so it stays. The
// assign action is gone until the server has one plan universe.

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { ErrorBanner } from '@/components/layout/PageState';
import { DataTable, TablePager } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { CompanySubscription } from '@/models/platform';
import { listSubscriptions } from '@/networks/superAdmin/platformNetwork';
import { formatDate } from '@/utils/date';

const PAGE_SIZE = 20;

export function SubscriptionsPanel() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['subscriptions', 'list', { page }],
    queryFn: () => listSubscriptions({ page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  const columns = [
    {
      header: 'Company',
      accessorKey: 'companyName',
      cell: ({ row }: { row: { original: CompanySubscription } }) => (
        <div className="min-w-0">
          <p className="truncate text-label-lg text-text-primary">
            {row.original.companyName ?? row.original.companyId}
          </p>
          <p className="truncate text-body-sm text-text-secondary">
            {row.original.companyEmail ?? '—'}
          </p>
        </div>
      ),
    },
    {
      header: 'Plan',
      accessorKey: 'planId',
      cell: ({ row }: { row: { original: CompanySubscription } }) =>
        row.original.plan?.name ?? row.original.planId,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }: { row: { original: CompanySubscription } }) => (
        <StatusBadge status={row.original.status} />
      ),
    },
    {
      header: 'Starts',
      accessorKey: 'startDate',
      cell: ({ row }: { row: { original: CompanySubscription } }) =>
        formatDate(row.original.startDate),
    },
    {
      header: 'Ends',
      accessorKey: 'endDate',
      cell: ({ row }: { row: { original: CompanySubscription } }) =>
        formatDate(row.original.endDate),
    },
  ];

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-start gap-sm rounded-md border border-warning-light bg-warning-lighter p-md">
        <AlertTriangle
          className="mt-[2px] size-4 shrink-0 text-warning"
          aria-hidden="true"
        />
        <p className="text-body-sm text-text-secondary">
          Read-only. These rows record what was assigned historically, but the
          plans they point at live in a separate table from the catalogue above
          and from what the billing flow charges — so assigning from here
          cannot currently produce a correct result. A company&rsquo;s real
          plan is on its company record.
        </p>
      </div>

      {isError && (
        <ErrorBanner
          error={error}
          fallback="Could not load subscriptions."
          onRetry={refetch}
        />
      )}

      <div>
        <DataTable<CompanySubscription>
          isLoading={isLoading}
          data={rows}
          columns={columns as never}
          empty={
            <span className="text-body-sm text-text-tertiary">
              No subscription has been assigned manually.
            </span>
          }
        />
        <TablePager
          page={page}
          totalPages={totalPages}
          total={total}
          onPage={setPage}
        />
      </div>
    </div>
  );
}

export default SubscriptionsPanel;
