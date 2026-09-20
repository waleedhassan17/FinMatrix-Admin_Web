// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Subscription plans
// ═══════════════════════════════════════════════════════
// Plans are still DEFINED in the server's plan-config.ts, not in a table --
// that has not changed, and it is why there is no "new plan" button: a plan
// key is a foreign key in every company row, and minting one at runtime gives
// you a key with no config behind it.
//
// What IS editable is the price, the rider limit, the name, and whether a
// plan is still sold. Those edits are stored as an overlay on the config and
// take effect on the next quote.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Info, Pencil, Users } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorBanner } from '@/components/layout/PageState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Field';

import { EditPlanDialog } from './EditPlanDialog';
import { SubscriptionsPanel } from './SubscriptionsPanel';
import { resolvePlanFeatures } from '@/models/planFeatures';
import type { SubscriptionPlan } from '@/models/platform';
import { getSubscriptionPlans } from '@/networks/superAdmin/platformNetwork';
import { formatMoney } from '@/utils/money';

export function PlansPage() {
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['plans', 'list'],
    queryFn: getSubscriptionPlans,
  });

  const plans = data ?? [];

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Subscription plans"
        description="What the platform sells, and who is on what."
      />

      <Tabs defaultValue="catalogue">
        <TabsList>
          <TabsTrigger value="catalogue" count={plans.length}>
            Catalogue
          </TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogue">
          <div className="flex flex-col gap-lg pt-md">
      <div className="flex items-start gap-sm rounded-md border border-info-light bg-primary-tint p-md">
        <Info className="mt-[2px] size-4 shrink-0 text-info" aria-hidden="true" />
        <p className="text-body-sm text-text-secondary">
          Editing a price changes what <strong>new</strong> customers are
          quoted and charged, immediately. Nobody already on a plan is re-billed
          or moved. Duration, tier and currency are fixed in the server
          configuration — those are part of what existing customers were sold.
        </p>
      </div>

      {isError && (
        <ErrorBanner
          error={error}
          fallback="Could not load plans."
          onRetry={refetch}
        />
      )}

      {isLoading ? (
        <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : plans.length === 0 ? (
        <Card className="p-xxl text-center">
          <p className="text-body-md text-text-secondary">
            The server returned no plans.
          </p>
        </Card>
      ) : (
        <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onEdit={() => setEditing(plan)} />
          ))}
        </div>
      )}
          </div>
        </TabsContent>

        <TabsContent value="subscriptions">
          <div className="pt-md">
            <SubscriptionsPanel />
          </div>
        </TabsContent>
      </Tabs>

      {/* Keyed on the plan, so opening a different one starts from its own
          values rather than the previous plan's. */}
      {editing && (
        <EditPlanDialog
          key={editing.id}
          plan={editing}
          open
          onOpenChange={(next) => !next && setEditing(null)}
        />
      )}
    </div>
  );
}

function PlanCard({
  plan,
  onEdit,
}: {
  plan: SubscriptionPlan;
  onEdit: () => void;
}) {
  // "Everything in <tier>" is resolved to what that tier actually included —
  // the tier it points at is no longer sold, so the line would name something
  // the reader cannot see.
  const features = resolvePlanFeatures(plan.features);

  return (
    <Card className="flex flex-col p-lg">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="truncate text-h4 text-text-primary">{plan.name}</p>
          {plan.description && (
            <p className="mt-xxs text-body-sm text-text-secondary">
              {plan.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-xxs">
          <StatusBadge
            status={plan.isOffered === false ? 'inactive' : 'active'}
          />
          {/* Says the price is not the configured one, so a number that looks
              wrong can be traced rather than doubted. */}
          {plan.isEdited && (
            <span className="rounded-full bg-primary-tint px-xs text-caption text-primary">
              Edited
            </span>
          )}
        </div>
      </div>

      <div className="mt-md flex items-baseline gap-xs">
        {/* totalLabel is the server's own formatted string. Both label fields
            are optional, and priceMonthly is a raw DECIMAL string — rendering
            it as-is prints a bare "4500" beside the "Rs 139,500.00" figures on
            every other page. formatMoney is the one formatter. */}
        <span className="text-h2 text-text-primary tabular">
          {plan.totalLabel ?? formatMoney(plan.priceMonthly)}
        </span>
        {plan.monthlyLabel && (
          <span className="text-body-sm text-text-secondary">
            {plan.monthlyLabel}/month
          </span>
        )}
      </div>

      {(plan.durationMonths || plan.deliveryPersonnelLimit !== undefined) && (
        <p className="mt-xxs flex flex-wrap items-center gap-x-sm gap-y-xxs text-caption text-text-tertiary">
          {plan.durationMonths ? (
            <span>
              {plan.durationMonths} {plan.durationMonths === 1 ? 'month' : 'months'}
            </span>
          ) : null}
          {plan.deliveryPersonnelLimit !== undefined && (
            <span className="inline-flex items-center gap-xxs">
              <Users className="size-3" aria-hidden="true" />
              {plan.deliveryPersonnelLimit}{' '}
              {plan.deliveryPersonnelLimit === 1 ? 'rider' : 'riders'}
            </span>
          )}
        </p>
      )}

      <div className="mt-md">
        <Button variant="secondary" size="sm" onClick={onEdit} full>
          <Pencil className="size-4" aria-hidden="true" />
          Edit plan
        </Button>
      </div>

      {features.length > 0 && (
        <ul className="mt-md flex flex-col gap-xs">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-xs">
              <Check
                className="mt-[3px] size-3.5 shrink-0 text-success"
                aria-hidden="true"
              />
              <span className="text-body-sm text-text-secondary">{f}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default PlansPage;
