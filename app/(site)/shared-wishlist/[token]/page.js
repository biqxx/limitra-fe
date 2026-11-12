import { SharedWishlistPage } from '@/components/pages/Account';

export default async function SharedWishlistRoutePage({ params }) {
  const { token } = await params;
  return <SharedWishlistPage token={token} />;
}
