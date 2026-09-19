// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Platform network envelope shapes
// ═══════════════════════════════════════════════════════
// Two things here are easy to get wrong and silent when you do:
//
//   1. The admin pagination block spells the page count `pages`. Most of this
//      API spells the same idea `totalPages`, so reading the familiar name
//      yields undefined -> NaN pages -> a pager that renders nothing.
//   2. page/limit go through the server's ParseIntPipe, which 400s on an empty
//      string. Serialising an undefined filter as `?page=` breaks the call.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();

vi.mock('@/networks/network/apiHelpers', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    patch: (...args: unknown[]) => patch(...args),
    post: (...args: unknown[]) => post(...args),
  },
  toApiError: (e: unknown) => e,
  unwrapEnvelope: (r: unknown) =>
    (r as { data?: unknown })?.data ?? r,
  idempotent: () => ({ headers: {} }),
}));

import { getCompanies, listSubscriptions } from '../platformNetwork';

beforeEach(() => {
  get.mockReset();
});

describe('paginated envelope', () => {
  it('reads the page count from `pages`, not `totalPages`', async () => {
    get.mockResolvedValue({
      data: {
        data: { data: [{ id: 'c1' }], pagination: { page: 2, limit: 20, total: 137, pages: 7 } },
      },
    });

    const result = await getCompanies({ page: 2 });

    expect(result.pages).toBe(7);
    expect(result.total).toBe(137);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.data).toHaveLength(1);
  });

  it('falls back to totalPages if a server ever sends that instead', async () => {
    get.mockResolvedValue({
      data: { data: { data: [], pagination: { total: 40, limit: 20, totalPages: 2 } } },
    });

    expect((await getCompanies()).pages).toBe(2);
  });

  it('derives a page count when the server sends neither', async () => {
    get.mockResolvedValue({
      data: { data: { data: [], pagination: { total: 45, limit: 20 } } },
    });

    expect((await getCompanies()).pages).toBe(3);
  });

  it('survives a bare array with no pagination block', async () => {
    get.mockResolvedValue({ data: { data: [{ id: 'c1' }, { id: 'c2' }] } });

    const result = await getCompanies();
    expect(result.data).toHaveLength(2);
    expect(result.pages).toBe(1);
  });

  it('shows an empty table rather than throwing on a malformed body', async () => {
    get.mockResolvedValue({ data: { data: null } });

    const result = await getCompanies();
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.pages).toBe(1);
  });

  it('paginates subscriptions through the same reader', async () => {
    get.mockResolvedValue({
      data: { data: { data: [{ id: 's1' }], pagination: { page: 1, limit: 20, total: 3, pages: 1 } } },
    });

    expect((await listSubscriptions({ page: 1 })).pages).toBe(1);
  });
});

describe('query params', () => {
  beforeEach(() => {
    get.mockResolvedValue({ data: { data: { data: [], pagination: {} } } });
  });

  it('drops undefined filters instead of sending an empty string', async () => {
    await getCompanies({ page: 1, limit: 20, status: undefined, isTrial: undefined });

    const params = get.mock.calls[0][1].params;
    expect(params).toEqual({ page: 1, limit: 20 });
    expect('status' in params).toBe(false);
    expect('isTrial' in params).toBe(false);
  });

  it('serialises isTrial as a string the server will parse', async () => {
    await getCompanies({ isTrial: false });

    expect(get.mock.calls[0][1].params.isTrial).toBe('false');
  });

  it('passes a status filter through untouched', async () => {
    await getCompanies({ status: 'pending' });

    expect(get.mock.calls[0][1].params.status).toBe('pending');
  });
});
