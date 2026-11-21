import { Suspense } from 'react';
import { StoreProvider } from '@/components/store/StoreProvider';
import { MicrostoreDashboard } from '@/components/microstore/MicrostoreDashboard';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Microstore Dashboard',
  description: 'Manage your Limitra microstore.',
  path: '/microstore/dashboard',
  noindex: true,
});

export default function MicrostoreDashboardPage() {
  return (
    <Suspense fallback={null}>
      <StoreProvider>
        <MicrostoreDashboard />
      </StoreProvider>
    </Suspense>
  );
}
