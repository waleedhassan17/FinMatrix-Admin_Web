// ═══════════════════════════════════════════════════════
// FinMatrix Admin — One company
// ═══════════════════════════════════════════════════════
// GET /super-admin/companies/:id has been live all along and getCompanyDetail
// was already written; nothing routed to it, so the console could only ever
// show a reviewer the handful of fields that fit in a table row.
//
// The endpoint returns the company entity plus its members and its
// subscription history — which is the difference between "approve this name I
// have never seen" and "approve this company, whose owner verified their email
// last Tuesday and who has been on a trial since the 3rd".

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { DetailPageSkeleton, PageMessage } from '@/components/layout/PageState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Field';
import { Chip } from '@/components/ui/Chip';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useSettle } from '@/features/platform/invalidation';
import {
  normalizeCompanyStatus,
  REJECT_REASONS,
  type CompanyDetail,
} from '@/models/platform';
import {
  getCompanyDetail,
  updateCompanyStatus,
} from '@/networks/superAdmin/platformNetwork';
import { formatDate, formatDateTime } from '@/utils/date';
import { messageOf } from '@/utils/errorMessage';

import { FeatureOverrideDialog } from './FeatureOverrideDialog';

/** Same vocabulary as the list, so a decision means the same thing in both. */
const DECISIONS = {
  approve: { status: 'active', toast: 'Company approved' },
  reject: { status: 'rejected', toast: 'Company rejected' },
  suspend: { status: 'inactive', toast: 'Company suspended' },
  reactivate: { status: 'active', toast: 'Company reactivated' },
} as const;

type DecisionAction = keyof typeof DECISIONS;

