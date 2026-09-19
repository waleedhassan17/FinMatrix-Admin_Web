// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Password reset endpoints
// ═══════════════════════════════════════════════════════
// Two envelope quirks worth pinning, because each fails silently:
//
//   verify-otp wraps its payload, so the reset token is at data.resetToken.
//   reset-password answers { success: true } VERBATIM -- the envelope
//   interceptor passes through any payload that already carries a `success`
//   key, so there is no `data` and nothing to read off the result.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();

vi.mock('@/networks/network/apiHelpers', () => ({
  api: { post: (...a: unknown[]) => post(...a) },
  toApiError: (e: unknown) => e,
  unwrapEnvelope: (r: unknown) => (r as { data?: unknown })?.data ?? r,
}));

import {
  authForgotPassword,
  authResetPassword,
  authVerifyOtp,
} from '../authNetwork';

beforeEach(() => post.mockReset());

describe('authVerifyOtp', () => {
  it('pulls the reset token out of the envelope', async () => {
    post.mockResolvedValue({ data: { data: { resetToken: 'tok_123' } } });

    expect(await authVerifyOtp('a@b.pk', '123456')).toBe('tok_123');
  });

  it('throws rather than returning an empty token', async () => {
    // An empty token would sail into reset-password and fail there instead,
    // with a message about the password rather than the code.
    post.mockResolvedValue({ data: { data: {} } });

    await expect(authVerifyOtp('a@b.pk', '123456')).rejects.toThrow();
  });

  it('trims what the operator typed', async () => {
    post.mockResolvedValue({ data: { data: { resetToken: 't' } } });
    await authVerifyOtp('  a@b.pk ', ' 123456 ');

    expect(post.mock.calls[0][1]).toEqual({ email: 'a@b.pk', otp: '123456' });
  });
});

describe('authResetPassword', () => {
  it('does not throw on the bare { success: true } body', async () => {
    post.mockResolvedValue({ data: { success: true } });

    await expect(
      authResetPassword('a@b.pk', 'tok', 'Abcdef1gh'),
    ).resolves.toBeUndefined();
  });

  it('sends the token the verify step returned', async () => {
    post.mockResolvedValue({ data: { success: true } });
    await authResetPassword('a@b.pk', 'tok_123', 'Abcdef1gh');

    expect(post.mock.calls[0][1]).toEqual({
      email: 'a@b.pk',
      resetToken: 'tok_123',
      password: 'Abcdef1gh',
    });
  });
});

describe('authForgotPassword', () => {
  it('surfaces ownerManaged rather than swallowing it', async () => {
    // Settings used to toast "Reset code sent" regardless, which sends someone
    // looking for mail that was never going to arrive.
    post.mockResolvedValue({
      data: { data: { delivered: false, ownerManaged: true, message: 'Ask the owner.' } },
    });

    const result = await authForgotPassword('a@b.pk');
    expect(result.ownerManaged).toBe(true);
    expect(result.message).toBe('Ask the owner.');
  });

  it('assumes delivery when the server says nothing either way', async () => {
    post.mockResolvedValue({ data: { data: {} } });

    expect((await authForgotPassword('a@b.pk')).delivered).toBe(true);
  });
});
