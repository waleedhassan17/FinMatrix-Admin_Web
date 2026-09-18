import { Compass } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <Card className="mx-auto max-w-md p-xxl text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-tint text-primary">
        <Compass className="size-5" aria-hidden="true" />
      </span>
      <h1 className="mt-md text-h3 text-text-primary">Page not found</h1>
      <p className="mt-xs break-all text-body-sm text-text-secondary">
        {pathname}
      </p>
      <Button asChild className="mt-lg">
        <Link to="/dashboard">Back to the dashboard</Link>
      </Button>
    </Card>
  );
}

export default NotFoundPage;
