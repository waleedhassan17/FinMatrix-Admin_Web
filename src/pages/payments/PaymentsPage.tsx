// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Payment submissions
// ═══════════════════════════════════════════════════════
// The review queue. Two kinds of row share it and they are decided on different
// evidence:
//
//   a PAYMENT — someone transferred money and uploaded the receipt. Decided on
//   the amount and the screenshot.
//
//   a TRIAL — someone asked for the 30-day free trial. No money, no receipt.
//   Decided on who asked and how long they have waited. Owners are promised
//   activation within 24 hours, so the wait is shown and flagged before that
//   promise breaks.
//
// Rendering a trial row as a payment is the regression this screen keeps
// having: "Rs 0" and a dead "View transfer screenshot" link.

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ImageIcon, Mail, Phone, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useSettle } from '@/features/platform/invalidation';
import { ErrorBanner } from '@/components/layout/PageState';
import { Chip } from '@/components/ui/Chip';
import { TablePager } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import {
  hasViewableScreenshot,
  isKindKey,
  isSubmissionStatus,
  isTrialSubmission,
  KIND_FILTERS,
  KIND_PARAM,
  STATUS_FILTERS,
  type KindKey,
  type PaymentSubmissionView,
  type SubmissionStatus,
} from '@/models/submission';
import { isOverdue, waitingLabel } from '@/models/trial';
import {
  approvePaymentSubmission,
  getScreenshotUrl,
  listPaymentSubmissions,
  rejectPaymentSubmission,
} from '@/networks/superAdmin/submissionNetwork';

/** The app's KIND_COLORS, as token-backed classes. */
// Card-shaped rows, so a page of 25 is already a long scroll.
const PAGE_SIZE = 25;

const KIND_CLASS: Record<string, string> = {
  NEW: 'bg-info-light text-info',
  RENEWAL: 'bg-success-lighter text-success',
  UPGRADE: 'bg-secondary-light text-secondary',
  TRIAL: 'bg-warning-lighter text-warning',
};

