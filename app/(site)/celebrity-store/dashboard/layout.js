import { CelebrityStoreProvider, CelebrityStoreDashboardFrame } from '@/components/celebrity/CelebrityStore';
import '@/styles/admin.css';
import '@/styles/ms-dashboard.css';

export default function CelebrityStoreDashboardLayout({ children }) {
  return (
    <CelebrityStoreProvider>
      <CelebrityStoreDashboardFrame>{children}</CelebrityStoreDashboardFrame>
    </CelebrityStoreProvider>
  );
}
