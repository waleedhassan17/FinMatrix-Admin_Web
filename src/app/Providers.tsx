import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { Toaster } from 'sonner';

import { store } from '@/store/store';
import { colors, radius, shadows } from '@/theme/tokens';

import { queryClient } from './queryClient';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: colors.surface,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: `${radius.md}px`,
              boxShadow: shadows.md,
            },
          }}
        />
      </QueryClientProvider>
    </ReduxProvider>
  );
}

export default Providers;