export function PaymentsPage() {
  const [params, setParams] = useSearchParams();
  const { afterSubmissionDecision } = useSettle();

  const rawStatus = params.get('status');
  const status: SubmissionStatus = isSubmissionStatus(rawStatus)
    ? rawStatus
    : 'submitted';
  const rawKind = params.get('kind');
  const kind: KindKey = isKindKey(rawKind) ? rawKind : 'all';
  // Same clamp as CompaniesPage: this is user-editable, and NaN or 0 would
  // slice an empty window out of a queue that has rows in it.
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const [rejecting, setRejecting] = useState<PaymentSubmissionView | null>(null);
  const [approving, setApproving] = useState<PaymentSubmissionView | null>(null);
  const [reason, setReason] = useState('');
  const [blockFutureTrials, setBlockFutureTrials] = useState(false);
  const [viewing, setViewing] = useState<PaymentSubmissionView | null>(null);

  // Changing a filter drops back to page 1 -- page 3 of "approved" is not
  // page 3 of "submitted", and landing past the end reads as an empty queue.
  const setFilters = (next: { status?: SubmissionStatus; kind?: KindKey }) => {
    const q: Record<string, string> = {};
    const s = next.status ?? status;
    const k = next.kind ?? kind;
    if (s !== 'submitted') q.status = s;
    if (k !== 'all') q.kind = k;
    setParams(q);
  };

  const setPage = (next: number) => {
    const q: Record<string, string> = { page: String(next) };
    if (status !== 'submitted') q.status = status;
    if (kind !== 'all') q.kind = kind;
    setParams(q);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['submissions', 'list', { status, kind }],
    queryFn: () =>
      listPaymentSubmissions({
        status,
        kind: KIND_PARAM[kind],
        // Oldest first while reviewing: the longest wait is the most urgent.
        order: status === 'submitted' ? 'asc' : 'desc',
      }),
    // The decided tabs are history. The submitted queue changes when a tenant
    // pays; approved and rejected only grow, and this endpoint sends all of
    // them, so refetching that on every visit is the expensive half.
    staleTime: status === 'submitted' ? 30_000 : 5 * 60_000,
  });

  const settle = afterSubmissionDecision;

  const approve = useMutation({
    mutationFn: (s: PaymentSubmissionView) => approvePaymentSubmission(s.id),
    onSuccess: (_r, s) => {
      settle();
      toast.success(
        isTrialSubmission(s) ? 'Free trial activated' : 'Payment approved',
        { description: s.companyName ?? s.requesterName },
      );
      setApproving(null);
    },
    onError: (e: Error) =>
      toast.error('Could not approve', { description: e.message }),
  });

  const reject = useMutation({
    mutationFn: (s: PaymentSubmissionView) =>
      rejectPaymentSubmission(
        s.id,
        reason.trim(),
        isTrialSubmission(s) ? blockFutureTrials : undefined,
      ),
    onSuccess: (_r, s) => {
      settle();
      toast.success('Submission rejected', {
        description: s.companyName ?? s.requesterName,
      });
      setRejecting(null);
      setReason('');
      setBlockFutureTrials(false);
    },
    onError: (e: Error) =>
      toast.error('Could not reject', { description: e.message }),
  });

  // This endpoint has NO server-side limit -- it returns every row matching
  // the filters. For `submitted` that is bounded by the review backlog, but
  // `approved` grows forever: every payment ever taken. Nothing can be done
  // about the payload without a backend change, but rendering all of it is
  // the part that makes the page unusable, so the list is windowed here.
  //
  // Deliberately not useInfiniteQuery: there is no cursor, and paging an array
  // already held in memory is a lie dressed as pagination.
  const rows = data ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Payment submissions"
        description="Bank transfers and free-trial requests waiting on a decision."
        // "shown" was the one honest label while the page rendered everything,
        // and becomes wrong the moment it does not.
        meta={[rows.length > 0 ? `${rows.length} total` : null]}
      />

      <div className="flex flex-wrap items-center gap-md">
        <div className="flex flex-wrap gap-xs">
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.key}
              active={status === f.key}
              onClick={() => setFilters({ status: f.key })}
            >
              {f.label}
            </Chip>
          ))}
        </div>
        <span className="h-4 w-px bg-border" aria-hidden="true" />
        <div className="flex flex-wrap gap-xs">
          {KIND_FILTERS.map((f) => (
            <Chip
              key={f.key}
              active={kind === f.key}
              onClick={() => setFilters({ kind: f.key })}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      {isError && (
        <ErrorBanner
          error={error}
          fallback="Could not load the queue."
          onRetry={refetch}
        />
      )}

      {isLoading ? (
        <div className="flex flex-col gap-sm">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-xxl text-center">
          <p className="text-body-md text-text-secondary">
            {status === 'submitted'
              ? 'Nothing is waiting for review.'
              : `No ${status} submissions.`}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-sm">
          {visible.map((s) => (
            <SubmissionRow
              key={s.id}
              submission={s}
              onApprove={() => setApproving(s)}
              onReject={() => {
                setReason('');
                setBlockFutureTrials(false);
                setRejecting(s);
              }}
              onViewScreenshot={() => setViewing(s)}
            />
          ))}
          {/* TablePager was written for DataTable but is a standalone export,
              and already prints "Page X of Y · N total" and renders nothing
              for a single page. */}
          <TablePager
            page={page}
            totalPages={totalPages}
            total={rows.length}
            onPage={setPage}
          />
        </div>
      )}

      <ConfirmDialog
        open={approving !== null}
        onOpenChange={(open) => !open && setApproving(null)}
        title={
          approving && isTrialSubmission(approving)
            ? 'Activate this free trial?'
            : 'Approve this payment?'
        }
        description={
          approving && isTrialSubmission(approving)
            ? `${approving.requesterName ?? approving.companyName ?? 'The requester'} gets 30 days, starting now.`
            : `${approving?.companyName ?? ''} will be marked paid for ${approving?.planLabel ?? 'their plan'}.`
        }
        confirmLabel={
          approving && isTrialSubmission(approving) ? 'Activate' : 'Approve'
        }
        busy={approve.isPending}
        onConfirm={() => approving && approve.mutate(approving)}
      />

      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null);
            setReason('');
            setBlockFutureTrials(false);
          }
        }}
        title={
          rejecting && isTrialSubmission(rejecting)
            ? 'Reject this trial request?'
            : 'Reject this payment?'
        }
        description="The reason is sent to whoever submitted this, so write it for them."
        confirmLabel="Reject"
        destructive
        busy={reject.isPending}
        confirmDisabled={reason.trim().length < 3}
        onConfirm={() => rejecting && reject.mutate(rejecting)}
      >
        <div className="flex flex-col gap-sm">
          <Textarea
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why is this being rejected?"
          />
          {rejecting && isTrialSubmission(rejecting) && (
            <label className="flex items-start gap-sm rounded-md bg-warning-lighter p-sm">
              <input
                type="checkbox"
                checked={blockFutureTrials}
                onChange={(e) => setBlockFutureTrials(e.target.checked)}
                className="mt-[3px] size-4 shrink-0"
              />
              <span className="text-body-sm text-text-secondary">
                <span className="text-label-md text-text-primary">
                  Block future trial requests
                </span>
                <br />
                Leave this off and they may ask again. Turn it on only for abuse
                — it refuses this email and phone permanently.
              </span>
            </label>
          )}
        </div>
      </ConfirmDialog>

      {viewing && (
        <ScreenshotDialog
          key={viewing.id}
          submission={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}


function SubmissionRow({
  submission: s,
  onApprove,
  onReject,
  onViewScreenshot,
}: {
  submission: PaymentSubmissionView;
  onApprove: () => void;
  onReject: () => void;
  onViewScreenshot: () => void;
}) {
  const trial = isTrialSubmission(s);
  const waiting = typeof s.ageHours === 'number' ? s.ageHours : null;
  const overdue = isOverdue(s.ageHours);
  const decidable = s.status === 'submitted';

  return (
    <Card className="flex flex-col gap-md p-lg lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-xs">
          <span
            className={cn(
              'rounded-xs px-2 py-1 text-label-sm',
              KIND_CLASS[s.kind] ?? 'bg-neutral-100 text-text-secondary',
            )}
          >
            {s.kind}
          </span>
          <StatusBadge status={s.status} />
          {waiting !== null && s.status === 'submitted' && (
            <span
              className={cn(
                'inline-flex items-center gap-xxs text-caption',
                overdue ? 'text-danger' : 'text-text-tertiary',
              )}
            >
              {overdue && <AlertTriangle className="size-3" aria-hidden="true" />}
              Waiting {waitingLabel(waiting)}
              {trial && overdue && ' · promised within 24 h'}
            </span>
          )}
        </div>

        <p className="mt-xs text-label-lg text-text-primary">
          {s.companyName ?? s.requesterName ?? 'Unknown'}
        </p>
        <p className="text-body-sm text-text-secondary">{s.planLabel}</p>

        {/* A trial is decided on who asked; a payment on what was paid. */}
        {trial ? (
          <div className="mt-sm flex flex-col gap-xxs text-body-sm text-text-secondary">
            {s.requesterName && (
              <span className="inline-flex items-center gap-xs">
                <User className="size-3.5" aria-hidden="true" />
                {s.requesterName}
              </span>
            )}
            {s.requesterEmail && (
              <span className="inline-flex items-center gap-xs">
                <Mail className="size-3.5" aria-hidden="true" />
                {s.requesterEmail}
              </span>
            )}
            {s.requesterPhone && (
              <span className="inline-flex items-center gap-xs">
                <Phone className="size-3.5" aria-hidden="true" />
                {s.requesterPhone}
              </span>
            )}
          </div>
        ) : (
          <div className="mt-sm flex flex-wrap items-center gap-md">
            <div>
              <p className="text-caption text-text-secondary">Amount</p>
              <p className="text-h4 text-text-primary tabular">{s.amountLabel}</p>
            </div>
            {hasViewableScreenshot(s) && (
              <Button size="sm" variant="secondary" onClick={onViewScreenshot}>
                <ImageIcon className="size-4" aria-hidden="true" />
                View transfer screenshot
              </Button>
            )}
          </div>
        )}

        {s.rejectionReason && (
          <p className="mt-sm rounded-md bg-danger-lighter p-sm text-body-sm text-danger">
            {s.rejectionReason}
          </p>
        )}
      </div>

      {decidable && (
        <div className="flex shrink-0 gap-xs">
          <Button variant="secondary" size="sm" onClick={onReject}>
            Reject
          </Button>
          <Button size="sm" onClick={onApprove}>
            {trial ? 'Activate' : 'Approve'}
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * The screenshot viewer.
 *
 * The endpoint is auth-gated and streams bytes, so <img src={url}> would send
 * no Authorization header and get a 401. It is fetched as a blob through the
 * axios instance instead, and the resulting object URL is revoked on close —
 * otherwise every screenshot opened stays in memory for the life of the tab.
 */
function ScreenshotDialog({
  submission,
  onClose,
}: {
  submission: PaymentSubmissionView;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // The caller keys this on submission.id, so opening a different screenshot
  // remounts with fresh state rather than clearing the old one here. The effect
  // only synchronises with the fetch, which is what an effect is for.
  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;

    getScreenshotUrl(submission.id)
      .then((u) => {
        if (revoked) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch((e: Error) => setFailed(e.message));

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [submission.id]);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={submission.companyName ?? 'Transfer screenshot'}
      description={`${submission.planLabel} · ${submission.amountLabel}`}
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex min-h-64 items-center justify-center p-lg">
        {failed ? (
          <p className="text-body-sm text-danger">{failed}</p>
        ) : url ? (
          <img
            src={url}
            alt={`Transfer screenshot for ${submission.companyName ?? 'this submission'}`}
            className="max-h-[70vh] w-auto rounded-md"
          />
        ) : (
          <Spinner />
        )}
      </div>
    </Dialog>
  );
}

export default PaymentsPage;
