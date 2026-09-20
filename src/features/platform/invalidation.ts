// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Cache invalidation matrix
// ═══════════════════════════════════════════════════════
// Every mutation in the console invalidates from here rather than listing keys
// at the call site. The reason is a bug this file exists to prevent: approving
// a payment activates the company's subscription, and PaymentsPage invalidated
// submissions, revenue and stats but NOT companies -- so the Companies table's
// Plan column and status stayed stale until staleTime elapsed, which reads as
// the approval not having worked.
//
// Keys in use:
//   ['platform','stats']                  dashboard KPIs
//   ['companies','list',{filter,page}]    companies table
//   ['companies','detail',id]             one company
//   ['submissions','list',{status,kind}]  review queue
//   ['subscriptions','list',{page}]       manual assignments
//   ['revenue','summary']                 analytics + the sidebar badge
//   ['plans','list']                      static catalogue, never invalidated

import { useQueryClient } from '@tanstack/react-query';

export function useSettle() {
  const queryClient = useQueryClient();

  return {
    /**
     * Approve / reject / suspend / reactivate a company. Moves the row, the
     * detail view and the dashboard's bucket counts.
     */
    afterCompanyDecision(id?: string) {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['platform'] });
      if (id) queryClient.invalidateQueries({ queryKey: ['companies', 'detail', id] });
    },

    /**
     * The feature kill switch. Deliberately narrow: these flags are on neither
     * the list row nor the stats, so invalidating ['companies'] here would
     * refetch every cached list page for a field no list renders.
     */
    afterFeatureOverride(id: string) {
      queryClient.invalidateQueries({ queryKey: ['companies', 'detail', id] });
    },

    /**
     * Approve or reject a payment submission.
     *
     * ['companies'] is included on BOTH paths rather than branching on kind.
     * Approving activates a plan; approving a TRIAL flips isTrial and status;
     * rejecting with blockFutureTrials moves the trial fields. All of those
     * show in the companies table. One extra request on a page the reviewer is
     * usually not looking at beats a stale column that reads as a bug.
     */
    afterSubmissionDecision() {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({ queryKey: ['revenue'] });
      queryClient.invalidateQueries({ queryKey: ['platform'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },

    /**
     * Manual subscription assignment. Cancels the prior active subscription and
     * creates a new one, so the company's plan name and both subscription
     * counts move.
     */
    afterSubscriptionAssign() {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['platform'] });
    },

    /**
     * A plan price or limit changed.
     *
     * ['plans'] is the catalogue itself. ['companies'] goes too because a
     * company row carries planName, and ['platform'] because the dashboard
     * counts active plans -- a retired one drops out of both.
     */
    afterPlanEdit() {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['platform'] });
    },

    /**
     * The expiry sweep. Deactivates companies and flips subscription status en
     * masse, so everything on screen is suspect -- a blanket invalidate is
     * right here, and enumerating keys is how one gets missed.
     */
    afterExpiryScan() {
      queryClient.invalidateQueries();
    },
  };
}
