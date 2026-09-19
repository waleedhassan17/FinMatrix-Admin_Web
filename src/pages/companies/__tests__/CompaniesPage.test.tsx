// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Companies list
// ═══════════════════════════════════════════════════════
// The console only ever sent 'active' and 'rejected', so the Inactive filter
// chip listed a state nothing here could produce and nothing could undo. These
// assert that every state the filters can reach now has a way out of it, and
// that each action sends the status the server actually stores.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CompanyListItem } from '@/models/platform';

const getCompanies = vi.fn();
const updateCompanyStatus = vi.fn();

vi.mock('@/networks/superAdmin/platformNetwork', () => ({
  getCompanies: (...a: unknown[]) => getCompanies(...a),
  updateCompanyStatus: (...a: unknown[]) => updateCompanyStatus(...a),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { CompaniesPage } from '../CompaniesPage';

const company = (over: Partial<CompanyListItem>): CompanyListItem => ({
  id: 'c1',
  name: 'Karachi Traders',
  industry: 'Retail',
  email: 'owner@karachi.pk',
  phone: null,
  status: 'pending',
  rejectionReason: null,
  memberCount: 3,
  planName: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  reviewedAt: null,
  isTrial: false,
  trialStartedAt: null,
  trialConvertedAt: null,
  ...over,
});

function renderPage(rows: CompanyListItem[], route = '/companies') {
  getCompanies.mockResolvedValue({
    data: rows,
    total: rows.length,
    page: 1,
    limit: 20,
    pages: 1,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <CompaniesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getCompanies.mockReset();
  updateCompanyStatus.mockReset();
  updateCompanyStatus.mockResolvedValue({ id: 'c1', status: 'active' });
});

describe('row actions', () => {
  it('offers approve and reject on a pending company', async () => {
    renderPage([company({ status: 'pending' })]);

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('offers suspend on an active company, and sends `inactive`', async () => {
    renderPage([company({ status: 'active' })]);

    // Row action opens the confirm; the confirm is what actually mutates.
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));

    await waitFor(() => expect(updateCompanyStatus).toHaveBeenCalled());
    // The server accepts 'suspended' but STORES 'inactive'; sending the stored
    // spelling keeps the filter chips and the badges agreeing with each other.
    expect(updateCompanyStatus.mock.calls[0][1]).toBe('inactive');
  });

  it('offers reactivate on an inactive company, so the Inactive filter is escapable', async () => {
    renderPage([company({ status: 'inactive' })]);

    expect(
      await screen.findByRole('button', { name: 'Reactivate' }),
    ).toBeInTheDocument();
  });

  it('offers reactivate on a rejected company too', async () => {
    renderPage([company({ status: 'rejected' })]);

    expect(
      await screen.findByRole('button', { name: 'Reactivate' }),
    ).toBeInTheDocument();
  });

  it('treats the server’s `suspended` as inactive', async () => {
    renderPage([company({ status: 'suspended' })]);

    expect(
      await screen.findByRole('button', { name: 'Reactivate' }),
    ).toBeInTheDocument();
  });
});

describe('trial', () => {
  it('marks a company on a free trial', async () => {
    renderPage([company({ status: 'active', isTrial: true })]);

    expect(await screen.findByText('On trial')).toBeInTheDocument();
  });

  it('distinguishes a converted trial', async () => {
    renderPage([
      company({
        status: 'active',
        isTrial: true,
        trialConvertedAt: '2026-09-10T00:00:00.000Z',
      }),
    ]);

    expect(await screen.findByText('Converted')).toBeInTheDocument();
  });

  it('sends isTrial only when the trial filter is set', async () => {
    renderPage([company({})], '/companies?trial=trial');

    await waitFor(() => expect(getCompanies).toHaveBeenCalled());
    expect(getCompanies.mock.calls[0][0].isTrial).toBe(true);
  });

  it('sends no isTrial by default', async () => {
    renderPage([company({})]);

    await waitFor(() => expect(getCompanies).toHaveBeenCalled());
    expect(getCompanies.mock.calls[0][0].isTrial).toBeUndefined();
  });
});
