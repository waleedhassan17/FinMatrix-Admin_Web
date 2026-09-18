// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Auth network
// ═══════════════════════════════════════════════════════
// One door. The console has no sign-up, no company onboarding and no portal
// picker — a platform administrator is provisioned server-side.

import {
  api,
  clearTokens,
  extractErrorCode,
  extractErrorMessage,
  setTokens,
  toApiError,
  unwrapEnvelope,
} from '@/networks/network/apiHelpers';
import { clearIntentionalSignOut, markIntentionalSignOut } from '@/utils/authEvents';
import type { AdminUser, Identity, UserRole } from '@/types';

/** A refusal this client decided, as opposed to one the server sent. */
export class AuthError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export const WRONG_APP_MESSAGE =
  'This account is not a platform administrator. Please use the FinMatrix app to sign in to your business.';

const asUser = (raw: unknown): AdminUser => {
  const u = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(u.id ?? u.uid ?? ''),
    email: String(u.email ?? ''),
    username: (u.username as string | null | undefined) ?? null,
    displayName: String(u.displayName ?? u.username ?? u.email ?? 'Administrator'),
    role: (u.role as UserRole) ?? 'admin',
    isActive: u.isActive as boolean | undefined,
    createdAt: u.createdAt as string | undefined,
  };
};

/**
 * Sign in.
 *
 * `portal: 'admin'` is the door the server admits company owners AND the
 * platform console through — so an owner's correct password succeeds here too,
 * and the role check below is the only thing standing between them and a
 * console they have no business in. It runs BEFORE setTokens, so a refused
 * sign-in leaves nothing behind to clean up.
 *
 * Naming the other app in the refusal leaks nothing: this line is only
 * reachable after the server returned 200, i.e. after the password was
 * accepted. A wrong password or an unknown email fails in the call above and
 * gets the server's generic message, exactly like any other account.
 */
export const authLogin = async (
  identifier: string,
  password: string,
): Promise<Identity> => {
  let raw: unknown;
  try {
    const response = await api.post('/auth/signin', {
      identifier: identifier.trim(),
      email: identifier.trim(),
      password,
      portal: 'admin',
    });
    raw = unwrapEnvelope(response.data);
  } catch (e) {
    throw new AuthError(extractErrorMessage(e), extractErrorCode(e));
  }

  const body = (raw ?? {}) as { user?: unknown; tokens?: Record<string, string> };
  const user = asUser(body.user);

  if (user.role !== 'super_admin') {
    throw new AuthError(WRONG_APP_MESSAGE, 'WRONG_APP');
  }
  if (!body.tokens?.accessToken) {
    throw new AuthError('Signed in, but no token was returned. Please try again.');
  }

  setTokens(body.tokens.accessToken, body.tokens.refreshToken);
  clearIntentionalSignOut();
  return { user };
};

/**
 * Restore a session on cold start.
 *
 * The same role check applies: a token stored by a tenant build on this origin,
 * or issued before this console existed, is still valid and /auth/me will
 * happily return it. Refusing here is what keeps a non-admin out of the
 * console without a sign-in ever happening.
 */
export const authMe = async (): Promise<Identity> => {
  let raw: unknown;
  try {
    const response = await api.get('/auth/me');
    raw = unwrapEnvelope(response.data);
  } catch (e) {
    throw toApiError(e);
  }
  const body = (raw ?? {}) as { user?: unknown };
  const user = asUser(body.user);
  if (user.role !== 'super_admin') {
    throw new AuthError(WRONG_APP_MESSAGE, 'WRONG_APP');
  }
  return { user };
};

/**
 * Best-effort server-side revocation. Never throws: the UI has already reset
 * itself by the time this resolves, and an offline sign-out must still work.
 */
export const authSignOut = async (): Promise<void> => {
  markIntentionalSignOut();
  try {
    await api.post('/auth/signout');
  } catch {
    /* the local session is cleared regardless */
  } finally {
    clearTokens();
  }
};

/** Mail a reset code. Used by Settings' "change password". */
export const authForgotPassword = async (email: string): Promise<void> => {
  try {
    await api.post('/auth/forgot-password', { email: email.trim() });
  } catch (e) {
    throw toApiError(e);
  }
};
