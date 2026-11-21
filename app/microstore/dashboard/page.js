import { Suspense } from 'react';
import { StoreProvider } from '@/components/store/StoreProvider';
import { MicrostoreDashboard } from '@/components/microstore/MicrostoreDashboard';

export default function MicrostoreDashboardPage() {
  return (
    <Suspense fallback={null}>
      <StoreProvider>
        <MicrostoreDashboard />
      </StoreProvider>
    </Suspense>
  );
}
