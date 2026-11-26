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

import { BILLING_DISABLED_BUILD } from '@/config/featureFlags';
import type { CompanyListItem } from '@/models/platform';

const getCompanies = vi.fn();
const updateCompanyStatus = vi.fn();
const suspendCompany = vi.fn();
const reinstateCompany = vi.fn();
const activateCompany = vi.fn();
const approveCompany = vi.fn();

vi.mock('@/networks/superAdmin/platformNetwork', () => ({
  getCompanies: (...a: unknown[]) => getCompanies(...a),
  updateCompanyStatus: (...a: unknown[]) => updateCompanyStatus(...a),
}));
vi.mock('@/networks/superAdmin/launchAdminNetwork', () => ({
  suspendCompany: (...a: unknown[]) => suspendCompany(...a),
  reinstateCompany: (...a: unknown[]) => reinstateCompany(...a),
  activateCompany: (...a: unknown[]) => activateCompany(...a),
  approveCompany: (...a: unknown[]) => approveCompany(...a),
  bulkCompanies: vi.fn(),
  getOfferedPlans: vi.fn().mockResolvedValue([{ key: 'warehouse_scale_1yr', label: 'Warehouse Scale — 1 year' }]),
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
  for (const m of [suspendCompany, reinstateCompany, activateCompany, approveCompany]) {
    m.mockReset();
    m.mockResolvedValue({ id: 'c1' });
  }
});

describe('row actions', () => {
  it('offers approve and reject on a pending company', async () => {
    renderPage([company({ status: 'pending' })]);

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  // A company created but never submitted sits in the same queue and needs
  // the same decision. It used to fall through every check and be offered
  // "Reactivate".
  it('treats a never-submitted company as awaiting a decision, and says so', async () => {
    renderPage([company({ status: 'email_verified' })]);

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.getByText('Not submitted')).toBeInTheDocument();
  });

  it('deactivating is a suspension that needs a reason', async () => {
    renderPage([company({ status: 'active' })]);

    // Row action opens the confirm; the confirm is what actually mutates.
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Deactivate' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Reason (sent to the owner)'), {
      target: { value: 'Chargeback dispute' },
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(suspendCompany).toHaveBeenCalledWith('c1', 'Chargeback dispute'));
    expect(updateCompanyStatus).not.toHaveBeenCalled();
  });

  it('activating a deactivated company restores it (or applies new terms)', async () => {
    renderPage([company({ status: 'inactive' })]);

    fireEvent.click(await screen.findByRole('button', { name: 'Activate' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/restore as it was/i)).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(activateCompany).toHaveBeenCalledWith('c1', {}));
    // The badge says what an administrator did, not the database word. (The
    // filter chip of the same name is a button, so it is not matched here.)
    expect(
      screen.getAllByText('Deactivated').some((el) => el.tagName === 'SPAN'),
    ).toBe(true);
  });

  it('activating a suspended company reinstates it', async () => {
    renderPage([company({ status: 'suspended', suspendedAt: '2026-11-20T00:00:00.000Z' })]);

    fireEvent.click(await screen.findByRole('button', { name: 'Activate' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(reinstateCompany).toHaveBeenCalledWith('c1'));
    expect(activateCompany).not.toHaveBeenCalled();
  });

  it('approving needs a plan with an end date, or a trial — never a bare approval', async () => {
    renderPage([company({ status: 'pending', requestedPlan: 'warehouse_scale_1yr' })]);

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText(/as a free trial/i));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(approveCompany).toHaveBeenCalledWith('c1', { asTrial: true }));
    expect(updateCompanyStatus).not.toHaveBeenCalled();
  });

  it('offers approve on a rejected company, so a rejection can be reconsidered', async () => {
    renderPage([company({ status: 'rejected' })]);

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });

  it('treats the server’s `suspended` as deactivated', async () => {
    renderPage([company({ status: 'suspended' })]);

    expect(await screen.findByRole('button', { name: 'Activate' })).toBeInTheDocument();
  });
});

describe('finding a company', () => {
  it('shows the owner an administrator would contact', async () => {
    renderPage([company({ ownerName: 'Ayesha Khan', ownerEmail: 'ayesha@karachi.pk' })]);

    expect(await screen.findByText('Ayesha Khan')).toBeInTheDocument();
    expect(screen.getByText('ayesha@karachi.pk')).toBeInTheDocument();
  });

  it('searches from the URL, so a search is a link', async () => {
    renderPage([company({})], '/companies?q=karachi');

    await waitFor(() => expect(getCompanies).toHaveBeenCalled());
    expect(getCompanies.mock.calls[0][0].search).toBe('karachi');
  });

  it('searches as the reviewer types, once they pause', async () => {
    renderPage([company({})]);
    await waitFor(() => expect(getCompanies).toHaveBeenCalled());

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search companies' }), {
      target: { value: 'ayesha' },
    });

    await waitFor(() =>
      expect(getCompanies.mock.calls.some((c) => c[0].search === 'ayesha')).toBe(true),
    );
  });
});

// BILLING-DISABLED BUILD: nothing is sold, so trial markers and the trial
// filter would only ever describe history nobody acts on.
describe.runIf(BILLING_DISABLED_BUILD)('while billing is off', () => {
  it('shows no trial markers', async () => {
    renderPage([company({ status: 'active', isTrial: true })]);

    expect(await screen.findByText('Karachi Traders')).toBeInTheDocument();
    expect(screen.queryByText('On trial')).not.toBeInTheDocument();
  });

  it('ignores a trial filter left in an old link', async () => {
    renderPage([company({})], '/companies?trial=trial');

    await waitFor(() => expect(getCompanies).toHaveBeenCalled());
    expect(getCompanies.mock.calls[0][0].isTrial).toBeUndefined();
  });
});

describe.skipIf(BILLING_DISABLED_BUILD)('trial', () => {
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
});

describe('filters', () => {
  it('sends no isTrial by default', async () => {
    renderPage([company({})]);

    await waitFor(() => expect(getCompanies).toHaveBeenCalled());
    expect(getCompanies.mock.calls[0][0].isTrial).toBeUndefined();
  });
});
