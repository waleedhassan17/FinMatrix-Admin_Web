// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Sign in
// ═══════════════════════════════════════════════════════
// One door, one credential shape. The customer site offers two portals behind a
// role picker; a platform administrator has exactly one way in, so the picker,
// the sign-up link and the company onboarding all go.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authLogin } from '@/networks/auth/authNetwork';
import { setIdentity } from '@/store/authSlice';
import { useAppDispatch } from '@/store/store';

interface LocationState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const signIn = useMutation({
    mutationFn: () => authLogin(identifier, password),
    onSuccess: (identity) => {
      dispatch(setIdentity(identity));
      const from = (location.state as LocationState | null)?.from?.pathname;
      navigate(from ?? '/dashboard', { replace: true });
    },
    onError: (e: Error) => {
      setError(e.message);
      setPassword('');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    signIn.mutate();
  };

  return (
    <div className="flex min-h-screen">
      {/* The brand half. Hidden below lg, where it would push the form off the
          fold on a phone. */}
      <div
        className="hidden w-[44%] flex-col justify-between p-xxl text-white lg:flex"
        style={{ background: 'var(--color-header)' }}
      >
        <div className="flex items-center gap-sm">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/10">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <span className="text-h4">FinMatrix Admin</span>
        </div>
        <div className="max-w-card">
          <h1 className="text-display-sm">The platform console</h1>
          <p className="mt-sm text-body-md text-white/70">
            Approve companies, review payment submissions and watch revenue
            across every business running on FinMatrix.
          </p>
        </div>
        <p className="text-caption text-white/50">
          Restricted to platform administrators.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-lg">
        <form onSubmit={submit} className="w-full max-w-form">
          <div className="mb-xl lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary-tint text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
          </div>

          <h2 className="text-h2 text-text-primary">Sign in</h2>
          <p className="mt-xxs text-body-sm text-text-secondary">
            Use your platform administrator account.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-md rounded-md bg-danger-lighter p-sm text-body-sm text-danger"
            >
              {error}
            </div>
          )}

          <div className="mt-lg flex flex-col gap-md">
            <Input
              label="Email address"
              type="email"
              autoComplete="username"
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@finmatrix.app"
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <Button
            type="submit"
            full
            className="mt-lg"
            disabled={signIn.isPending}
          >
            {signIn.isPending ? 'Signing in…' : 'Sign in'}
          </Button>

          {/* The only recovery entry point used to be behind the login wall,
              on the Settings page -- which is no use to the one person who
              needs it. */}
          <Link
            to={`/reset-password${
              identifier.includes('@')
                ? `?email=${encodeURIComponent(identifier)}`
                : ''
            }`}
            className="mt-md inline-block text-label-md text-primary hover:underline"
          >
            Forgot password?
          </Link>

          <p className="mt-md text-caption text-text-tertiary">
            256-bit SSL encrypted connection
          </p>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
