// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Console settings
// ═══════════════════════════════════════════════════════

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LogOut, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Field';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { useSignOut } from '@/features/auth/useSignOut';
import { authForgotPassword } from '@/networks/auth/authNetwork';
import { selectUser } from '@/store/authSlice';
import { useAppSelector } from '@/store/store';
import {
  getNotificationPrefs,
  setNotificationPrefs,
  type NotificationPrefs,
} from '@/utils/storage';

export function SettingsPage() {
  const user = useAppSelector(selectUser);
  const signOut = useSignOut();
  const [prefs, setPrefs] = useState<NotificationPrefs>(() =>
    getNotificationPrefs(),
  );

  const togglePref = (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setNotificationPrefs(next);
  };

  // The console has no change-password form of its own: it reuses the account
  // recovery flow, so the new password is set behind an emailed code rather
  // than by anyone who finds an unlocked screen.
  const sendReset = useMutation({
    mutationFn: () => authForgotPassword(user?.email ?? ''),
    onSuccess: () =>
      toast.success('Reset code sent', {
        description: `Check ${user?.email} for the code.`,
      }),
    onError: (e: Error) =>
      toast.error('Could not send the code', { description: e.message }),
  });

  return (
    <div className="mx-auto flex w-full max-w-copy flex-col gap-lg">
      <PageHeader
        title="Console settings"
        description="Your account, and what this console tells you about."
      />

      <Card className="p-lg">
        <SectionHeader title="Account" />
        <div className="mt-md flex items-center gap-md">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-label-lg text-text-primary">
              {user?.displayName ?? 'Administrator'}
            </p>
            <p className="truncate text-body-sm text-text-secondary">
              {user?.email}
            </p>
          </div>
        </div>
        <div className="mt-md">
          <KeyValueList
            items={[
              { label: 'Role', value: 'Platform administrator' },
              {
                label: 'Username',
                value: user?.username,
                hidden: !user?.username,
              },
            ]}
          />
        </div>
      </Card>

      <Card className="p-lg">
        <SectionHeader title="Notifications" />
        <p className="mt-xs text-body-sm text-text-secondary">
          Stored on this device only — nothing is sent to the server.
        </p>
        <div className="mt-md flex flex-col divide-y divide-border-light">
          <PrefRow
            label="New companies"
            hint="A business registers and needs approving."
            checked={prefs.newCompanies}
            onChange={() => togglePref('newCompanies')}
          />
          <PrefRow
            label="Payment submissions"
            hint="A bank transfer is waiting to be verified."
            checked={prefs.paymentSubmissions}
            onChange={() => togglePref('paymentSubmissions')}
          />
          <PrefRow
            label="Trial requests"
            hint="Someone asks for the 30-day free trial."
            checked={prefs.trialRequests}
            onChange={() => togglePref('trialRequests')}
          />
        </div>
      </Card>

      <Card className="p-lg">
        <SectionHeader title="Security" />
        <div className="mt-md flex flex-wrap items-center justify-between gap-md">
          <div className="min-w-0">
            <p className="text-label-md text-text-primary">Change password</p>
            <p className="text-body-sm text-text-secondary">
              We email a reset code to {user?.email ?? 'your address'}.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => sendReset.mutate()}
            disabled={sendReset.isPending || !user?.email}
          >
            <Mail className="size-4" aria-hidden="true" />
            {sendReset.isPending ? 'Sending…' : 'Send reset code'}
          </Button>
        </div>
      </Card>

      <Card className="p-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div className="min-w-0">
            <p className="text-label-md text-text-primary">Sign out</p>
            <p className="text-body-sm text-text-secondary">
              Ends this session on this device.
            </p>
          </div>
          <Button variant="danger" onClick={signOut}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PrefRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-md py-sm">
      <div className="min-w-0">
        <p className="text-label-md text-text-primary">{label}</p>
        <p className="text-body-sm text-text-secondary">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default SettingsPage;
