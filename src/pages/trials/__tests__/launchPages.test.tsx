// @vitest-environment jsdom
// The launch pages: held-trial decisions, plan-terms validation, the demo
// drawer's moves, and the delete dialog's typed confirmation.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const net = vi.hoisted(() => ({
  listTrials: vi.fn(),
  getTrialCounts: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  approveCompany: vi.fn(),
  activateCompany: vi.fn(),
  reinstateCompany: vi.fn(),
  suspendCompany: vi.fn(),
  getOfferedPlans: vi.fn(),
  listDemoRequests: vi.fn(),
  getDemoRequest: vi.fn(),
  setDemoStatus: vi.fn(),
  scheduleDemo: vi.fn(),
  addDemoNote: vi.fn(),
  linkDemoCompany: vi.fn(),
  sendDemoTrialInvite: vi.fn(),
  exportDemoCsv: vi.fn(),
  getTrialClaims: vi.fn(),
  getDeletionPreview: vi.fn(),
  deleteCompany: vi.fn(),
  getDeletionJob: vi.fn(),
  extendTrial: vi.fn(),
  endTrial: vi.fn(),
  grantTrial: vi.fn(),
  setCompanyDemo: vi.fn(),
}));
vi.mock('@/networks/superAdmin/launchAdminNetwork', () => net);
vi.mock('@/networks/superAdmin/platformNetwork', () => ({ updateCompanyStatus: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { CompanyLaunchPanel } from '@/features/launch/CompanyLaunchPanel';
import type { CompanyDetail } from '@/models/platform';
import { DemoRequestsPage } from '@/pages/demos/DemoRequestsPage';
import { TrialsPage } from '@/pages/trials/TrialsPage';

const wrap = (ui: ReactElement, route = '/') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

const trialRow = {
  companyId: 'c1',
  companyName: 'Lahore Mart',
  ownerId: 'u1',
  ownerName: 'Bilal',
  ownerEmail: 'bilal@example.com',
  ownerEmailVerified: true,
  phone: '+923001234567',
  businessType: 'Wholesale',
  status: 'pending_approval',
  isDemo: false,
  fromDemo: true,
  autoApproved: false,
  startedAt: null,
  endsAt: null,
  daysLeft: null,
  plan: 'free',
  planLabel: 'Free',
  requestedPlan: null,
  requestedPlanLabel: null,
  approvalNote: null,
  submittedAt: '2026-11-26T05:00:00.000Z',
  submissionId: 's1',
  holdReason: '4 attempts from one network in 24 hours',
  activationRequestedPlan: null,
  activationRequestedPlanLabel: null,
  activationNote: null,
  matchedClaims: [],
};

beforeEach(() => {
  for (const f of Object.values(net)) f.mockReset();
  net.getTrialCounts.mockResolvedValue({ activeTrials: 4, trialsEndingIn7Days: 1, heldTrials: 1, approvalRequests: 0, activationRequests: 0 });
  net.listTrials.mockResolvedValue({ view: 'held', items: [trialRow], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
  net.getOfferedPlans.mockResolvedValue([{ key: 'warehouse_scale_1yr', label: 'Warehouse Scale — 1 year' }]);
  net.approveSubmission.mockResolvedValue({});
  net.rejectSubmission.mockResolvedValue({});
  net.getTrialClaims.mockResolvedValue([]);
});

describe('Trials & approvals — held trials', () => {
  it('shows why it was held, from a demo, and approves the submission', async () => {
    wrap(<TrialsPage />, '/trials?view=held');
    expect(await screen.findByText('4 attempts from one network in 24 hours')).toBeInTheDocument();
    expect(screen.getByText('From demo')).toBeInTheDocument();
    expect(screen.getByText('Held (1)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(net.approveSubmission).toHaveBeenCalledWith('s1'));
  });

  it('rejects with a reason, and can block future trials', async () => {
    wrap(<TrialsPage />, '/trials?view=held');
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Reject' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Same phone as a refused account' } });
    fireEvent.click(within(dialog).getByLabelText(/block future trials/i));
    fireEvent.click(confirm);
    await waitFor(() => expect(net.rejectSubmission).toHaveBeenCalledWith('s1', 'Same phone as a refused account', true));
  });

  it('activation requests are approved with plan terms; a past end date is refused before sending', async () => {
    net.listTrials.mockResolvedValue({
      view: 'activations',
      items: [{ ...trialRow, activationRequestedPlan: 'warehouse_scale_1yr', activationRequestedPlanLabel: 'Warehouse Scale — 1 year' }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    wrap(<TrialsPage />, '/trials?view=activations');
    fireEvent.click(await screen.findByRole('button', { name: 'Activate' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Warehouse Scale — 1 year');
    fireEvent.change(within(dialog).getByLabelText('End date'), { target: { value: '2020-01-01' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/after the start date|in the future/i);
    expect(net.approveSubmission).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: '1 year' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));
    await waitFor(() =>
      expect(net.approveSubmission).toHaveBeenCalledWith('s1', expect.objectContaining({ plan: 'warehouse_scale_1yr' })),
    );
  });
});

describe('Demo requests drawer', () => {
  const demo = {
    id: 'd1',
    createdAt: '2026-11-25T05:00:00.000Z',
    status: 'new' as const,
    fullName: 'Ayesha Khan',
    businessName: 'Khan Traders',
    phone: '+923001234567',
    email: 'ayesha@example.com',
    city: 'Lahore',
    businessType: 'retail',
    teamSize: null,
    currentSystem: 'tally',
    language: 'ur' as const,
    preferredSlotAt: '2026-11-27T05:00:00.000Z',
    message: null,
    utm: { source: 'facebook' },
    referrer: null,
    landingPath: '/book-demo',
    source: 'web',
    scheduledAt: null,
    meetingLink: null,
    assignedTo: null,
    lostReason: null,
    convertedCompanyId: null,
    convertedAt: null,
    inviteSentAt: null,
    reminderSentAt: null,
  };

  it('offers only the moves the pipeline allows; lost needs a reason; call and WhatsApp links', async () => {
    net.listDemoRequests.mockResolvedValue({ items: [demo], counts: { new: 1 }, pagination: { page: 1, limit: 25, total: 1, pages: 1 } });
    net.getDemoRequest.mockResolvedValue({ ...demo, notes: [], history: [], suggestedCompanies: [] });
    net.setDemoStatus.mockResolvedValue(demo);
    wrap(<DemoRequestsPage />, '/demo-requests');
    fireEvent.click(await screen.findByText('Khan Traders'));
    const drawer = await screen.findByTestId('demo-drawer');
    await within(drawer).findByText('Ayesha Khan');
    expect(within(drawer).getByRole('link', { name: /whatsapp/i })).toHaveAttribute('href', 'https://wa.me/923001234567');
    expect(within(drawer).getByRole('button', { name: 'Contacted' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Completed' })).not.toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Mark lost' })).toBeDisabled();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Contacted' }));
    await waitFor(() => expect(net.setDemoStatus).toHaveBeenCalledWith('d1', 'contacted'));
  });
});

describe('Deleting a company', () => {
  const company = {
    id: 'c9',
    name: 'Karachi Traders',
    isTrial: false,
    trialConvertedAt: null,
    subscriptionExpiryDate: null,
    subscriptionPlan: 'warehouse_scale_1yr',
    isDemo: false,
  } as unknown as CompanyDetail;

  it('shows what goes, needs a reason and the exact name, and keeps the trial used by default', async () => {
    net.getDeletionPreview.mockResolvedValue({
      companyId: 'c9',
      companyName: 'Karachi Traders',
      isDemo: false,
      rowCounts: { invoices: 120, customers: 40 },
      totalRows: 160,
      files: 3,
      postedEntries: 90,
      finalBackup: true,
      usersDeleted: 2,
      membershipsRemoved: 1,
      allowNewTrialDefault: false,
    });
    net.deleteCompany.mockResolvedValue({ id: 'j1', status: 'pending' });
    net.getDeletionJob.mockResolvedValue({ id: 'j1', status: 'pending' });
    wrap(<CompanyLaunchPanel company={company} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete company…' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByTestId('deletion-preview')).toHaveTextContent('final backup is kept for 30 days');
    const confirm = within(dialog).getByRole('button', { name: 'Delete permanently' });
    expect(within(dialog).getByLabelText(/allow a new free trial/i)).not.toBeChecked();
    fireEvent.change(within(dialog).getByLabelText('Reason (audited)'), { target: { value: 'Owner asked in writing' } });
    fireEvent.change(within(dialog).getByLabelText('Type Karachi Traders to confirm'), { target: { value: 'karachi traders' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Type Karachi Traders to confirm'), { target: { value: 'Karachi Traders' } });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(net.deleteCompany).toHaveBeenCalledWith('c9', {
        confirmName: 'Karachi Traders',
        reason: 'Owner asked in writing',
        allowNewTrial: false,
      }),
    );
    expect(await within(dialog).findByTestId('deletion-progress')).toBeInTheDocument();
  });
});
