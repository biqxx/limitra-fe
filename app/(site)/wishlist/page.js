import { WishlistPage } from '@/components/pages/Account';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Saved Wishlist',
  description: 'View and manage your saved Limitra products.',
  path: '/wishlist',
  noindex: true,
});

export default function WishlistRoutePage() {
  return <WishlistPage />;
}
