// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Deciding on a company
// ═══════════════════════════════════════════════════════
// The four things an administrator does to a company, in one place, used by
// the list, the detail page and the dashboard.
//
// Since launch:
//   approve    → a plan with start and end dates, or "as a free trial"
//                (PATCH /admin/companies/:id/approve) — never a bare approval
//   reject     → the reason reaches the owner verbatim
//   deactivate → a suspension with a reason: every session ends at once, and
//                sign-in is refused until it is reinstated
//   activate   → reinstate a suspended company as it was, or put one whose
//                plan ended back on a plan

import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Field';
import { useSettle } from '@/features/platform/invalidation';
import {
  DECISIONS,
  type CompanyAction,
  type DecidableCompany,
} from '@/features/companies/companyDecisions';
import { PlanTermsDialog } from '@/features/launch/PlanTermsDialog';
import { REJECT_REASONS } from '@/models/platform';
import {
  activateCompany,
  approveCompany,
  reinstateCompany,
  suspendCompany,
  type PlanTerms,
} from '@/networks/superAdmin/launchAdminNetwork';
import { updateCompanyStatus } from '@/networks/superAdmin/platformNetwork';

type Pending = { company: DecidableCompany; action: CompanyAction };

/**
 * `request(company, action)` opens the right dialog; `dialogs` must be
 * rendered once by the page. Everything after the click — the request, the
 * toast, refreshing every list and count that shows the company — happens here.
 */
export function useCompanyDecision() {
  const { afterCompanyDecision } = useSettle();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');

  const decide = useMutation({
    mutationFn: async ({ company, action, terms }: Pending & { terms?: PlanTerms | null }) => {
      switch (action) {
        case 'approve':
          return approveCompany(company.id, terms ?? {});
        case 'reject':
          return updateCompanyStatus(company.id, DECISIONS.reject.status, reason.trim());
        case 'deactivate':
          return suspendCompany(company.id, reason.trim());
        case 'activate':
          if (company.suspendedAt) {
            await reinstateCompany(company.id);
            // Reinstated; new terms (if any) then apply to the restored company.
            return terms ? activateCompany(company.id, terms) : undefined;
          }
          return activateCompany(company.id, terms ?? {});
      }
    },
    onSuccess: (_result, { company, action }) => {
      afterCompanyDecision(company.id);
      toast.success(DECISIONS[action].toast, { description: company.name });
      setPending(null);
      setReason('');
    },
    onError: (e: Error) => toast.error('Could not update the company', { description: e.message }),
  });

  const request = (company: DecidableCompany, action: CompanyAction) => {
    setReason('');
    setPending({ company, action });
  };

  const close = (open: boolean) => {
    if (!open) {
      setPending(null);
      setReason('');
    }
  };

  const confirm = (terms?: PlanTerms | null) => pending && decide.mutate({ ...pending, terms });
  const name = pending?.company.name ?? '';
  const action = pending?.action ?? null;

  const reasonChips = (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap gap-xs">
        {REJECT_REASONS.map((r) => (
          <Chip key={r} active={reason === r} size="sm" onClick={() => setReason(r)}>
            {r}
          </Chip>
        ))}
      </div>
      <Textarea
        label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Pick one above, or write the reason"
      />
    </div>
  );

  const dialogs: ReactNode = (
    <>
      <PlanTermsDialog
        open={action === 'approve'}
        onOpenChange={close}
        title={`Approve ${name}`}
        description="Choose the plan and its end date, or start the company on its free trial. We email the owner."
        confirmLabel="Approve"
        allowTrial
        requestedPlan={pending?.company.requestedPlan}
        busy={decide.isPending}
        onConfirm={(terms) => confirm(terms)}
      />

      <ConfirmDialog
        open={action === 'deactivate'}
        onOpenChange={close}
        title={`Deactivate ${name}?`}
        description="A suspension: the owner and their team are signed out at once and cannot sign in until you activate the company again. Nothing is deleted. We email the owner the reason."
        confirmLabel="Deactivate"
        destructive
        busy={decide.isPending}
        confirmDisabled={reason.trim().length < 3}
        onConfirm={() => confirm()}
      >
        <Textarea
          label="Reason (sent to the owner)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Why access is paused"
        />
      </ConfirmDialog>

      <PlanTermsDialog
        open={action === 'activate'}
        onOpenChange={close}
        title={`Activate ${name}`}
        description={
          pending?.company.suspendedAt
            ? 'Reinstate it as it was, or put it on a new plan. We email the owner.'
            : 'Restore it, or — if its plan ended — put it on a plan with an end date. We email the owner.'
        }
        confirmLabel="Activate"
        allowKeepPlan
        requestedPlan={pending?.company.requestedPlan}
        busy={decide.isPending}
        onConfirm={(terms) => confirm(terms)}
      />

      <ConfirmDialog
        open={action === 'reject'}
        onOpenChange={close}
        title={`Reject ${name}?`}
        description="The owner is emailed this reason, so write it for them."
        confirmLabel="Reject"
        destructive
        busy={decide.isPending}
        // The server returns 400 when a rejection carries no reason, so this
        // floor is load-bearing rather than cosmetic.
        confirmDisabled={reason.trim().length < 3}
        onConfirm={() => confirm()}
      >
        {reasonChips}
      </ConfirmDialog>
    </>
  );

  return { request, dialogs, busy: decide.isPending };
}
