import { AccountPage } from '@/components/pages/Account';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata({ params }) {
  const { tab } = await params;
  return buildMetadata({
    title: 'My Account',
    description: 'Manage your Limitra account.',
    path: `/account/${encodeURIComponent(tab || 'dashboard')}`,
    noindex: true,
  });
}

export default async function AccountTabPage({ params }) {
  const { tab } = await params;
  return <AccountPage tab={tab} />;
}
