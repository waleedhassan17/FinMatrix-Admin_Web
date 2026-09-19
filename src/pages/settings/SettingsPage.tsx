// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Console settings
// ═══════════════════════════════════════════════════════

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LogOut, Mail, RotateCw, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Switch } from '@/components/ui/Field';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { useSignOut } from '@/features/auth/useSignOut';
import { useSettle } from '@/features/platform/invalidation';
import type { ExpiryScanResult } from '@/models/platform';
import { authForgotPassword } from '@/networks/auth/authNetwork';
import { runExpiryScan } from '@/networks/superAdmin/submissionNetwork';
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
  const navigate = useNavigate();
  const { afterExpiryScan } = useSettle();
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResult, setScanResult] = useState<ExpiryScanResult | null>(null);
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
  //
  // This used to toast "Reset code sent" and stop there -- with nowhere in the
  // console to enter the code, so the admin had to finish in another client.
  // It hands off to /reset-password now, and reports ownerManaged rather than
  // claiming a code was sent when none was.
  const sendReset = useMutation({
    mutationFn: () => authForgotPassword(user?.email ?? ''),
    onSuccess: (result) => {
      if (result.ownerManaged) {
        toast.info('This account is managed for you', {
          description:
            result.message ?? 'Ask the account owner to reset it.',
        });
        return;
      }
      toast.success('Reset code sent', {
        description: `Check ${user?.email} for the code.`,
      });
      navigate(
        `/reset-password?email=${encodeURIComponent(user?.email ?? '')}&sent=1`,
      );
    },
    onError: (e: Error) =>
      toast.error('Could not send the code', { description: e.message }),
  });

  // The 1 AM cron, on demand. Destructive at scale: it deactivates every
  // company whose subscription has lapsed and emails all of them, which is why
  // it confirms first and reports what it actually did rather than a toast
  // saying "done".
  const scan = useMutation({
    mutationFn: runExpiryScan,
    onSuccess: (result) => {
      afterExpiryScan();
      setScanOpen(false);
      setScanResult(result);
    },
    onError: (e: Error) =>
      toast.error('The scan did not run', { description: e.message }),
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
        <SectionHeader title="Maintenance" />
        <div className="mt-md flex flex-wrap items-center justify-between gap-md">
          <div className="min-w-0">
            <p className="text-label-md text-text-primary">
              Run the subscription expiry scan
            </p>
            <p className="text-body-sm text-text-secondary">
              Normally runs nightly. Deactivates companies whose subscription
              has lapsed, flags the ones about to, and emails them.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setScanOpen(true)}
            disabled={scan.isPending}
          >
            <RotateCw className="size-4" aria-hidden="true" />
            {scan.isPending ? 'Running…' : 'Run now'}
          </Button>
        </div>

        {scanResult && (
          <div className="mt-md rounded-md bg-neutral-50 p-md">
            <p className="text-label-md text-text-primary">Last run</p>
            <div className="mt-xs">
              <KeyValueList
                items={[
                  { label: 'Companies scanned', value: scanResult.scanned },
                  { label: 'Reminders sent', value: scanResult.remindersSent },
                  { label: 'Marked expiring', value: scanResult.expiringMarked },
                  {
                    label: 'Deactivated',
                    value: scanResult.deactivated,
                    emphasis: scanResult.deactivated > 0,
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        title="Run the expiry scan now?"
        description="Every company whose subscription has lapsed will be deactivated, and those about to lapse will be emailed. This is the same work the nightly job does."
        confirmLabel="Run the scan"
        destructive
        busy={scan.isPending}
        onConfirm={() => scan.mutate()}
      />

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