export function CompanyDetailPage() {
  const { id = '' } = useParams();
  const { afterCompanyDecision } = useSettle();

  const [action, setAction] = useState<DecisionAction | null>(null);
  const [reason, setReason] = useState('');
  const [overrideOpen, setOverrideOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['companies', 'detail', id],
    queryFn: () => getCompanyDetail(id),
    enabled: !!id,
  });

  const decide = useMutation({
    mutationFn: (next: DecisionAction) =>
      updateCompanyStatus(
        id,
        DECISIONS[next].status,
        next === 'reject' ? reason.trim() : undefined,
      ),
    onSuccess: (_r, next) => {
      afterCompanyDecision(id);
      toast.success(DECISIONS[next].toast, { description: data?.name });
      setAction(null);
      setReason('');
    },
    onError: (e: Error) =>
      toast.error('Could not update the company', { description: e.message }),
  });

  if (isLoading) return <DetailPageSkeleton />;

  if (isError || !data) {
    // A whole page with nothing on it, so PageMessage rather than the inline
    // ErrorBanner the list pages use.
    return (
      <PageMessage
        tone="error"
        title="Could not load this company"
        description={messageOf(error, 'It may have been removed.')}
        backTo="/companies"
        backLabel="All companies"
        onRetry={() => refetch()}
      />
    );
  }

  const company: CompanyDetail = data;
  const status = normalizeCompanyStatus(company.status);

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title={company.name}
        back={{ to: '/companies', label: 'All companies' }}
        status={<StatusBadge status={status} />}
        meta={[
          company.industry,
          `Registered ${formatDate(company.createdAt)}`,
          company.isTrial
            ? company.trialConvertedAt
              ? 'Converted from trial'
              : 'On free trial'
            : null,
        ]}
        actions={
          <div className="flex flex-wrap gap-xs">
            <Button variant="secondary" size="sm" onClick={() => setOverrideOpen(true)}>
              Feature access
            </Button>
            {status === 'pending' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setReason('');
                    setAction('reject');
                  }}
                >
                  Reject
                </Button>
                <Button size="sm" onClick={() => setAction('approve')}>
                  Approve
                </Button>
              </>
            )}
            {status === 'active' && (
              <Button variant="secondary" size="sm" onClick={() => setAction('suspend')}>
                Suspend
              </Button>
            )}
            {(status === 'inactive' || status === 'rejected') && (
              <Button variant="secondary" size="sm" onClick={() => setAction('reactivate')}>
                Reactivate
              </Button>
            )}
          </div>
        }
      />

      {company.rejectionReason && (
        <Card className="p-md">
          <p className="text-label-md text-text-secondary">Rejection reason</p>
          <p className="text-body-md text-text-primary">{company.rejectionReason}</p>
        </Card>
      )}

      <div className="grid gap-lg lg:grid-cols-3">
        <Card className="p-lg lg:col-span-2">
          <h2 className="mb-md text-h4 text-text-primary">Members</h2>
          {company.members.length === 0 ? (
            <p className="text-body-sm text-text-tertiary">
              Nobody has joined this company yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-light">
              {company.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-md py-sm">
                  <div className="min-w-0">
                    <p className="truncate text-label-md text-text-primary">
                      {m.displayName ?? m.email ?? 'Unnamed member'}
                    </p>
                    <p className="truncate text-body-sm text-text-secondary">
                      {m.email ?? '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-xxs">
                    <StatusBadge status={m.role} />
                    <span className="text-caption text-text-tertiary">
                      {m.joinedAt ? `Joined ${formatDate(m.joinedAt)}` : '—'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-lg">
          <h2 className="mb-md text-h4 text-text-primary">Account</h2>
          <KeyValueList
            items={[
              { label: 'Email', value: company.email ?? '—' },
              { label: 'Phone', value: company.phone ?? '—' },
              { label: 'Type', value: company.companyType ?? 'Unset' },
              {
                label: 'Plan',
                value: company.subscriptionPlan ?? 'No plan',
                emphasis: true,
              },
              {
                label: 'Subscription',
                value: company.subscriptionStatus ?? '—',
              },
              {
                label: 'Expires',
                value: formatDate(company.subscriptionExpiryDate),
              },
              {
                label: 'Trial started',
                value: formatDate(company.trialStartedAt),
                hidden: !company.trialStartedAt,
              },
              {
                label: 'Inventory',
                value: company.inventoryEnabled ? 'Enabled' : 'Disabled',
              },
              {
                // Only worth a row when it is on -- it is an exception, and a
                // permanent "No" teaches the reader to skip the row.
                label: 'Feature gates',
                value: 'Bypassed',
                hidden: !company.allFeaturesUnlocked,
                emphasis: true,
              },
              {
                label: 'Reviewed',
                value: formatDateTime(company.reviewedAt),
                hidden: !company.reviewedAt,
              },
              {
                label: 'Invite code',
                value: company.inviteCode ?? '—',
                hidden: !company.inviteCode,
              },
            ]}
          />
        </Card>
      </div>

      <Card className="p-lg">
        <h2 className="mb-md text-h4 text-text-primary">Subscription history</h2>
        {company.subscriptions.length === 0 ? (
          <p className="text-body-sm text-text-tertiary">
            No subscription has been assigned to this company.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-light">
            {company.subscriptions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-md py-sm">
                <div className="min-w-0">
                  <p className="truncate text-label-md text-text-primary">
                    {s.plan?.name ?? s.planId}
                  </p>
                  <p className="truncate text-body-sm text-text-secondary">
                    {formatDate(s.startDate)} — {formatDate(s.endDate)}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <FeatureOverrideDialog
        company={company}
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
      />

      <ConfirmDialog
        open={action === 'approve'}
        onOpenChange={(open) => !open && setAction(null)}
        title="Approve this company?"
        description={`${company.name} will be able to sign in and start using FinMatrix.`}
        confirmLabel="Approve"
        busy={decide.isPending}
        onConfirm={() => decide.mutate('approve')}
      />

      <ConfirmDialog
        open={action === 'suspend'}
        onOpenChange={(open) => !open && setAction(null)}
        title="Suspend this company?"
        description={`${company.name} will be blocked from signing in until it is reactivated. Its data is kept.`}
        confirmLabel="Suspend"
        destructive
        busy={decide.isPending}
        onConfirm={() => decide.mutate('suspend')}
      />

      <ConfirmDialog
        open={action === 'reactivate'}
        onOpenChange={(open) => !open && setAction(null)}
        title="Reactivate this company?"
        description={`${company.name} will be able to sign in again.`}
        confirmLabel="Reactivate"
        busy={decide.isPending}
        onConfirm={() => decide.mutate('reactivate')}
      />

      <ConfirmDialog
        open={action === 'reject'}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setReason('');
          }
        }}
        title="Reject this company?"
        description={`${company.name} will be told why. This reason reaches the owner, so write it for them.`}
        confirmLabel="Reject"
        destructive
        busy={decide.isPending}
        // The server returns 400 when a rejection carries no reason, so this
        // floor is load-bearing rather than cosmetic.
        confirmDisabled={reason.trim().length < 3}
        onConfirm={() => decide.mutate('reject')}
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
    </div>
  );
}

export default CompanyDetailPage;
