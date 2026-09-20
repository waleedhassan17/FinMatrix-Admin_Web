// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Edit a plan
// ═══════════════════════════════════════════════════════
// PATCH /super-admin/plans/:key.
//
// This is the only screen in the console where an admin action changes what a
// customer is charged, which sets the tone for all of it: amounts are entered
// in rupees but held and sent in paisa, the total is derived rather than typed
// so it cannot disagree with the monthly rate, and the dialog says in words
// what the new price means before it will let you save.
//
// Only some fields are editable, and the ones that are not are shown anyway
// -- an editor that silently omits duration and tier invites the question
// "where do I change that?", and the answer is worth giving on the spot.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Field';
import { useSettle } from '@/features/platform/invalidation';
import type { SubscriptionPlan, UpdatePlanInput } from '@/models/platform';
import { resetPlan, updatePlan } from '@/networks/superAdmin/platformNetwork';

/**
 * Rupees in the field, paisa on the wire.
 *
 * Math.round is the whole point. Rupee amounts whose product lands a hair
 * short of the integer -- 0.29 * 100 is 28.999999999999996, 8.29 * 100 is
 * 828.9999999999999 -- would lose a paisa to truncation or a bitwise `| 0`.
 *
 * Known limit, accepted: a half-paisa cannot be resolved. 1.005 * 100 is
 * 100.49999999999999, so this yields 100 rather than the 101 a human would
 * write. Prices here are whole rupees, so the case does not arise; see
 * planMoney.test.ts in the app for the same note.
 */
const toPaisa = (rupees: string): number =>
  Math.round(Number(rupees.replace(/,/g, '')) * 100);

const toRupees = (paisa: number | undefined): string =>
  paisa === undefined ? '' : String(paisa / 100);

const fmt = (paisa: number, currency = 'PKR') =>
  `${currency === 'PKR' ? 'Rs' : currency} ${(paisa / 100).toLocaleString('en-US')}`;

