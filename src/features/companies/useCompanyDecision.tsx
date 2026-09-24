// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Deciding on a company
// ═══════════════════════════════════════════════════════
// The four things an administrator does to a company, in one place. The list,
// the detail page and the dashboard each used to carry their own copy of the
// status map and four confirmation dialogs, and the copies had started to say
// different things about the same action.

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
import { REJECT_REASONS } from '@/models/platform';
import { updateCompanyStatus } from '@/networks/superAdmin/platformNetwork';

type Pending = { company: DecidableCompany; action: CompanyAction };

/**
 * `request(company, action)` opens the right confirmation; `dialogs` must be
 * rendered once by the page. Everything after the click — the request, the
 * toast, refreshing every list and count that shows the company — happens here.
 */
export function useCompanyDecision() {
  const { afterCompanyDecision } = useSettle();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');

  const decide = useMutation({
    mutationFn: ({ company, action }: Pending) =>
      updateCompanyStatus(
        company.id,
        DECISIONS[action].status,
        action === 'reject' ? reason.trim() : undefined,
      ),
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

  const confirm = () => pending && decide.mutate(pending);
  const name = pending?.company.name ?? '';
  const action = pending?.action ?? null;

  const dialogs: ReactNode = (
    <>
      <ConfirmDialog
        open={action === 'approve'}
        onOpenChange={close}
        title={`Approve ${name}?`}
        description="The owner can sign in and start using FinMatrix straight away, and we email them to say so."
        confirmLabel="Approve"
        busy={decide.isPending}
        onConfirm={confirm}
      />

      <ConfirmDialog
        open={action === 'deactivate'}
        onOpenChange={close}
        title={`Deactivate ${name}?`}
        description="The owner and their team lose access at once and cannot sign in until you activate the company again. Nothing is deleted. We email the owner."
        confirmLabel="Deactivate"
        destructive
        busy={decide.isPending}
        onConfirm={confirm}
      />

      <ConfirmDialog
        open={action === 'activate'}
        onOpenChange={close}
        title={`Activate ${name}?`}
        description="The owner and their team can sign in again straight away, with all their data as they left it. We email the owner."
        confirmLabel="Activate"
        busy={decide.isPending}
        onConfirm={confirm}
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
        onConfirm={confirm}
      >
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
      </ConfirmDialog>
    </>
  );

  return { request, dialogs, busy: decide.isPending };
}
