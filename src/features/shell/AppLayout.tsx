import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function PageFallback() {
  return (
    <div className="flex flex-col gap-md" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-sm bg-neutral-100" />
      <div className="h-64 w-full animate-pulse rounded-lg bg-neutral-100" />
    </div>
  );
}

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      {/* min-w-0 matters: without it a wide table inside a flex child refuses
          to shrink and the whole page scrolls sideways. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 p-md lg:p-lg">
          {/* Inside the layout, so the sidebar stays put during navigation. */}
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
