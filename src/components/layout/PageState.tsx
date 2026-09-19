import { AlertTriangle, FileQuestion, RotateCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { messageOf } from '@/utils/errorMessage';

/**
 * A record page while it loads: header, a sheet and a rail, in their real
 * positions — so the page does not jump when the data lands, and a slow network
 * reads as "loading" rather than as a sentence of grey text.
 */
export function DetailPageSkeleton({ rail = true }: { rail?: boolean }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-lg">
      <div className="flex flex-col gap-sm">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-wrap items-center justify-between gap-md">
          <Skeleton className="h-8 w-64 max-w-full" />
          <div className="flex gap-xs">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </div>
      <div className={rail ? 'grid gap-lg xl:grid-cols-[minmax(0,1fr)_22rem]' : 'grid gap-lg'}>
        <Card className="flex flex-col gap-lg p-xl">
          <div className="flex justify-between gap-lg">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-12 w-40" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="ml-auto h-24 w-64 max-w-full" />
        </Card>
        {rail && (
          <div className="flex flex-col gap-lg">
            <Skeleton className="h-36 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Not found, or failed to load — with a way out, and a retry when it can help. */
export function PageMessage({
  title,
  description,
  backTo,
  backLabel,
  onRetry,
  tone = 'notFound',
}: {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  onRetry?: () => void;
  tone?: 'notFound' | 'error';
}) {
  const Icon = tone === 'error' ? AlertTriangle : FileQuestion;
  return (
    <Card className="mx-auto flex w-full max-w-panel flex-col items-center px-xl py-xxxl text-center">
      <span
        className={
          tone === 'error'
            ? 'flex size-12 items-center justify-center rounded-full bg-danger-lighter text-danger'
            : 'flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary'
        }
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-md text-h4 text-text-primary">{title}</p>
      {description && <p className="mt-xxs text-body-sm text-text-secondary">{description}</p>}
      <div className="mt-lg flex flex-wrap justify-center gap-xs">
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCw className="size-4" />
            Try again
          </Button>
        )}
        {backTo && (
          <Button asChild size="sm">
            <Link to={backTo}>{backLabel ?? 'Back'}</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * An inline failure strip above content that still renders.
 *
 * Deliberately NOT PageMessage, which is a centred full-page card with an icon
 * circle and a way out. Five pages hand-rolled this same strip, and PageMessage
 * would have been the wrong shape for every one of them: these sit above a
 * table or a set of tiles that are still worth showing, so taking over the page
 * would hide data that loaded fine. PageMessage is for when there is genuinely
 * nothing to show -- a 404, or a list that failed with nothing cached.
 *
 * None of the five offered a retry. This one does, when the caller can supply
 * it, because "could not load" without "try again" makes the reader reload the
 * whole console.
 */
export function ErrorBanner({
  error,
  fallback,
  onRetry,
}: {
  error: unknown;
  fallback: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-sm rounded-md bg-danger-lighter p-sm"
    >
      <AlertTriangle
        className="mt-[2px] size-4 shrink-0 text-danger"
        aria-hidden="true"
      />
      <p className="flex-1 text-body-sm text-danger">
        {messageOf(error, fallback)}
      </p>
      {onRetry && (
        <Button variant="text" size="sm" onClick={onRetry}>
          <RotateCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
