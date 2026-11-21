import { MicrostoreProvider, MicrostoreDashboardFrame } from '@/components/microstore/Microstore';
import { buildMetadata } from '@/lib/seo';
import '@/styles/admin.css';
import '@/styles/ms-dashboard.css';

export const metadata = buildMetadata({
  title: 'Microstore Dashboard',
  description: 'Manage your Limitra Microstore products, storefront, and analytics.',
  path: '/microstore/dashboard',
  noindex: true,
});

export default function MicrostoreDashboardLayout({ children }) {
  return (
    <MicrostoreProvider>
      <MicrostoreDashboardFrame>{children}</MicrostoreDashboardFrame>
    </MicrostoreProvider>
  );
}
