// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Dialog
// ═══════════════════════════════════════════════════════
// A plain modal, for content rather than a decision. ConfirmDialog already
// wraps Radix's AlertDialog and is the right thing for "are you sure" -- an
// alert dialog deliberately traps focus harder and has no dismiss-on-overlay,
// because you should not be able to wave away a destructive question.
//
// This exists because the screenshot viewer was a hand-rolled fixed overlay:
// no role, no aria-modal, no focus trap, no Escape, no click-outside. The only
// way out was one specific button, and nothing announced to a screen reader
// that the page behind had gone away.
//
// @radix-ui/react-dialog was already resolved in node_modules as a pinned
// dependency of react-alert-dialog, so adopting it costs a declaration rather
// than a download.

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: it names the dialog for assistive tech, not just for looks. */
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-dialog',
            '-translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-surface shadow-lg',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-md border-b border-border-light px-lg py-md">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-h4 text-text-primary">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-body-sm text-text-secondary">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                // Radix warns when Content has no description. Saying so
                // explicitly is better than an empty node that reads as blank.
                <DialogPrimitive.Description className="sr-only">
                  {title}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="rounded-sm p-xxs text-text-secondary hover:text-text-primary"
            >
              <X className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-auto">{children}</div>

          {footer ? (
            <div className="flex justify-end gap-sm border-t border-border-light px-lg py-md">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default Dialog;
