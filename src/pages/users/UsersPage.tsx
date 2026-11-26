// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Users (suspend, reinstate, delete)
// ═══════════════════════════════════════════════════════
// Every user across every company. Suspending ends all their sessions at
// once and refuses every way back in (sign-in, refresh, password reset);
// reinstating lets them sign in again. Deleting needs their email typed
// exactly and refuses the only owner of a company (delete the company).

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorBanner } from '@/components/layout/PageState';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, TablePager } from '@/components/ui/DataTable';
import { Textarea } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { confirmationMatches } from '@/models/launchAdmin';
import {
  deleteUser,
  reinstateUser,
  searchUsers,
  suspendUser,
  type AdminUser,
} from '@/networks/superAdmin/launchAdminNetwork';
import { formatDate } from '@/utils/date';

const PAGE_SIZE = 25;
type Row = { row: { original: AdminUser } };
type Pending = { user: AdminUser; action: 'suspend' | 'reinstate' | 'delete' };

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const [text, setText] = useState(q);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [allowNewTrial, setAllowNewTrial] = useState(false);

  useEffect(() => {
    const next = text.trim();
    if (next === q) return;
    const t = setTimeout(() => setParams(next ? { q: next } : {}, { replace: true }), 300);
    return () => clearTimeout(t);
  }, [text, q, setParams]);

  const list = useQuery({
    queryKey: ['users', 'list', { q, page }],
    queryFn: () => searchUsers({ q: q || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const close = () => {
    setPending(null);
    setReason('');
    setTyped('');
    setAllowNewTrial(false);
  };

  const act = useMutation({
    mutationFn: ({ user, action }: Pending) => {
      if (action === 'suspend') return suspendUser(user.id, reason.trim());
      if (action === 'reinstate') return reinstateUser(user.id);
      return deleteUser(user.id, { confirmEmail: typed.trim(), reason: reason.trim(), allowNewTrial });
    },
    onSuccess: (_r, { user, action }) => {
      toast.success(action === 'suspend' ? 'User suspended' : action === 'reinstate' ? 'User reinstated' : 'User deleted', {
        description: user.email ?? user.username ?? user.displayName,
      });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      close();
    },
    onError: (e: Error) => toast.error('Could not update the user', { description: e.message }),
  });

  const columns = [
    {
      header: 'User',
      id: 'user',
      cell: ({ row }: Row) => (
        <div className="min-w-0">
          <p className="truncate text-label-lg text-text-primary">{row.original.displayName}</p>
          <p className="truncate text-body-sm text-text-secondary">{row.original.email ?? row.original.username ?? '—'}</p>
        </div>
      ),
    },
    { header: 'Role', id: 'role', cell: ({ row }: Row) => row.original.role },
    {
      header: 'Companies',
      id: 'companies',
      cell: ({ row }: Row) => (
        <div className="flex flex-col">
          {(row.original.memberships ?? []).slice(0, 3).map((m) => (
            <Link key={m.companyId} to={`/companies/${m.companyId}`} className="truncate text-body-sm text-primary hover:underline">
              {m.companyName} <span className="text-text-secondary">({m.role})</span>
            </Link>
          ))}
        </div>
      ),
    },
    {
      header: 'State',
      id: 'state',
      cell: ({ row }: Row) =>
        row.original.suspendedAt ? (
          <StatusBadge status="inactive" label="Suspended" />
        ) : row.original.isActive ? (
          <StatusBadge status="active" label="Active" />
        ) : (
          <StatusBadge status="inactive" label="Disabled by owner" />
        ),
    },
    { header: 'Joined', id: 'joined', cell: ({ row }: Row) => formatDate(row.original.createdAt) },
    {
      header: '',
      id: 'actions',
      cell: ({ row }: Row) => (
        <div className="flex gap-xs">
          {row.original.suspendedAt ? (
            <Button size="sm" variant="secondary" onClick={() => setPending({ user: row.original, action: 'reinstate' })}>
              Reinstate
            </Button>
          ) : (
            row.original.role !== 'super_admin' && (
              <Button size="sm" variant="secondary" onClick={() => setPending({ user: row.original, action: 'suspend' })}>
                Suspend
              </Button>
            )
          )}
          {row.original.role !== 'super_admin' && (
            <Button size="sm" variant="text" onClick={() => setPending({ user: row.original, action: 'delete' })}>
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  const who = pending?.user.email ?? pending?.user.username ?? '';
  const pagination = list.data?.pagination;
  return (
    <div className="flex flex-col gap-lg">
      <PageHeader title="Users" description="Everyone with a FinMatrix login. Suspending signs them out everywhere at once." />
      {list.isError && <ErrorBanner error={list.error} fallback="Users could not be loaded." onRetry={() => list.refetch()} />}
      <DataTable
        columns={columns as never}
        data={list.data?.items ?? []}
        isLoading={list.isLoading}
        toolbar={<SearchInput value={text} onValueChange={setText} placeholder="Name, email, username, phone or company" aria-label="Search users" size="sm" />}
        empty={<p className="p-lg text-body-sm text-text-tertiary">No users found.</p>}
      />
      {pagination && pagination.pages > 1 && (
        <TablePager page={page} totalPages={pagination.pages} total={pagination.total} onPage={(p) => setParams({ ...(q ? { q } : {}), page: String(p) })} />
      )}

      <ConfirmDialog
        open={pending?.action === 'suspend'}
        onOpenChange={(o) => !o && close()}
        title={`Suspend ${pending?.user.displayName ?? ''}?`}
        description="Every session ends now. They cannot sign in, refresh or reset their password until reinstated. Nothing is deleted."
        confirmLabel="Suspend"
        destructive
        busy={act.isPending}
        confirmDisabled={reason.trim().length < 3}
        onConfirm={() => pending && act.mutate(pending)}
      >
        <Textarea label="Reason (audited)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.action === 'reinstate'}
        onOpenChange={(o) => !o && close()}
        title={`Reinstate ${pending?.user.displayName ?? ''}?`}
        description="They can sign in again straight away."
        confirmLabel="Reinstate"
        busy={act.isPending}
        onConfirm={() => pending && act.mutate(pending)}
      />

      <ConfirmDialog
        open={pending?.action === 'delete'}
        onOpenChange={(o) => !o && close()}
        title={`Delete ${pending?.user.displayName ?? ''}?`}
        description="Permanent. The login goes; their email and phone become free. The only owner of a company cannot be deleted — delete the company instead."
        confirmLabel="Delete permanently"
        destructive
        busy={act.isPending}
        confirmDisabled={!confirmationMatches(typed, who) || reason.trim().length < 3}
        onConfirm={() => pending && act.mutate(pending)}
      >
        <div className="flex flex-col gap-sm">
          <Textarea label="Reason (audited)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <label className="flex items-start gap-sm text-body-sm text-text-primary">
            <input type="checkbox" className="mt-[3px]" checked={allowNewTrial} onChange={(e) => setAllowNewTrial(e.target.checked)} />
            Allow a new free trial for this email and phone
          </label>
          <Input label={`Type ${who} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
      </ConfirmDialog>
    </div>
  );
}

export default UsersPage;
