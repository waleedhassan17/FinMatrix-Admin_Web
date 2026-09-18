// The console's whole access-control story is one check in authLogin, so it is
// worth pinning. The server admits company owners AND the platform console
// through portal 'admin' and hands both a real token — this client is the only
// thing that keeps an owner out.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/networks/network/apiHelpers', async () => {
  const actual = await vi.importActual<
    typeof import('@/networks/network/apiHelpers')
  >('@/networks/network/apiHelpers');
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
  };
});

import { api, setTokens } from '@/networks/network/apiHelpers';
import { authLogin, authMe, AuthError } from '@/networks/auth/authNetwork';

const post = api.post as unknown as ReturnType<typeof vi.fn>;
const get = api.get as unknown as ReturnType<typeof vi.fn>;
const storeTokens = setTokens as unknown as ReturnType<typeof vi.fn>;

const signInResponse = (role: string) => ({
  data: {
    success: true,
    data: {
      user: {
        id: 'u1',
        email: 'platform@finmatrix.app',
        displayName: 'Platform Admin',
        role,
      },
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
    },
  },
});

describe('authLogin', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    storeTokens.mockReset();
  });

  it('signs a platform administrator in through the admin portal', async () => {
    post.mockResolvedValueOnce(signInResponse('super_admin'));

    const identity = await authLogin('  platform@finmatrix.app  ', 'pw');

    expect(identity.user.role).toBe('super_admin');
    expect(post).toHaveBeenCalledWith('/auth/signin', {
      identifier: 'platform@finmatrix.app',
      email: 'platform@finmatrix.app',
      password: 'pw',
      portal: 'admin',
    });
    expect(storeTokens).toHaveBeenCalledWith('access', 'refresh');
  });

  // The important one. A company owner's correct password succeeds at the
  // server; only this refusal stops them landing inside the console.
  it.each(['admin', 'staff', 'delivery'])(
    'refuses a %s account and stores no session',
    async (role) => {
      post.mockResolvedValueOnce(signInResponse(role));

      await expect(authLogin('owner@example.com', 'pw')).rejects.toThrow(
        /FinMatrix app/i,
      );
      expect(storeTokens).not.toHaveBeenCalled();
    },
  );

  it('tags the refusal so the UI can tell it from a bad password', async () => {
    post.mockResolvedValueOnce(signInResponse('admin'));
    await expect(authLogin('owner@example.com', 'pw')).rejects.toMatchObject({
      code: 'WRONG_APP',
    });
  });

  it('stores nothing when the server returns no token', async () => {
    post.mockResolvedValueOnce({
      data: { success: true, data: { user: { id: 'u1', role: 'super_admin' } } },
    });
    await expect(authLogin('platform@finmatrix.app', 'pw')).rejects.toBeInstanceOf(
      AuthError,
    );
    expect(storeTokens).not.toHaveBeenCalled();
  });
});

describe('authMe', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('restores a platform administrator', async () => {
    get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { user: { id: 'u1', email: 'a@b.c', role: 'super_admin' } },
      },
    });
    const identity = await authMe();
    expect(identity.user.role).toBe('super_admin');
  });

  // A token left on this origin by a tenant build, or issued before the console
  // existed, is still valid and /auth/me returns it happily. Refusing here is
  // what keeps a non-admin out without a sign-in ever happening.
  it('refuses a restored tenant session', async () => {
    get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { user: { id: 'u1', email: 'a@b.c', role: 'admin' } },
      },
    });
    await expect(authMe()).rejects.toMatchObject({ code: 'WRONG_APP' });
  });
});
