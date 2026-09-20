// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Editing a plan price
// ═══════════════════════════════════════════════════════
// The one screen where an admin action changes what a customer is charged.
// These cover the two ways that goes wrong quietly: a rupee/paisa conversion
// that loses a unit, and a total that disagrees with the monthly rate it was
// derived from.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SubscriptionPlan } from '@/models/platform';

const updatePlan = vi.fn();
const resetPlan = vi.fn();

vi.mock('@/networks/superAdmin/platformNetwork', () => ({
  updatePlan: (...a: unknown[]) => updatePlan(...a),
  resetPlan: (...a: unknown[]) => resetPlan(...a),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { EditPlanDialog } from '../EditPlanDialog';

const PLAN: SubscriptionPlan = {
  id: 'warehouse_starter_6mo',
  name: 'Warehouse Starter — 6 months',
  description: null,
  priceMonthly: '2500',
  priceYearly: '15000',
  maxUsers: 25,
  maxInvoices: null,
  features: null,
  isActive: true,
  sortOrder: 0,
  companyType: 'warehouse',
  durationMonths: 6,
  monthlyMinorUnits: 250000,
  totalMinorUnits: 1500000,
  currency: 'PKR',
  deliveryPersonnelLimit: 3,
  isOffered: true,
  isEdited: false,
};

function renderDialog(plan: SubscriptionPlan = PLAN) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EditPlanDialog plan={plan} open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

const monthlyField = () => screen.getByLabelText(/Monthly price/i);
const save = () => screen.getByRole('button', { name: 'Save' });

beforeEach(() => {
  updatePlan.mockReset().mockResolvedValue(PLAN);
  resetPlan.mockReset().mockResolvedValue(PLAN);
});

describe('the derived total', () => {
  it('shows monthly times duration, not the monthly figure', () => {
    renderDialog();
    // 2,500 × 6 months. Quoting the monthly rate as the charge is the mistake
    // this line exists to prevent.
    expect(screen.getByText(/Charged up front: Rs 15,000/)).toBeInTheDocument();
  });

  it('recomputes as the monthly price is edited', () => {
    renderDialog();
    fireEvent.change(monthlyField(), { target: { value: '3000' } });

    expect(screen.getByText(/Charged up front: Rs 18,000/)).toBeInTheDocument();
  });

  it('sends a total consistent with the monthly rate', async () => {
    renderDialog();
    fireEvent.change(monthlyField(), { target: { value: '3000' } });
    fireEvent.click(save());

    await waitFor(() => expect(updatePlan).toHaveBeenCalled());
    const [, input] = updatePlan.mock.calls[0];
    // The server rejects a mismatch, so sending one would only produce an
    // error the operator cannot act on.
    expect(input.monthlyMinorUnits).toBe(300000);
    expect(input.priceMinorUnits).toBe(300000 * 6);
  });
});

describe('rupee to paisa', () => {
  it('converts a whole rupee amount exactly', async () => {
    renderDialog();
    fireEvent.change(monthlyField(), { target: { value: '1234' } });
    fireEvent.click(save());

    await waitFor(() => expect(updatePlan).toHaveBeenCalled());
    expect(updatePlan.mock.calls[0][1].monthlyMinorUnits).toBe(123400);
  });

  it('rounds a fractional amount rather than truncating a float', async () => {
    renderDialog();
    // 2500.1 * 100 is 250009.99999999997 in IEEE 754. Truncating that charges
    // a paisa less than the page showed.
    fireEvent.change(monthlyField(), { target: { value: '2500.1' } });
    fireEvent.click(save());

    await waitFor(() => expect(updatePlan).toHaveBeenCalled());
    expect(updatePlan.mock.calls[0][1].monthlyMinorUnits).toBe(250010);
  });

  it('tolerates a thousands separator', async () => {
    renderDialog();
    fireEvent.change(monthlyField(), { target: { value: '3,000' } });
    fireEvent.click(save());

    await waitFor(() => expect(updatePlan).toHaveBeenCalled());
    expect(updatePlan.mock.calls[0][1].monthlyMinorUnits).toBe(300000);
  });
});

describe('what is sent', () => {
  it('sends only what changed', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/riders/i), { target: { value: '9' } });
    fireEvent.click(save());

    await waitFor(() => expect(updatePlan).toHaveBeenCalled());
    const [key, input] = updatePlan.mock.calls[0];
    expect(key).toBe('warehouse_starter_6mo');
    expect(input).toEqual({ deliveryPersonnelLimit: 9 });
    // An untouched price must not be restated: it would overwrite any edit
    // made elsewhere since this dialog opened.
    expect('monthlyMinorUnits' in input).toBe(false);
  });

  it('refuses to save with nothing changed', () => {
    renderDialog();
    expect(save()).toBeDisabled();
  });

  it('refuses a negative price', () => {
    renderDialog();
    fireEvent.change(monthlyField(), { target: { value: '-5' } });

    expect(save()).toBeDisabled();
  });

  it('refuses a non-numeric price', () => {
    renderDialog();
    fireEvent.change(monthlyField(), { target: { value: 'free' } });

    expect(save()).toBeDisabled();
  });
});

describe('reset', () => {
  it('is not offered on a plan at its configured price', () => {
    renderDialog();
    expect(screen.queryByRole('button', { name: /Reset to configured/i })).toBeNull();
  });

  it('is offered once a plan has been edited', () => {
    cleanup();
    renderDialog({ ...PLAN, isEdited: true });

    expect(
      screen.getByRole('button', { name: /Reset to configured/i }),
    ).toBeInTheDocument();
  });
});
