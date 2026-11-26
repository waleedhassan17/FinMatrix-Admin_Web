// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Migrations (read-only)
// ═══════════════════════════════════════════════════════
// Every company's Migration Center batches: status, readiness, open problems
// by code and the hard checks' totals — never row data. Support uses it when
// an owner asks for help (the help email quotes the MIG- reference). Stuck =
// still open and untouched for 3 days.

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorBanner } from '@/components/layout/PageState';
import { Chip } from '@/components/ui/Chip';
import { DataTable, TablePager } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getMigration, getMigrationCounts, listMigrations, type MigrationSummary } from '@/networks/superAdmin/launchAdminNetwork';
import { formatDate, formatDateTime } from '@/utils/date';

const PAGE_SIZE = 25;
type Row = { row: { original: MigrationSummary } };
const FILTERS = [
  { key: '', label: 'All' },
  { key: 'stuck', label: 'Stuck' },
  { key: 'committed', label: 'Imported, not closed' },
  { key: 'closed', label: 'Closed' },
] as const;

export function MigrationsPage() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const [text, setText] = useState(q);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const next = text.trim();
    if (next === q) return;
    const t = setTimeout(() => setParams({ ...(filter ? { filter } : {}), ...(next ? { q: next } : {}) }, { replace: true }), 300);
    return () => clearTimeout(t);
  }, [text, q, filter, setParams]);

  const counts = useQuery({ queryKey: ['migrations', 'counts'], queryFn: getMigrationCounts });
  const list = useQuery({
    queryKey: ['migrations', 'list', { filter, q, page }],
    queryFn: () =>
      listMigrations({
        stuck: filter === 'stuck' || undefined,
        status: filter && filter !== 'stuck' ? filter : undefined,
        q: q || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const columns = [
    {
      header: 'Reference',
      id: 'ref',
      cell: ({ row }: Row) => (
        <div className="min-w-0">
          <p className="text-label-md text-text-primary">{row.original.reference}</p>
          <Link
            to={`/companies/${row.original.companyId}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate text-body-sm text-text-secondary hover:text-primary hover:underline"
          >
            {row.original.companyName ?? 'Deleted company'}
          </Link>
        </div>
      ),
    },
    { header: 'Source', id: 'src', cell: ({ row }: Row) => `${row.original.sourceSystem} · cutover ${formatDate(row.original.cutoverDate)}` },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }: Row) => (
        <span className="flex items-center gap-xs">
          <StatusBadge status={row.original.status} />
          {row.original.stuck && <StatusBadge status="pending" label="Stuck" />}
        </span>
      ),
    },
    { header: 'Readiness', id: 'ready', cell: ({ row }: Row) => `${row.original.readiness}%`, meta: { align: 'right' } },
    { header: 'Open problems', id: 'issues', cell: ({ row }: Row) => row.original.openIssues, meta: { align: 'right' } },
    {
      header: 'Checks',
      id: 'checks',
      cell: ({ row }: Row) => (row.original.checksTotal ? `${row.original.checksPassed}/${row.original.checksTotal}` : '—'),
    },
    { header: 'Updated', id: 'upd', cell: ({ row }: Row) => formatDateTime(row.original.updatedAt) },
  ];

  const pagination = list.data?.pagination;
  return (
    <div className="flex flex-col gap-lg">
      <PageHeader title="Migrations" description="Read-only. Status, readiness, problems by code and check totals — never the customer's figures." />
      <div className="flex flex-wrap gap-xs">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setParams(f.key ? { filter: f.key } : {})}>
            {f.label}
            {f.key === 'stuck' && counts.data ? ` (${counts.data.stuck})` : ''}
            {f.key === 'committed' && counts.data ? ` (${counts.data.awaitingClose})` : ''}
          </Chip>
        ))}
      </div>
      {list.isError && <ErrorBanner error={list.error} fallback="Migrations could not be loaded." onRetry={() => list.refetch()} />}
      <DataTable
        columns={columns as never}
        data={list.data?.items ?? []}
        isLoading={list.isLoading}
        onRowClick={(r) => setOpenId(r.id)}
        toolbar={<SearchInput value={text} onValueChange={setText} placeholder="Reference or company" aria-label="Search" size="sm" />}
        empty={<p className="p-lg text-body-sm text-text-tertiary">No migrations.</p>}
      />
      {pagination && pagination.pages > 1 && (
        <TablePager page={page} totalPages={pagination.pages} total={pagination.total} onPage={(p) => setParams({ ...(filter ? { filter } : {}), page: String(p) })} />
      )}
      {openId && <MigrationDetailDialog id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function MigrationDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['migrations', 'detail', id], queryFn: () => getMigration(id) });
  const m = q.data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={m ? `${m.reference} · ${m.companyName ?? ''}` : 'Migration'} className="max-w-panel">
      <div className="flex flex-col gap-md overflow-y-auto px-lg py-md">
        {!m ? (
          <p className="text-body-sm text-text-tertiary">Loading…</p>
        ) : (
          <>
            <p className="text-body-sm text-text-secondary">
              {m.sourceSystem} · cutover {formatDate(m.cutoverDate)} · {m.status} · readiness {m.readiness}% · {m.files} files · AI calls {m.aiCalls}
            </p>
            <div>
              <h3 className="mb-xs text-label-lg text-text-primary">Problems by code</h3>
              {m.issuesByCode.length === 0 ? (
                <p className="text-body-sm text-text-tertiary">None.</p>
              ) : (
                <ul className="flex flex-col gap-xxs">
                  {m.issuesByCode.map((i) => (
                    <li key={`${i.code}-${i.severity}`} className="flex justify-between text-body-sm">
                      <span>{i.code} <span className="text-text-secondary">({i.severity})</span></span>
                      <span className="tabular">{i.open} open · {i.resolved} resolved</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-xs text-label-lg text-text-primary">Checks</h3>
              {m.checks.length === 0 ? (
                <p className="text-body-sm text-text-tertiary">Not run yet.</p>
              ) : (
                <ul className="flex flex-col gap-xxs">
                  {m.checks.map((c) => (
                    <li key={c.code} className="flex justify-between gap-sm text-body-sm">
                      <span>{c.label}</span>
                      <span className={c.passed ? 'text-success' : 'text-danger'}>
                        {c.passed ? 'passed' : `failed · difference ${c.difference}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

export default MigrationsPage;
