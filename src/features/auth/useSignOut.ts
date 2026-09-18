// ═══════════════════════════════════════════════════════
// FinMatrix Admin — useSignOut (the ONLY sign-out implementation)
// ═══════════════════════════════════════════════════════
// Order matters, and it is the same order the app settled on:
//
//   markIntentionalSignOut()  — requests still in flight on the old token come
//                               back 401. Without this window they would be
//                               refreshed (the refresh token was just revoked)
//                               and the user who clicked "Sign out" would be
//                               told their session expired.
//   void authSignOut()        — fire and forget. Never awaited: the UI must not
//                               wait on the network, and an offline or hung
//                               request must not delay signing out.
//   dispatch(signOut())       — synchronous, and what actually moves the router.
//   queryClient.clear()       — the previous admin's companies, payment queue
//                               and revenue must not be readable by the next.

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { authSignOut } from '@/networks/auth/authNetwork';
import { signOut as signOutAction } from '@/store/authSlice';
import { useAppDispatch } from '@/store/store';

export function useSignOut(): () => void {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(() => {
    void authSignOut();
    dispatch(signOutAction());
    queryClient.clear();
    navigate('/login', { replace: true });
  }, [dispatch, queryClient, navigate]);
}
