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
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Mail, Phone } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { DetailPageSkeleton, PageMessage } from '@/components/layout/PageState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BILLING_DISABLED_BUILD } from '@/config/featureFlags';
import { CompanyActions } from '@/features/companies/CompanyActions';
import { useCompanyDecision } from '@/features/companies/useCompanyDecision';
import {
  companyStatusLabel,
  normalizeCompanyStatus,
  type CompanyDetail,
} from '@/models/platform';
import { getCompanyDetail } from '@/networks/superAdmin/platformNetwork';
import { formatDate, formatDateTime } from '@/utils/date';
import { messageOf } from '@/utils/errorMessage';

import { FeatureOverrideDialog } from './FeatureOverrideDialog';

export function CompanyDetailPage() {
  const { id = '' } = useParams();
  const { request, dialogs } = useCompanyDecision();
  const [overrideOpen, setOverrideOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['companies', 'detail', id],
    queryFn: () => getCompanyDetail(id),
    enabled: !!id,
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
  const owner = company.owner ?? null;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title={company.name}
        back={{ to: '/companies', label: 'All companies' }}
        status={<StatusBadge status={status} label={companyStatusLabel(company.status)} />}
        meta={[
          company.industry,
          `Registered ${formatDate(company.createdAt)}`,
          !BILLING_DISABLED_BUILD && company.isTrial
            ? company.trialConvertedAt
              ? 'Converted from trial'
              : 'On free trial'
            : null,
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-xs">
            <Button variant="secondary" size="sm" onClick={() => setOverrideOpen(true)}>
              Feature access
            </Button>
            <CompanyActions company={company} onRequest={request} />
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
        {/* The person the decision is about, and how to reach them. */}
        <Card className="p-lg lg:col-span-3">
          <h2 className="mb-md text-h4 text-text-primary">Owner</h2>
          {owner ? (
            <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:gap-xl">
              <div className="min-w-0">
                <p className="truncate text-label-lg text-text-primary">
                  {owner.displayName ?? 'Unnamed owner'}
                </p>
                <p className="flex items-center gap-xxs text-body-sm text-text-secondary">
                  <BadgeCheck
                    className={owner.isEmailVerified ? 'size-4 text-success' : 'size-4 text-text-tertiary'}
                    aria-hidden="true"
                  />
                  {owner.isEmailVerified ? 'Email confirmed' : 'Email not confirmed yet'}
                </p>
              </div>
              {owner.email && (
                <a
                  href={`mailto:${owner.email}`}
                  className="inline-flex min-w-0 items-center gap-xs text-body-md text-primary hover:underline"
                >
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{owner.email}</span>
                </a>
              )}
              {owner.phone && (
                <a
                  href={`tel:${owner.phone}`}
                  className="inline-flex items-center gap-xs text-body-md text-primary hover:underline"
                >
                  <Phone className="size-4 shrink-0" aria-hidden="true" />
                  {owner.phone}
                </a>
              )}
            </div>
          ) : (
            <p className="text-body-sm text-text-tertiary">
              The owner&rsquo;s details are not available for this company.
            </p>
          )}
        </Card>

        <Card className="p-lg lg:col-span-2">
          <h2 className="mb-md text-h4 text-text-primary">Team</h2>
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
              { label: 'Company email', value: company.email ?? '—' },
              { label: 'Company phone', value: company.phone ?? '—' },
              { label: 'Type', value: company.companyType ?? 'Unset' },
              // BILLING-DISABLED BUILD: nothing is sold, so these rows could
              // only ever read "No plan" and "—".
              {
                label: 'Plan',
                value: company.subscriptionPlan ?? 'No plan',
                emphasis: true,
                hidden: BILLING_DISABLED_BUILD,
              },
              {
                label: 'Subscription',
                value: company.subscriptionStatus ?? '—',
                hidden: BILLING_DISABLED_BUILD,
              },
              {
                label: 'Expires',
                value: formatDate(company.subscriptionExpiryDate),
                hidden: BILLING_DISABLED_BUILD,
              },
              {
                label: 'Trial started',
                value: formatDate(company.trialStartedAt),
                hidden: BILLING_DISABLED_BUILD || !company.trialStartedAt,
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

      {!BILLING_DISABLED_BUILD && (
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
      )}

      {/* Keyed on the record, so reopening it remounts with fresh initial
          state rather than re-seeding from an effect. Same pattern
          PaymentsPage uses to key the screenshot viewer on submission.id. */}
      <FeatureOverrideDialog
        key={`${company.id}-${overrideOpen}`}
        company={company}
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
      />

      {dialogs}
    </div>
  );
}

export default CompanyDetailPage;
