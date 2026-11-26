// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Deleted accounts
// ═══════════════════════════════════════════════════════
// The platform audit of every deleted company and user — who, when, why, row
// counts — which outlives the data itself. A company with real books has a
// final backup for 30 days; download it here (super-admin only).

import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorBanner } from '@/components/layout/PageState';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { downloadFinalBackup, listDeletedAccounts, type DeletedAccount } from '@/networks/superAdmin/launchAdminNetwork';
import { formatDate, formatDateTime } from '@/utils/date';

type Row = { row: { original: DeletedAccount } };

const fileSize = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function DeletedAccountsPage() {
  const list = useQuery({ queryKey: ['deleted-accounts'], queryFn: listDeletedAccounts });

  const download = async (r: DeletedAccount) => {
    if (!r.finalBackup) return;
    try {
      const blob = await downloadFinalBackup(r.finalBackup.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `final-backup-${(r.companyName ?? r.companyId ?? 'company').replace(/[^\w-]+/g, '-')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Could not download the backup', { description: (e as Error).message });
    }
  };

  const columns = [
    { header: 'When', id: 'at', cell: ({ row }: Row) => formatDateTime(row.original.at) },
    {
      header: 'What',
      id: 'what',
      cell: ({ row }: Row) => (
        <div className="min-w-0">
          <p className="truncate text-label-md text-text-primary">
            {row.original.action === 'company_deleted' ? row.original.companyName ?? 'Company' : 'User'}
          </p>
          <p className="truncate text-caption text-text-secondary">{row.original.action.replace('_', ' ')}</p>
        </div>
      ),
    },
    { header: 'By', id: 'by', cell: ({ row }: Row) => row.original.actorLabel ?? row.original.actorUserId ?? '—' },
    { header: 'Reason', id: 'reason', cell: ({ row }: Row) => <span className="line-clamp-2 max-w-card text-body-sm">{row.original.reason ?? '—'}</span> },
    {
      header: 'Final backup',
      id: 'backup',
      cell: ({ row }: Row) =>
        row.original.finalBackup ? (
          <Button size="sm" variant="secondary" onClick={() => void download(row.original)}>
            <Download className="size-4" /> {fileSize(row.original.finalBackup.sizeBytes)} · until {formatDate(row.original.finalBackup.expiresAt)}
          </Button>
        ) : (
          <span className="text-body-sm text-text-tertiary">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader title="Deleted accounts" description="The record of every deletion, kept after the data is gone. Final backups last 30 days." />
      {list.isError && <ErrorBanner error={list.error} fallback="The log could not be loaded." onRetry={() => list.refetch()} />}
      <DataTable
        columns={columns as never}
        data={list.data ?? []}
        isLoading={list.isLoading}
        empty={<p className="p-lg text-body-sm text-text-tertiary">Nothing has been deleted.</p>}
      />
    </div>
  );
}

export default DeletedAccountsPage;
