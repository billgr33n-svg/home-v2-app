import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '../lib/queryClient';

// Root providers. Kept intentionally small at M0. Auth/session and
// notification providers are added at M1 and Phase 1 respectively.
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
