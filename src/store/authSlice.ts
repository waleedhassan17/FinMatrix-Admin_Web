// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Auth slice
// ═══════════════════════════════════════════════════════
// Redux holds identity and nothing else. Every piece of server data lives in
// TanStack Query. The split exists because route guards and the axios
// interceptor need to answer "who is this?" synchronously during render, which
// a query cannot do.

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AdminUser, Identity } from '@/types';

export interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  /** 'unknown' until the boot /auth/me settles — guards must not act on it. */
  status: 'unknown' | 'authenticated' | 'anonymous';
  error: string;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  status: 'unknown',
  error: '',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setIdentity: (state, action: PayloadAction<Identity>) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.status = 'authenticated';
      state.error = '';
    },
    setAnonymous: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.status = 'anonymous';
    },
    signOut: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.status = 'anonymous';
      state.error = '';
    },
    setAuthError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearAuthError: (state) => {
      state.error = '';
    },
  },
});

export const { setIdentity, setAnonymous, signOut, setAuthError, clearAuthError } =
  authSlice.actions;

export default authSlice.reducer;

// ─── Selectors ──────────────────────────────────────
interface HasAuth {
  auth: AuthState;
}

export const selectUser = (s: HasAuth): AdminUser | null => s.auth.user;
export const selectIsAuthenticated = (s: HasAuth): boolean => s.auth.isAuthenticated;
export const selectAuthStatus = (s: HasAuth): AuthState['status'] => s.auth.status;
export const selectAuthError = (s: HasAuth): string => s.auth.error;
