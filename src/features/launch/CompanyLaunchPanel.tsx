// ═══════════════════════════════════════════════════════
// FinMatrix Admin — a company's plan, trial and account controls
// ═══════════════════════════════════════════════════════
// On the company detail page:
//   Plan & trial   plan, end date, trial state; extend (1–30 days), end early,
//                  grant a trial — each with a reason, all audited server-side
//   Demo / test    the flag that allows bulk deletion
//   Trial claims   every claim on this company or its owner
//   Danger zone    delete the company: a preview of what goes, a reason, the
//                  "allow a new free trial" choice, and the name typed exactly.
//                  The server suspends at once, keeps a final backup 30 days
//                  when real books exist, purges, and records an audit entry.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useSettle } from '@/features/platform/invalidation';
import { confirmationMatches } from '@/models/launchAdmin';
import type { CompanyDetail } from '@/models/platform';
import {
  deleteCompany,
  endTrial,
  extendTrial,
  getDeletionJob,
  getDeletionPreview,
  getTrialClaims,
  grantTrial,
  setCompanyDemo,
  type DeletionJob,
} from '@/networks/superAdmin/launchAdminNetwork';
import { formatDate } from '@/utils/date';

type TrialAction = 'extend' | 'end' | 'grant';

export function CompanyLaunchPanel({ company }: { company: CompanyDetail }) {
  const { afterCompanyDecision } = useSettle();
  const queryClient = useQueryClient();
  const [trialAction, setTrialAction] = useState<TrialAction | null>(null);
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Read once per mount: whether the trial is still running right now.
  const [now] = useState(() => Date.now());
  const trialRunning =
    company.isTrial &&
    !company.trialConvertedAt &&
    !!company.subscriptionExpiryDate &&
    new Date(company.subscriptionExpiryDate).getTime() > now;
  const trialEnded = company.isTrial && !company.trialConvertedAt && !trialRunning;

  const claims = useQuery({
    queryKey: ['companies', 'detail', company.id, 'claims'],
    queryFn: () => getTrialClaims(company.id),
  });

  const act = useMutation({
    mutationFn: () => {
      const r = reason.trim();
      if (trialAction === 'extend') return extendTrial(company.id, Number(days), r);
      if (trialAction === 'end') return endTrial(company.id, r);
      return grantTrial(company.id, r);
    },
    onSuccess: () => {
      toast.success(
        trialAction === 'extend' ? `Trial extended by ${days} days` : trialAction === 'end' ? 'Trial ended' : 'Trial granted',
        { description: company.name },
      );
      afterCompanyDecision(company.id);
      void queryClient.invalidateQueries({ queryKey: ['trials'] });
      setTrialAction(null);
      setReason('');
    },
    onError: (e: Error) => toast.error('Could not update the trial', { description: e.message }),
  });

  const demo = useMutation({
    mutationFn: (isDemo: boolean) => setCompanyDemo(company.id, isDemo),
    onSuccess: (r) => {
      toast.success(r.isDemo ? 'Flagged as demo/test' : 'Demo flag removed', { description: company.name });
      afterCompanyDecision(company.id);
    },
    onError: (e: Error) => toast.error('Could not change the flag', { description: e.message }),
  });

  const daysNum = Number(days);
  const canSubmit =
    reason.trim().length >= 3 && (trialAction !== 'extend' || (Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 30));

  return (
    <>
      <div className="grid gap-lg lg:grid-cols-3">
        <Card className="p-lg lg:col-span-2" data-testid="plan-trial-card">
          <h2 className="mb-md text-h4 text-text-primary">Plan &amp; trial</h2>
          <dl className="grid gap-sm sm:grid-cols-2">
            <div>
              <dt className="text-label-sm text-text-secondary">Plan</dt>
              <dd className="text-body-md text-text-primary">{company.subscriptionPlanLabel ?? company.subscriptionPlan ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-label-sm text-text-secondary">Ends</dt>
              <dd className="text-body-md text-text-primary">
                {company.subscriptionExpiryDate ? formatDate(company.subscriptionExpiryDate) : 'No end date'}
              </dd>
            </div>
            <div>
              <dt className="text-label-sm text-text-secondary">Trial</dt>
              <dd className="text-body-md text-text-primary">
                {trialRunning ? 'Running' : trialEnded ? 'Ended' : company.trialConvertedAt ? 'Converted' : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-label-sm text-text-secondary">Requested plan</dt>
              <dd className="text-body-md text-text-primary">{company.requestedPlan ?? '—'}</dd>
            </div>
          </dl>
          {company.suspendedAt && (
            <p className="mt-md rounded-md bg-warning-lighter p-sm text-body-sm text-text-primary">
              Suspended {formatDate(company.suspendedAt)}
              {company.suspensionReason ? ` — ${company.suspensionReason}` : ''}
            </p>
          )}
          <div className="mt-md flex flex-wrap gap-xs">
            {(trialRunning || trialEnded) && (
              <Button size="sm" variant="secondary" onClick={() => setTrialAction('extend')}>
                Extend trial
              </Button>
            )}
            {trialRunning && (
              <Button size="sm" variant="secondary" onClick={() => setTrialAction('end')}>
                End trial early
              </Button>
            )}
            {!company.isTrial && (
              <Button size="sm" variant="secondary" onClick={() => setTrialAction('grant')}>
                Grant a trial
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-lg">
          <h2 className="mb-md text-h4 text-text-primary">Demo / test</h2>
          <p className="mb-md text-body-sm text-text-secondary">
            Demo and test companies can be deleted in bulk. Real customers never are.
          </p>
          <label className="flex items-center gap-sm text-body-md text-text-primary">
            <input
              type="checkbox"
              checked={company.isDemo === true}
              disabled={demo.isPending}
              onChange={(e) => demo.mutate(e.target.checked)}
            />
            This is a demo or test company
          </label>
        </Card>
      </div>

      <Card className="p-lg">
        <h2 className="mb-md text-h4 text-text-primary">Trial claims</h2>
        {claims.isLoading ? (
          <p className="text-body-sm text-text-tertiary">Loading…</p>
        ) : (claims.data ?? []).length === 0 ? (
          <p className="text-body-sm text-text-tertiary">No trial has been claimed by this company or its owner.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-light">
            {(claims.data ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-sm py-sm">
                <span className="text-body-sm text-text-primary">
                  {c.companyName ?? 'Deleted company'} · {c.sameCompany ? 'this company' : 'same owner'}
                  {c.source ? ` · ${c.source}` : ''}
                  {c.releaseReason ? ` · released (${c.releaseReason})` : ''}
                </span>
                <span className="flex items-center gap-sm">
                  <span className="text-body-sm text-text-secondary">{formatDate(c.createdAt)}</span>
                  <StatusBadge status={c.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="border border-danger p-lg">
        <h2 className="mb-xs text-h4 text-danger">Danger zone</h2>
        <p className="mb-md text-body-sm text-text-secondary">
          Deleting removes the company, its books and files, and users who belong to no other company. It cannot be
          undone. A final backup is kept for 30 days when it has posted books.
        </p>
        <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
          Delete company…
        </Button>
      </Card>

      <Dialog
        open={trialAction !== null}
        onOpenChange={(o) => {
          if (!o) {
            setTrialAction(null);
            setReason('');
          }
        }}
        title={
          trialAction === 'extend' ? 'Extend the trial' : trialAction === 'end' ? 'End the trial early' : 'Grant a free trial'
        }
        description={
          trialAction === 'extend'
            ? 'Adds days from today or from the current end, whichever is later. The owner is emailed.'
            : trialAction === 'end'
              ? 'Access stops now; data is kept and the owner can still download a backup. The owner is emailed.'
              : 'Starts a trial outside the usual identity checks. Use it for a deliberate exception.'
        }
      >
        <div className="flex flex-col gap-md px-lg py-md">
          {trialAction === 'extend' && (
            <Input label="Days (1–30)" type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} />
          )}
          <Textarea label="Reason (audited)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-sm">
            <Button variant="secondary" onClick={() => setTrialAction(null)} disabled={act.isPending}>
              Cancel
            </Button>
            <Button
              variant={trialAction === 'end' ? 'danger' : 'primary'}
              disabled={!canSubmit || act.isPending}
              onClick={() => act.mutate()}
            >
              {act.isPending ? 'Working…' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Dialog>

      <DeleteCompanyDialog company={company} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

function DeleteCompanyDialog({
  company,
  open,
  onOpenChange,
}: {
  company: CompanyDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${company.name}`}
      description="Permanent. Read what will be removed, then type the company name exactly."
    >
      {open ? <DeleteForm company={company} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function DeleteForm({ company, onClose }: { company: CompanyDetail; onClose: () => void }) {
  const navigate = useNavigate();
  const { afterCompanyDecision } = useSettle();
  const preview = useQuery({
    queryKey: ['companies', 'detail', company.id, 'deletion-preview'],
    queryFn: () => getDeletionPreview(company.id),
  });
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [allowNewTrial, setAllowNewTrial] = useState<boolean | null>(null);
  const [job, setJob] = useState<DeletionJob | null>(null);
  const allow = allowNewTrial ?? preview.data?.allowNewTrialDefault ?? false;

  const run = useMutation({
    mutationFn: () => deleteCompany(company.id, { confirmName: typed.trim(), reason: reason.trim(), allowNewTrial: allow }),
    onSuccess: (j) => setJob(j),
    onError: (e: Error) => toast.error('Could not delete the company', { description: e.message }),
  });

  // The deletion runs in the background; follow it until it finishes.
  const jobQ = useQuery({
    queryKey: ['company-deletions', job?.id],
    queryFn: () => getDeletionJob(job!.id),
    enabled: !!job,
    refetchInterval: (q) => {
      const s = q.state.data?.status ?? job?.status;
      return s === 'done' || s === 'completed' || s === 'failed' ? false : 1500;
    },
  });
  const current = jobQ.data ?? job;
  const finished = current?.status === 'done' || current?.status === 'completed';

  useEffect(() => {
    if (!finished) return;
    toast.success('Company deleted', { description: company.name });
    afterCompanyDecision(company.id);
  }, [finished, company.id, company.name, afterCompanyDecision]);

  if (current) {
    return (
      <div className="flex flex-col gap-md px-lg py-md" data-testid="deletion-progress">
        <p className="text-body-md text-text-primary">
          Status: <StatusBadge status={current.status} />
        </p>
        {current.error && <p className="text-body-sm text-danger">{current.error}</p>}
        {finished && (
          <p className="text-body-sm text-text-secondary">
            {current.usersDeleted ?? 0} users deleted · {current.membershipsRemoved ?? 0} memberships removed ·{' '}
            {current.filesDeleted ?? 0} files deleted
            {current.finalBackupId ? ' · final backup kept 30 days (Deleted accounts)' : ''}
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={() => (finished ? navigate('/companies') : onClose())}>{finished ? 'Done' : 'Close'}</Button>
        </div>
      </div>
    );
  }

  const p = preview.data;
  return (
    <div className="flex flex-col gap-md px-lg py-md">
      {preview.isLoading ? (
        <p className="text-body-sm text-text-tertiary">Counting what would be removed…</p>
      ) : p ? (
        <ul className="flex flex-col gap-xxs text-body-sm text-text-primary" data-testid="deletion-preview">
          <li>{p.totalRows.toLocaleString()} rows across {Object.values(p.rowCounts).filter((n) => n > 0).length} tables</li>
          <li>{p.files} stored files</li>
          <li>
            {p.usersDeleted} users deleted · {p.membershipsRemoved} keep their other companies
          </li>
          <li>
            {p.postedEntries} posted journal entries
            {p.finalBackup ? ' — a final backup is kept for 30 days' : ''}
          </li>
          {p.isDemo && <li>Flagged demo/test</li>}
        </ul>
      ) : (
        <p className="text-body-sm text-danger">The preview could not be loaded.</p>
      )}
      <label className="flex items-start gap-sm text-body-sm text-text-primary">
        <input type="checkbox" className="mt-[3px]" checked={allow} onChange={(e) => setAllowNewTrial(e.target.checked)} />
        <span>
          Allow a new free trial for this owner&apos;s email, phone and NTN
          <span className="block text-text-secondary">Leave off for a real customer: their trial was used.</span>
        </span>
      </label>
      <Textarea label="Reason (audited)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      <Input
        label={`Type ${company.name} to confirm`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
      />
      <div className="flex justify-end gap-sm">
        <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={!confirmationMatches(typed, company.name) || reason.trim().length < 3 || run.isPending || !p}
          onClick={() => run.mutate()}
        >
          {run.isPending ? 'Deleting…' : 'Delete permanently'}
        </Button>
      </div>
    </div>
  );
}

export default CompanyLaunchPanel;
