import { buildMetadata } from '@/lib/seo';
import { SharedWishlistPage } from '@/components/pages/Account';

export const metadata = buildMetadata({ title: 'Shared Wishlist', noindex: true });

export default async function SharedWishlistRoutePage({ params }) {
  const { token } = await params;
  return <SharedWishlistPage token={token} />;
}
