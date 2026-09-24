import { Button } from '@/components/ui/Button';
import {
  ACTION_LABEL,
  actionsFor,
  type CompanyAction,
  type DecidableCompany,
} from '@/features/companies/companyDecisions';

/**
 * The action buttons for one company, primary last so it sits on the right.
 * `size` follows the surrounding row: a table row takes `sm`.
 */
export function CompanyActions({
  company,
  onRequest,
  size = 'sm',
}: {
  company: DecidableCompany;
  onRequest: (company: DecidableCompany, action: CompanyAction) => void;
  size?: 'sm' | 'md';
}) {
  const actions = actionsFor(company.status);
  return (
    <div className="flex flex-wrap justify-end gap-xs">
      {[...actions].reverse().map((action) => {
        const primary = action === 'approve' || action === 'activate';
        return (
          <Button
            key={action}
            size={size}
            variant={primary ? 'primary' : 'secondary'}
            onClick={(e) => {
              // Rows are clickable; the button must not also open the company.
              e.stopPropagation();
              onRequest(company, action);
            }}
          >
            {ACTION_LABEL[action]}
          </Button>
        );
      })}
    </div>
  );
}