export function EditPlanDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: SubscriptionPlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { afterPlanEdit } = useSettle();

  const [label, setLabel] = useState(plan.name);
  const [monthly, setMonthly] = useState(toRupees(plan.monthlyMinorUnits));
  const [riders, setRiders] = useState(String(plan.deliveryPersonnelLimit ?? 0));
  const [offered, setOffered] = useState(plan.isOffered !== false);
  const [confirmReset, setConfirmReset] = useState(false);

  const months = plan.durationMonths ?? 0;
  const monthlyPaisa = monthly.trim() === '' ? NaN : toPaisa(monthly);
  const monthlyValid = Number.isFinite(monthlyPaisa) && monthlyPaisa >= 0;

  // Derived, never typed. The server enforces total = monthly × duration, and
  // a second input for it would only let the operator produce a rejection.
  const totalPaisa = monthlyValid ? monthlyPaisa * months : NaN;

  const ridersNum = riders.trim() === '' ? NaN : Number(riders);
  const ridersValid = Number.isInteger(ridersNum) && ridersNum >= 0;

  const save = useMutation({
    mutationFn: () => {
      const input: UpdatePlanInput = {};
      if (label.trim() && label.trim() !== plan.name) input.label = label.trim();
      if (monthlyValid && monthlyPaisa !== plan.monthlyMinorUnits) {
        input.monthlyMinorUnits = monthlyPaisa;
        input.priceMinorUnits = totalPaisa;
      }
      if (ridersValid && ridersNum !== (plan.deliveryPersonnelLimit ?? 0)) {
        input.deliveryPersonnelLimit = ridersNum;
      }
      if (offered !== (plan.isOffered !== false)) input.isOffered = offered;
      return updatePlan(plan.id, input);
    },
    onSuccess: () => {
      afterPlanEdit();
      toast.success('Plan updated', {
        description: `New customers are now quoted ${fmt(totalPaisa, plan.currency)}.`,
      });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error('Could not update the plan', { description: e.message }),
  });

  const revert = useMutation({
    mutationFn: () => resetPlan(plan.id),
    onSuccess: () => {
      afterPlanEdit();
      toast.success('Plan reset', {
        description: `${plan.name} is back to its configured pricing.`,
      });
      setConfirmReset(false);
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error('Could not reset the plan', { description: e.message }),
  });

  const priceChanged = monthlyValid && monthlyPaisa !== plan.monthlyMinorUnits;
  const changed =
    priceChanged ||
    (label.trim() && label.trim() !== plan.name) ||
    (ridersValid && ridersNum !== (plan.deliveryPersonnelLimit ?? 0)) ||
    offered !== (plan.isOffered !== false);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Edit ${plan.name}`}
        description="Changes apply to new customers immediately. Nobody is re-billed."
        footer={
          <>
            {plan.isEdited && (
              <Button
                variant="text"
                onClick={() => setConfirmReset(true)}
                className="mr-auto"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset to configured
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!changed || !monthlyValid || !ridersValid || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md p-lg">
          <Input
            label="Display name"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            hint="What buyers see on the plan card."
          />

          <Input
            label={`Monthly price (${plan.currency ?? 'PKR'})`}
            inputMode="decimal"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            error={
              monthly.trim() !== '' && !monthlyValid
                ? 'Enter a number of rupees, 0 or more.'
                : undefined
            }
          />

          {/* The derived total, stated plainly. This is the number that is
              actually charged -- the monthly rate is only how it is quoted --
              so it should not be something the operator has to work out. */}
          {monthlyValid && months > 0 && (
            <div className="rounded-md bg-neutral-50 p-md">
              <p className="text-label-md text-text-primary">
                Charged up front: {fmt(totalPaisa, plan.currency)}
              </p>
              <p className="text-body-sm text-text-secondary">
                {fmt(monthlyPaisa, plan.currency)} × {months} months, billed
                once at the start of the period.
              </p>
              {priceChanged && (
                <p className="mt-xs text-body-sm text-warning">
                  Was {fmt(plan.priceYearly ? Number(plan.priceYearly) * 100 : 0, plan.currency)}.
                  Existing customers keep what they were sold.
                </p>
              )}
            </div>
          )}

          <Input
            label="Delivery riders included"
            inputMode="numeric"
            value={riders}
            onChange={(e) => setRiders(e.target.value)}
            hint="The only plan limit the platform enforces."
            error={
              riders.trim() !== '' && !ridersValid
                ? 'Enter a whole number, 0 or more.'
                : undefined
            }
          />

          <div className="flex items-start justify-between gap-md rounded-md border border-border-light p-md">
            <div className="min-w-0">
              <p className="text-label-md text-text-primary">Sold to new customers</p>
              <p className="text-body-sm text-text-secondary">
                Turn this off to retire the plan. Companies already on it keep
                it, keep renewing and keep their price — it simply stops being
                offered. This is the safe alternative to deleting a plan.
              </p>
            </div>
            <Switch checked={offered} onCheckedChange={setOffered} />
          </div>

          {/* Shown rather than hidden: an editor that silently drops these
              invites "where do I change the duration?", and the answer is
              worth giving here. */}
          <div className="flex items-start gap-sm rounded-md bg-primary-tint p-md">
            <AlertTriangle
              className="mt-[2px] size-4 shrink-0 text-info"
              aria-hidden="true"
            />
            <p className="text-body-sm text-text-secondary">
              Duration ({months} months), tier and currency are fixed in the
              server configuration. They are part of what existing customers
              were sold, and the plan&rsquo;s id encodes the duration — changing
              either needs a config change and a deploy.
            </p>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset this plan?"
        description={`${plan.name} goes back to the price and limits in the server configuration. Companies already on it are unaffected.`}
        confirmLabel="Reset"
        destructive
        busy={revert.isPending}
        onConfirm={() => revert.mutate()}
      />
    </>
  );
}

export default EditPlanDialog;
