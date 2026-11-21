import { MicrostoreProvider, MicrostoreDashboardFrame } from '@/components/microstore/Microstore';
import '@/styles/admin.css';
import '@/styles/ms-dashboard.css';

export default function MicrostoreDashboardLayout({ children }) {
  return (
    <MicrostoreProvider>
      <MicrostoreDashboardFrame>{children}</MicrostoreDashboardFrame>
    </MicrostoreProvider>
  );
}
