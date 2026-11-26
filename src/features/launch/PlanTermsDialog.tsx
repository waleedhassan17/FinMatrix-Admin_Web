// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Approve / activate with a plan and an end date
// ═══════════════════════════════════════════════════════
// Approving a company (or activating one whose plan ended) needs a plan, a
// start date (today if empty) and an end date — or "start as a free trial",
// which runs the same one-trial-per-account rules as the owner's own trial.
// The server refuses a bare approval (PLAN_REQUIRED_FOR_APPROVAL), so this
// dialog is the only way in. End-date presets cover the usual terms.

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { DateField } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import {
  addMonths,
  buildPlanTerms,
  END_DATE_PRESETS,
  pktDate,
  type TermsDraft,
} from '@/models/launchAdmin';
import { getOfferedPlans, type PlanTerms } from '@/networks/superAdmin/launchAdminNetwork';

export interface PlanTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  /** Offer "start as a free trial" (approvals; not activations). */
  allowTrial?: boolean;
  /** Offer "restore without changing the plan" (a suspended company). */
  allowKeepPlan?: boolean;
  /** Pre-selects the plan the owner asked for, when it is on offer. */
  requestedPlan?: string | null;
  busy?: boolean;
  /** `null` = keep the current plan (only when allowKeepPlan). */
  onConfirm: (terms: PlanTerms | null) => void;
}

export function PlanTermsDialog(props: PlanTermsDialogProps) {
  const { open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={props.title} description={props.description}>
      {/* Mounted per opening, so each starts from the requested plan. */}
      {open ? <TermsForm {...props} /> : null}
    </Dialog>
  );
}

function TermsForm({
  onOpenChange,
  confirmLabel,
  allowTrial,
  allowKeepPlan,
  requestedPlan,
  busy,
  onConfirm,
}: PlanTermsDialogProps) {
  const plans = useQuery({ queryKey: ['plans', 'offered'], queryFn: getOfferedPlans, staleTime: 300_000 });
  const today = pktDate();
  const [mode, setMode] = useState<'plan' | 'trial' | 'keep'>(allowKeepPlan ? 'keep' : 'plan');
  const offered = plans.data ?? [];
  const [draft, setDraft] = useState<TermsDraft>({
    asTrial: false,
    plan: requestedPlan && requestedPlan !== 'unsure' ? requestedPlan : '',
    startDate: '',
    endDate: addMonths(today, 12),
  });
  const [error, setError] = useState('');

  const submit = () => {
    if (mode === 'keep') return onConfirm(null);
    const built = buildPlanTerms({ ...draft, asTrial: mode === 'trial' }, today);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError('');
    onConfirm(built.terms);
  };

  const radio = (value: typeof mode, label: string, hint: string) => (
    <label className="flex cursor-pointer items-start gap-sm rounded-md border border-border-light p-sm">
      <input
        type="radio"
        name="terms-mode"
        className="mt-[3px]"
        checked={mode === value}
        onChange={() => setMode(value)}
      />
      <span>
        <span className="block text-label-md text-text-primary">{label}</span>
        <span className="block text-body-sm text-text-secondary">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-md px-lg py-md">
      {(allowTrial || allowKeepPlan) && (
        <div className="flex flex-col gap-xs" role="radiogroup" aria-label="How to switch it on">
          {allowKeepPlan && radio('keep', 'Restore as it was', 'The plan and end date it had before stay as they are.')}
          {radio('plan', 'On a plan', 'A plan, a start date and an end date.')}
          {allowTrial &&
            radio('trial', 'As a free trial', 'Runs the one-trial-per-account checks; refused if this account had one.')}
        </div>
      )}

      {mode === 'plan' && (
        <>
          <Select
            label="Plan"
            value={draft.plan}
            onChange={(plan) => setDraft((d) => ({ ...d, plan }))}
            options={offered.map((p) => ({ value: p.key, label: p.label }))}
            placeholder={plans.isLoading ? 'Loading plans…' : 'Choose a plan'}
          />
          <div className="grid gap-sm sm:grid-cols-2">
            <DateField
              label="Start date"
              value={draft.startDate}
              onChange={(startDate) => setDraft((d) => ({ ...d, startDate }))}
              hint="Empty = today"
            />
            <DateField
              label="End date"
              value={draft.endDate}
              onChange={(endDate) => setDraft((d) => ({ ...d, endDate }))}
            />
          </div>
          <div className="flex flex-wrap gap-xs" aria-label="End date presets">
            {END_DATE_PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setDraft((d) => ({ ...d, endDate: addMonths(d.startDate || today, p.months) }))
                }
              >
                {p.label}
              </Button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-sm border-t border-border-light pt-md">
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export default PlanTermsDialog;
