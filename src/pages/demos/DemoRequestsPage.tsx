// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Demo requests (Book a Demo pipeline)
// ═══════════════════════════════════════════════════════
// The list by status, with search and CSV export; a drawer per request for
// the work: call or WhatsApp the prospect, schedule (or reschedule) with a
// meeting link — the server sends the .ics — move it through the pipeline
// (the server refuses a move the state machine does not allow), keep notes,
// link the company they registered, and send the free-trial invite.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, MessageCircle, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorBanner } from '@/components/layout/PageState';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { DataTable, TablePager } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DEMO_STATUS_LABEL, schedulingFor, statusMovesFor, waLink } from '@/models/launchAdmin';
import {
  addDemoNote,
  exportDemoCsv,
  getDemoRequest,
  linkDemoCompany,
  listDemoRequests,
  scheduleDemo,
  sendDemoTrialInvite,
  setDemoStatus,
  type DemoRequest,
  type DemoStatus,
} from '@/networks/superAdmin/launchAdminNetwork';
import { formatDateTime } from '@/utils/date';

const STATUSES = Object.keys(DEMO_STATUS_LABEL) as DemoStatus[];
const PAGE_SIZE = 25;
type Row = { row: { original: DemoRequest } };

/** "2026-12-07T10:00" (Pakistan time) → UTC ISO. */
const pktLocalToIso = (local: string): string => new Date(`${local}:00+05:00`).toISOString();

