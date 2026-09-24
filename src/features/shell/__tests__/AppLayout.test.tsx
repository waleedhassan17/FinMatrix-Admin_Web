// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════
// FinMatrix Admin — AppLayout / Sidebar drawer
// ═══════════════════════════════════════════════════════
// The drawer is the only navigation below `lg` -- Topbar carries the hamburger
// and the account menu, and no links. So a drawer that will not stay open
// leaves the console reachable at /dashboard and nowhere else on a phone.
//
// It shipped that way. Sidebar closed itself from an effect that listed the
// onCloseMobile prop as a dependency, and AppLayout passed an inline arrow, so
// the identity changed on every render: opening the drawer re-rendered the
// parent, which re-fired the effect, which closed the drawer. The first test
// below is the one that catches it -- note the re-render between opening and
// asserting, because a single render pass looks fine.

import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import authReducer from '@/store/authSlice';

import { AppLayout } from '../AppLayout';
import { BILLING_DISABLED_BUILD } from '@/config/featureFlags';
import { NAV_ITEMS } from '@/config/nav';

// The Sidebar badge reads pendingSubmissions off the revenue summary. Nothing
// here is about the badge, and an unmocked call would hit the network.
vi.mock('@/networks/superAdmin/submissionNetwork', () => ({
  getPlatformRevenue: vi.fn().mockResolvedValue({ pendingSubmissions: 0 }),
}));

function renderLayout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = configureStore({ reducer: { auth: authReducer } });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<div>Dashboard page</div>} />
              <Route path="/companies" element={<div>Companies page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

describe('AppLayout mobile drawer', () => {
  it('stays open after the render that opening it causes', () => {
    renderLayout();
    const hamburger = screen.getByLabelText('Open navigation');
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(hamburger);

    // Opening flips state in AppLayout, so a re-render has already happened by
    // the time this returns. Before the fix the drawer closed itself here.
    expect(hamburger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes when a nav link is tapped, and navigates', () => {
    renderLayout();
    const hamburger = screen.getByLabelText('Open navigation');

    fireEvent.click(hamburger);
    fireEvent.click(screen.getByRole('link', { name: /companies/i }));

    expect(screen.getByText('Companies page')).toBeInTheDocument();
    // The scrim must not be left over the page it just opened.
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes from the X button', () => {
    renderLayout();
    const hamburger = screen.getByLabelText('Open navigation');

    fireEvent.click(hamburger);
    fireEvent.click(screen.getByLabelText('Close navigation'));

    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders every nav item, because this is the only nav on a phone', () => {
    renderLayout();

    for (const item of NAV_ITEMS) {
      expect(
        screen.getByRole('link', { name: new RegExp(item.title, 'i') }),
      ).toBeInTheDocument();
    }
  });

  // BILLING-DISABLED BUILD: the plan pages have nothing to show.
  it.runIf(BILLING_DISABLED_BUILD)('leaves out the plan pages while billing is off', () => {
    renderLayout();

    for (const title of ['Payments', 'Analytics', 'Plans']) {
      expect(
        screen.queryByRole('link', { name: new RegExp(title, 'i') }),
      ).not.toBeInTheDocument();
    }
    expect(NAV_ITEMS.map((i) => i.title)).toEqual(['Dashboard', 'Companies', 'Settings']);
  });
});
