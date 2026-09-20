// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Feature override
// ═══════════════════════════════════════════════════════
// PATCH /super-admin/companies/:id/feature-override.
//
// `allFeaturesUnlocked` is a kill switch, not a setting: the server's
// FeatureGuard checks it BEFORE any plan or company-type logic, so a company
// carrying it sees every feature regardless of what it pays for. That is why
// this is a dialog with a confirm rather than a row of switches on a settings
// page, and why the copy describes the effect rather than naming the field.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { useSettle } from '@/features/platform/invalidation';
import type {
  CompanyDetail,
  CompanyType,
  FeatureOverrideInput,
} from '@/models/platform';
import { updateFeatureOverride } from '@/networks/superAdmin/platformNetwork';

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'small_business', label: 'Small business' },
  { value: 'large_org', label: 'Large organisation' },
];

export function FeatureOverrideDialog({
  company,
  open,
  onOpenChange,
}: {
  company: CompanyDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { afterFeatureOverride } = useSettle();

  // Seeded once from the record. The caller keys this component on the company
  // and the open flag, so reopening remounts with fresh state -- a cancelled
  // edit cannot leave its changes staged for next time, and there is no effect
  // writing state during a render pass.
  const [unlocked, setUnlocked] = useState(!!company.allFeaturesUnlocked);
  const [inventory, setInventory] = useState(!!company.inventoryEnabled);
  const [type, setType] = useState<CompanyType | ''>(company.companyType ?? '');

  const save = useMutation({
    mutationFn: () => {
      // Only what actually changed is sent. The server applies exactly the
      // fields it receives, so sending the unchanged ones would overwrite
      // anything altered elsewhere since this page loaded.
      const input: FeatureOverrideInput = {};
      if (unlocked !== !!company.allFeaturesUnlocked) {
        input.allFeaturesUnlocked = unlocked;
      }
      if (inventory !== !!company.inventoryEnabled) {
        input.inventoryEnabled = inventory;
      }
      if (type && type !== company.companyType) input.companyType = type;
      return updateFeatureOverride(company.id, input);
    },
    onSuccess: () => {
      afterFeatureOverride(company.id);
      toast.success('Feature access updated', { description: company.name });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error('Could not update feature access', { description: e.message }),
  });

  const changed =
    unlocked !== !!company.allFeaturesUnlocked ||
    inventory !== !!company.inventoryEnabled ||
    (!!type && type !== company.companyType);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change feature access"
      description={`These override what ${company.name}'s plan would otherwise allow.`}
      confirmLabel="Save"
      // Unlocking everything is the destructive-shaped choice here: it takes a
      // company outside its plan entirely.
      destructive={unlocked && !company.allFeaturesUnlocked}
      busy={save.isPending}
      confirmDisabled={!changed}
      onConfirm={() => save.mutate()}
    >
      <div className="flex flex-col gap-md">
        <Select<CompanyType>
          label="Company type"
          value={type}
          onChange={setType}
          options={COMPANY_TYPES}
          placeholder="Unset"
          hint="Decides which plan tier and feature set this company is offered."
        />

        <label className="flex items-start gap-sm">
          <input
            type="checkbox"
            checked={inventory}
            onChange={(e) => setInventory(e.target.checked)}
            className="mt-[3px] size-4 shrink-0"
          />
          <span className="flex flex-col">
            <span className="text-label-md text-text-primary">
              Inventory enabled
            </span>
            <span className="text-body-sm text-text-secondary">
              Stock, adjustments and warehouse transfers.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-sm">
          <input
            type="checkbox"
            checked={unlocked}
            onChange={(e) => setUnlocked(e.target.checked)}
            className="mt-[3px] size-4 shrink-0"
          />
          <span className="flex flex-col">
            <span className="text-label-md text-text-primary">
              Bypass every feature gate
            </span>
            {/* Named by effect, not by field: "allFeaturesUnlocked" reads like
                a convenience toggle, and it is not one. */}
            <span className="text-body-sm text-danger">
              This company sees every feature regardless of the plan it pays
              for. Intended for support and migrations, not as a plan upgrade.
            </span>
          </span>
        </label>
      </div>
    </ConfirmDialog>
  );
}

export default FeatureOverrideDialog;
