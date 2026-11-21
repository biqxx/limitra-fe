import { CartPage } from '@/components/pages/Cart';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Your Shopping Cart',
  description: 'Review items in your Limitra cart and proceed to checkout.',
  path: '/cart',
  noindex: true,
});

export default function CartRoutePage() {
  return <CartPage />;
}
