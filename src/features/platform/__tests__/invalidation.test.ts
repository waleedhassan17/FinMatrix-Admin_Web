// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Invalidation matrix
// ═══════════════════════════════════════════════════════
// The gap this pins: PaymentsPage used to invalidate submissions, revenue and
// stats after a decision, but NOT companies. Approving a payment activates the
// company's subscription, so the Companies table's Plan column and status went
// stale -- which reads to the operator as the approval not having worked.
//
// A matrix is exactly the kind of thing that rots silently, so it is asserted
// key by key rather than left to review.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useSettle } from '../invalidation';

function setup() {
  const queryClient = new QueryClient();
  const spy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const { result } = renderHook(() => useSettle(), { wrapper });

  return {
    settle: result.current,
    spy,
    /** The queryKey of every invalidateQueries call, as a comparable string. */
    keys: () =>
      spy.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey ?? null)),
  };
}

describe('useSettle', () => {
  it('refreshes companies and the dashboard after a company decision', () => {
    const { settle, keys } = setup();
    settle.afterCompanyDecision();

    expect(keys()).toContain(JSON.stringify(['companies']));
    expect(keys()).toContain(JSON.stringify(['platform']));
  });

  it('also refreshes the detail view when a company id is known', () => {
    const { settle, keys } = setup();
    settle.afterCompanyDecision('c1');

    expect(keys()).toContain(JSON.stringify(['companies', 'detail', 'c1']));
  });

  it('refreshes ONLY the detail view after a feature override', () => {
    const { settle, keys } = setup();
    settle.afterFeatureOverride('c1');

    // The flags appear on neither the list row nor the stats, so a broad
    // invalidate here would refetch every cached page for a field no list shows.
    expect(keys()).toEqual([JSON.stringify(['companies', 'detail', 'c1'])]);
  });

  it('refreshes companies after a submission decision', () => {
    const { settle, keys } = setup();
    settle.afterSubmissionDecision();

    // The regression this file exists for.
    expect(keys()).toContain(JSON.stringify(['companies']));
    expect(keys()).toContain(JSON.stringify(['submissions']));
    expect(keys()).toContain(JSON.stringify(['revenue']));
    expect(keys()).toContain(JSON.stringify(['platform']));
  });

  it('refreshes subscriptions, companies and stats after an assignment', () => {
    const { settle, keys } = setup();
    settle.afterSubscriptionAssign();

    expect(keys()).toContain(JSON.stringify(['subscriptions']));
    expect(keys()).toContain(JSON.stringify(['companies']));
    expect(keys()).toContain(JSON.stringify(['platform']));
  });

  it('invalidates everything after the expiry scan', () => {
    const { settle, spy } = setup();
    settle.afterExpiryScan();

    // No key at all: the scan mutates companies en masse, so enumerating keys
    // here is how one gets missed.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBeUndefined();
  });

  it('never invalidates the static plan catalogue', () => {
    const { settle, keys } = setup();
    settle.afterCompanyDecision('c1');
    settle.afterSubmissionDecision();
    settle.afterSubscriptionAssign();

    expect(keys()).not.toContain(JSON.stringify(['plans']));
  });
});