export function DemoRequestsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const [text, setText] = useState(q);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const next = text.trim();
    if (next === q) return;
    const t = setTimeout(
      () => setParams({ ...(status ? { status } : {}), ...(next ? { q: next } : {}) }, { replace: true }),
      300,
    );
    return () => clearTimeout(t);
  }, [text, q, status, setParams]);

  const list = useQuery({
    queryKey: ['demos', 'list', { status, q, page }],
    queryFn: () => listDemoRequests({ status: status || undefined, q: q || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const download = async () => {
    try {
      const blob = await exportDemoCsv({ status: status || undefined, q: q || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'demo-requests.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Could not export', { description: (e as Error).message });
    }
  };

  const columns = [
    {
      header: 'Prospect',
      id: 'who',
      cell: ({ row }: Row) => (
        <div className="min-w-0">
          <p className="truncate text-label-lg text-text-primary">{row.original.businessName}</p>
          <p className="truncate text-body-sm text-text-secondary">
            {row.original.fullName} · {row.original.city}
          </p>
        </div>
      ),
    },
    {
      header: 'Contact',
      id: 'contact',
      cell: ({ row }: Row) => (
        <div className="flex items-center gap-xs" onClick={(e) => e.stopPropagation()}>
          <a className="text-primary" href={`tel:${row.original.phone}`} aria-label={`Call ${row.original.fullName}`}>
            <Phone className="size-4" />
          </a>
          <a className="text-primary" href={waLink(row.original.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp">
            <MessageCircle className="size-4" />
          </a>
          <span className="truncate text-body-sm text-text-secondary">{row.original.phone}</span>
        </div>
      ),
    },
    { header: 'System', id: 'system', cell: ({ row }: Row) => row.original.currentSystem ?? '—' },
    {
      header: 'When',
      id: 'when',
      cell: ({ row }: Row) =>
        formatDateTime(row.original.scheduledAt ?? row.original.preferredSlotAt ?? row.original.createdAt),
    },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }: Row) => <StatusBadge status={row.original.status} label={DEMO_STATUS_LABEL[row.original.status]} />,
    },
  ];

  const counts = list.data?.counts ?? {};
  const pagination = list.data?.pagination;

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title="Demo requests"
        description="Book a Demo bookings, in Pakistan time. Open one to schedule, take notes or send the trial invite."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void download()}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />
      <div className="flex flex-wrap gap-xs" aria-label="Status">
        <Chip active={!status} onClick={() => setParams({})}>
          All
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setParams({ status: s })}>
            {DEMO_STATUS_LABEL[s]}
            {counts[s] ? ` (${counts[s]})` : ''}
          </Chip>
        ))}
      </div>
      {list.isError && <ErrorBanner error={list.error} fallback="The demo requests could not be loaded." onRetry={() => list.refetch()} />}
      <DataTable
        columns={columns as never}
        data={list.data?.items ?? []}
        isLoading={list.isLoading}
        onRowClick={(r) => setOpenId(r.id)}
        toolbar={<SearchInput value={text} onValueChange={setText} placeholder="Name, business, phone or email" aria-label="Search" size="sm" />}
        empty={<p className="p-lg text-body-sm text-text-tertiary">No demo requests.</p>}
      />
      {pagination && pagination.pages > 1 && (
        <TablePager
          page={page}
          totalPages={pagination.pages}
          total={pagination.total}
          onPage={(p) => setParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), page: String(p) })}
        />
      )}
      {openId && <DemoDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function DemoDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['demos', 'detail', id], queryFn: () => getDemoRequest(id) });
  const [when, setWhen] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [lostReason, setLostReason] = useState('');

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['demos'] });
  };
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      toast.success('Saved');
      refresh();
    },
    onError: (e: Error) => toast.error('Could not save', { description: e.message }),
  });

  const d = detail.data;
  const scheduling = d ? schedulingFor(d.status) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={d ? d.businessName : 'Demo request'} className="max-w-panel">
      <div className="flex flex-col gap-md overflow-y-auto px-lg py-md" data-testid="demo-drawer">
        {!d ? (
          <p className="text-body-sm text-text-tertiary">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-sm">
              <StatusBadge status={d.status} label={DEMO_STATUS_LABEL[d.status]} />
              <a className="inline-flex items-center gap-xxs text-label-md text-primary" href={`tel:${d.phone}`}>
                <Phone className="size-4" /> {d.phone}
              </a>
              <a className="inline-flex items-center gap-xxs text-label-md text-primary" href={waLink(d.phone)} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
              <a className="text-label-md text-primary" href={`mailto:${d.email}`}>
                {d.email}
              </a>
            </div>
            <dl className="grid gap-xs text-body-sm sm:grid-cols-2">
              <div><dt className="text-text-secondary">Name</dt><dd>{d.fullName}</dd></div>
              <div><dt className="text-text-secondary">City · type</dt><dd>{d.city} · {d.businessType}</dd></div>
              <div><dt className="text-text-secondary">Team · system</dt><dd>{d.teamSize ?? '—'} · {d.currentSystem ?? '—'}</dd></div>
              <div><dt className="text-text-secondary">Language</dt><dd>{d.language === 'ur' ? 'Urdu' : 'English'}</dd></div>
              <div><dt className="text-text-secondary">Asked for</dt><dd>{d.preferredSlotAt ? formatDateTime(d.preferredSlotAt) : '—'}</dd></div>
              <div><dt className="text-text-secondary">Scheduled</dt><dd>{d.scheduledAt ? formatDateTime(d.scheduledAt) : '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-text-secondary">Message</dt><dd>{d.message ?? '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-text-secondary">Source</dt><dd>{d.utm ? Object.entries(d.utm).map(([k, v]) => `${k}=${v}`).join(' · ') : d.referrer ?? '—'}</dd></div>
            </dl>

            {scheduling && (
              <div className="flex flex-col gap-sm rounded-md border border-border-light p-sm">
                <p className="text-label-md text-text-primary">{scheduling === 'schedule' ? 'Schedule' : 'Reschedule'} (Pakistan time)</p>
                <div className="grid gap-sm sm:grid-cols-2">
                  <Input label="Date and time" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                  <Input label="Meeting link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet…" />
                </div>
                <Button
                  size="sm"
                  disabled={!when || run.isPending}
                  onClick={() => run.mutate(() => scheduleDemo(d.id, pktLocalToIso(when), link.trim() || undefined, scheduling === 'reschedule'))}
                >
                  {scheduling === 'schedule' ? 'Schedule and send invite' : 'Reschedule and send update'}
                </Button>
              </div>
            )}

            {statusMovesFor(d.status).length > 0 && (
              <div className="flex flex-col gap-sm">
                <p className="text-label-md text-text-primary">Move to</p>
                <div className="flex flex-wrap gap-xs">
                  {statusMovesFor(d.status)
                    .filter((s) => s !== 'lost')
                    .map((s) => (
                      <Button key={s} size="sm" variant="secondary" disabled={run.isPending} onClick={() => run.mutate(() => setDemoStatus(d.id, s))}>
                        {DEMO_STATUS_LABEL[s]}
                      </Button>
                    ))}
                </div>
                {statusMovesFor(d.status).includes('lost') && (
                  <div className="flex items-end gap-xs">
                    <Input label="Lost — reason" value={lostReason} onChange={(e) => setLostReason(e.target.value)} containerClassName="flex-1" />
                    <Button size="sm" variant="danger" disabled={lostReason.trim().length < 3 || run.isPending} onClick={() => run.mutate(() => setDemoStatus(d.id, 'lost', lostReason.trim()))}>
                      Mark lost
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-xs">
              <Button
                size="sm"
                variant="secondary"
                disabled={run.isPending || d.status === 'lost'}
                onClick={() =>
                  run.mutate(async () => {
                    const r = await sendDemoTrialInvite(d.id);
                    if (!r.trialEligible) toast.info('Sent — this person is not eligible for a trial; the email offers account approval.');
                  })
                }
              >
                Send free-trial invite
              </Button>
              {d.convertedCompanyId && <StatusBadge status="active" label="Linked to a company" />}
            </div>

            {!d.convertedCompanyId && d.suggestedCompanies.length > 0 && (
              <div className="flex flex-col gap-xs">
                <p className="text-label-md text-text-primary">Registered companies that match</p>
                {d.suggestedCompanies.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-sm">
                    <span className="text-body-sm">{c.name} · {c.status}</span>
                    <Button size="sm" variant="secondary" onClick={() => run.mutate(() => linkDemoCompany(d.id, c.id))}>
                      Link
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-xs">
              <Textarea label="Add a note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button
                size="sm"
                variant="secondary"
                disabled={!note.trim() || run.isPending}
                onClick={() => run.mutate(async () => { await addDemoNote(d.id, note.trim()); setNote(''); })}
              >
                Save note
              </Button>
              <ul className="flex flex-col gap-xxs">
                {d.notes.map((n) => (
                  <li key={n.id} className="text-body-sm text-text-primary">
                    <span className="text-caption text-text-secondary">{formatDateTime(n.createdAt)} — </span>
                    {n.body}
                  </li>
                ))}
              </ul>
            </div>

            {d.history.length > 0 && (
              <details>
                <summary className="cursor-pointer text-label-md text-text-secondary">History ({d.history.length})</summary>
                <ul className="mt-xs flex flex-col gap-xxs">
                  {d.history.map((h, i) => (
                    <li key={i} className="text-caption text-text-secondary">
                      {formatDateTime(h.at)} · {h.action}
                      {h.reason ? ` — ${h.reason}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

export default DemoRequestsPage;
