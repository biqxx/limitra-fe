import DashboardLayout from './DashboardLayout';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Affiliate Dashboard', noindex: true });

export default DashboardLayout;
