import DashboardLayout from './DashboardLayout';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Admin Dashboard', noindex: true });

export default DashboardLayout;
