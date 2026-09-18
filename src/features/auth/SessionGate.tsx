// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Session boot and route guards
// ═══════════════════════════════════════════════════════
// The customer site's guards are the exact inverse of these: theirs refuse
// super_admin at four separate points, and a pasted RequireRouteAccess would
// bounce the only role this console serves. So they are written fresh.
//
// There is also far less to gate. A platform administrator has no company, so
// none of the tenant gates — email verification, company status, plan, tier —
// mean anything here. Signed in as a platform admin, or signed out.

import { useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { authMe } from '@/networks/auth/authNetwork';
import { setAnonymous, setIdentity, signOut } from '@/store/authSlice';
import { selectAuthStatus } from '@/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { setSessionExpiredHandler } from '@/utils/authEvents';
import { clearTokens, hasSession } from '@/utils/storage';

function BootSplash() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-md">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="text-body-sm text-text-secondary">Loading the console…</p>
      </div>
    </div>
  );
}

export function SessionGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAuthStatus);
  const queryClient = useQueryClient();
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    if (!hasSession()) {
      dispatch(setAnonymous());
      return;
    }
    // authMe refuses a non-super_admin, so a token left by a tenant build on
    // this origin lands here rather than inside the console.
    authMe()
      .then((identity) => dispatch(setIdentity(identity)))
      .catch(() => {
        clearTokens();
        dispatch(setAnonymous());
      });
  }, [dispatch]);

  // The axios client cannot import the store, so it emits and this listens.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      dispatch(signOut());
      queryClient.clear();
      toast.error('Your session expired. Please sign in again.');
    });
    return () => setSessionExpiredHandler(null);
  }, [dispatch, queryClient]);

  if (status === 'unknown') return <BootSplash />;
  return <>{children}</>;
}

/**
 * The console's only guard. It does not check the role: authLogin and authMe
 * both refuse anything that is not a platform administrator before identity
 * ever reaches Redux, so "authenticated" here already means "super_admin".
 */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const status = useAppSelector(selectAuthStatus);
  const location = useLocation();
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const status = useAppSelector(selectAuthStatus);
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
