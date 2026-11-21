import { AccountPage } from '@/components/pages/Account';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'My Account',
  description: 'Manage your Limitra profile, orders, addresses, and wallet.',
  path: '/account',
  noindex: true,
});

export default function AccountIndexPage() {
  return <AccountPage tab="dashboard" />;
}
