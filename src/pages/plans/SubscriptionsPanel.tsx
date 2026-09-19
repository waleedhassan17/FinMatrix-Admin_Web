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
// The caveat in the banner is not decoration. This endpoint writes the legacy
// company_subscriptions table, which is DECOUPLED from the
// companies.subscription_plan columns the server actually gates access on.
// Assigning here does not activate anyone, and an operator who assumes it does
// will leave a paying customer locked out.

import { useState } from 'react';
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { ErrorBanner } from '@/components/layout/PageState';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePager } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { DateField, Textarea } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useSettle } from '@/features/platform/invalidation';
import type {
  CompanySubscription,
  SubscriptionPlan,
} from '@/models/platform';
import {
  assignSubscription,
  getCompanies,
  listSubscriptions,
} from '@/networks/superAdmin/platformNetwork';
import { formatDate } from '@/utils/date';

const PAGE_SIZE = 20;

export function SubscriptionsPanel({ plans }: { plans: SubscriptionPlan[] }) {
  const [page, setPage] = useState(1);
  const [assignOpen, setAssignOpen] = useState(false);

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
          Assigning a subscription here records it against the company, but it
          does <strong>not</strong> by itself activate that company or extend
          its access — those are driven by the payment flow. Use this for
          corrections and manual arrangements, then check the company record.
        </p>
      </div>

      {isError && (
        <ErrorBanner
          error={error}
          fallback="Could not load subscriptions."
          onRetry={refetch}
        />
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAssignOpen(true)}>
          Assign a plan
        </Button>
      </div>

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

      <AssignSubscriptionDialog
        plans={plans}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
    </div>
  );
}

function AssignSubscriptionDialog({
  plans,
  open,
  onOpenChange,
}: {
  plans: SubscriptionPlan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { afterSubscriptionAssign } = useSettle();

  const [companyId, setCompanyId] = useState('');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  // There is no company search endpoint, so this is the first page of
  // companies rather than a lookup. Enough for the correction-shaped work this
  // screen is for; a picker that implied search would be lying.
  const { data: companies } = useQuery({
    queryKey: ['companies', 'list', { filter: 'all', page: 1 }],
    queryFn: () => getCompanies({ page: 1, limit: 100 }),
    enabled: open,
  });

  const assign = useMutation({
    mutationFn: () =>
      assignSubscription({
        companyId,
        planId,
        startDate: new Date(startDate).toISOString(),
        ...(endDate ? { endDate: new Date(endDate).toISOString() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: () => {
      afterSubscriptionAssign();
      toast.success('Subscription assigned');
      onOpenChange(false);
      setCompanyId('');
      setPlanId('');
      setNotes('');
    },
    onError: (e: Error) =>
      toast.error('Could not assign the subscription', {
        description: e.message,
      }),
  });

  const ready = !!companyId && !!planId && !!startDate;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign a plan"
      description="Records a subscription against a company."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!ready || assign.isPending}
            onClick={() => assign.mutate()}
          >
            {assign.isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md p-lg">
        <Select
          label="Company"
          value={companyId}
          onChange={setCompanyId}
          placeholder="Choose a company"
          options={(companies?.data ?? []).map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />
        <Select
          label="Plan"
          value={planId}
          onChange={setPlanId}
          placeholder="Choose a plan"
          options={plans.map((p) => ({ value: p.id, label: p.name }))}
        />
        <DateField
          label="Starts"
          value={startDate}
          onChange={setStartDate}
        />
        <DateField
          label="Ends"
          value={endDate}
          onChange={setEndDate}
          hint="Optional. Leave blank for an open-ended arrangement."
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Why this was assigned by hand"
        />
      </div>
    </Dialog>
  );
}

export default SubscriptionsPanel;
