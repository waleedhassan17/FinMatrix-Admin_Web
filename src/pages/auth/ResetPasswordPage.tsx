// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Reset password
// ═══════════════════════════════════════════════════════
// The second half of a flow that used to dead-end. Settings fired
// POST /auth/forgot-password, toasted "Reset code sent", and there was nowhere
// in the console to enter the code: the admin had to finish in another client.
//
// Three steps against three endpoints:
//   forgot-password  -> mails a code
//   verify-otp       -> trades the code for a short-lived reset token
//   reset-password   -> sets the password, using that token
//
// The reset token is held in component state for the length of the flow and
// never persisted. It authorises a password change, so it has no business in
// localStorage where an XSS could read it back.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  authForgotPassword,
  authResetPassword,
  authVerifyOtp,
} from '@/networks/auth/authNetwork';
import { isValidPassword, PASSWORD_RULE } from '@/models/password';

type Step = 'request' | 'verify' | 'reset';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Settings links here with ?email=, so an admin changing their own password
  // does not retype the address they are already signed in as.
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [step, setStep] = useState<Step>(params.get('sent') ? 'verify' : 'request');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const request = useMutation({
    mutationFn: () => authForgotPassword(email),
    onSuccess: (result) => {
      // An owner-managed account gets no code. Saying "sent" regardless is how
      // someone ends up waiting for mail that was never going to arrive.
      if (result.ownerManaged) {
        toast.info('This account is managed for you', {
          description:
            result.message ??
            'Ask the account owner to reset it — no code was sent.',
        });
        return;
      }
      setStep('verify');
      toast.success('Reset code sent', { description: `Check ${email}.` });
    },
    onError: (e: Error) =>
      toast.error('Could not send the code', { description: e.message }),
  });

  const verify = useMutation({
    mutationFn: () => authVerifyOtp(email, otp),
    onSuccess: (token) => {
      setResetToken(token);
      setStep('reset');
    },
    onError: (e: Error) =>
      toast.error('That code did not work', { description: e.message }),
  });

  const reset = useMutation({
    mutationFn: () => authResetPassword(email, resetToken, password),
    onSuccess: () => {
      toast.success('Password changed', { description: 'Sign in with it now.' });
      navigate('/login', { replace: true });
    },
    onError: (e: Error) =>
      toast.error('Could not change the password', { description: e.message }),
  });

  const passwordsMatch = password === confirm;
  const passwordOk = isValidPassword(password);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-lg">
      <Card className="w-full max-w-form p-xl">
        <span className="mb-md flex size-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>

        <h1 className="text-h2 text-text-primary">Reset your password</h1>

        {step === 'request' && (
          <form
            className="mt-lg flex flex-col gap-md"
            onSubmit={(e) => {
              e.preventDefault();
              request.mutate();
            }}
          >
            <p className="text-body-sm text-text-secondary">
              We will email a six-digit code to your account address.
            </p>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" disabled={!email || request.isPending}>
              {request.isPending ? 'Sending…' : 'Send code'}
            </Button>
          </form>
        )}

        {step === 'verify' && (
          <form
            className="mt-lg flex flex-col gap-md"
            onSubmit={(e) => {
              e.preventDefault();
              verify.mutate();
            }}
          >
            <p className="text-body-sm text-text-secondary">
              Enter the code sent to <strong>{email}</strong>.
            </p>
            <Input
              label="Code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
            <Button type="submit" disabled={otp.trim().length < 4 || verify.isPending}>
              {verify.isPending ? 'Checking…' : 'Continue'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() => request.mutate()}
              disabled={request.isPending}
            >
              Send another code
            </Button>
          </form>
        )}

        {step === 'reset' && (
          <form
            className="mt-lg flex flex-col gap-md"
            onSubmit={(e) => {
              e.preventDefault();
              reset.mutate();
            }}
          >
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={PASSWORD_RULE}
              error={password && !passwordOk ? PASSWORD_RULE : undefined}
              required
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={
                confirm && !passwordsMatch ? 'These do not match.' : undefined
              }
              required
            />
            <Button
              type="submit"
              disabled={!passwordOk || !passwordsMatch || reset.isPending}
            >
              {reset.isPending ? 'Saving…' : 'Change password'}
            </Button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-lg inline-flex items-center gap-xxs text-label-md text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </Card>
    </div>
  );
}

export default ResetPasswordPage;
